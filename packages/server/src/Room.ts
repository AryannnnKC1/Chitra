import { DEFAULT_SETTINGS } from '@skribbl/shared';
import type {
  ChatMessage,
  DrawAction,
  FillAction,
  LeaderboardEntry,
  Phase,
  RoomState,
  ServerToClient,
  Settings,
  Stroke,
  StrokeChunk,
} from '@skribbl/shared';
import { Player } from './player';
import { judgeGuess, normalize } from './guess';
import { maskWord, pickHintIndex } from './hints';
import { drawerScore, guesserScore } from './scoring';
import { pickWords } from './words';

// The Room never touches sockets directly. It talks through this small interface,
// which makes it easy to test with a fake.
export interface RoomIO {
  toRoom(code: string, event: string, ...args: unknown[]): void;
  toSocket(socketId: string, event: string, ...args: unknown[]): void;
}

const CHOOSE_MS = 15_000;
const ROUND_END_MS = 5_000;
const GAME_END_MS = 15_000;
const GRACE_MS = 45_000; // time a disconnected player has to come back
const MAX_ACTIONS = 2_000;
const MAX_POINTS_PER_STROKE = 5_000;

const randomUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

export class Room {
  settings: Settings = { ...DEFAULT_SETTINGS };
  players = new Map<string, Player>();
  phase: Phase = 'LOBBY';
  hostId: string | null = null;
  round = 0;
  drawerId: string | null = null;
  endsAt: number | null = null;
  actions: DrawAction[] = [];

  private currentWord: string | null = null;
  private wordOptions: string[] = [];
  private revealed = new Set<number>();
  private usedWords = new Set<string>();
  private drawerQueue: string[] = [];
  private guessPoints: number[] = [];
  private turnDeltas: Record<string, number> = {};
  private activeStroke: Stroke | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private destroyed = false;

  constructor(
    readonly code: string,
    private io: RoomIO,
    private onEmpty: () => void,
  ) {}

  // ---------- emit helpers ----------

  private emitAll<E extends keyof ServerToClient>(event: E, ...args: Parameters<ServerToClient[E]>) {
    this.io.toRoom(this.code, event, ...args);
  }

  private emitTo<E extends keyof ServerToClient>(
    player: Player,
    event: E,
    ...args: Parameters<ServerToClient[E]>
  ) {
    if (player.connected) this.io.toSocket(player.socketId, event, ...args);
  }

  private systemMessage(text: string, kind: ChatMessage['kind'] = 'system') {
    this.emitAll('chat:message', {
      id: randomUUID(),
      kind,
      playerId: null,
      name: '',
      text,
      at: Date.now(),
    });
  }

  // ---------- timers ----------

  private later(ms: number, fn: () => void) {
    this.timers.push(
      setTimeout(() => {
        if (!this.destroyed) fn();
      }, ms),
    );
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  // ---------- players ----------

  get connectedPlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  isFull(): boolean {
    return this.players.size >= this.settings.maxPlayers;
  }

  addPlayer(name: string, avatar: number, socketId: string): Player {
    const player = new Player(this.uniqueName(name), avatar, socketId);
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    return player;
  }

  private uniqueName(name: string): string {
    const taken = (n: string) =>
      [...this.players.values()].some((p) => p.name.toLowerCase() === n.toLowerCase());
    let candidate = name;
    let i = 2;
    while (taken(candidate)) candidate = `${name.slice(0, 12)} ${i++}`;
    return candidate;
  }

  rejoin(token: string, socketId: string): Player | undefined {
    const player = [...this.players.values()].find((p) => p.token === token);
    if (!player) return undefined;
    if (player.removeTimer) {
      clearTimeout(player.removeTimer);
      player.removeTimer = null;
    }
    player.socketId = socketId;
    player.connected = true;
    return player;
  }

  // Sends a newly joined or returning player everything they missed
  onPlayerEntered(player: Player, rejoined: boolean) {
    this.emitTo(player, 'draw:sync', this.actions);
    if (this.phase === 'DRAWING' && this.currentWord) {
      this.emitTo(player, 'word:hint', this.hintFor(player));
    }
    if (this.phase === 'CHOOSING_WORD' && player.id === this.drawerId) {
      this.emitTo(player, 'word:options', this.wordOptions);
    }
    this.systemMessage(`${player.name} ${rejoined ? 'reconnected' : 'joined'}`);
    this.broadcastState();
  }

  // A socket dropped. The player keeps their seat for GRACE_MS.
  disconnect(playerId: string, socketId: string) {
    const player = this.players.get(playerId);
    if (!player || !player.connected || player.socketId !== socketId) return;
    player.connected = false;
    player.removeTimer = setTimeout(() => this.removePlayer(playerId), GRACE_MS);
    this.systemMessage(`${player.name} disconnected`);
    this.handleDeparture(playerId);
    this.broadcastState();
  }

  // The player left on purpose and is removed right away
  leave(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    this.systemMessage(`${player.name} left`);
    this.handleDeparture(playerId);
    this.removePlayer(playerId);
  }

  private removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (player.removeTimer) clearTimeout(player.removeTimer);
    this.players.delete(playerId);
    if (this.players.size === 0) {
      this.destroy();
      return;
    }
    if (this.hostId === playerId) this.reassignHost();
    this.broadcastState();
  }

  private reassignHost() {
    const next = this.connectedPlayers[0] ?? [...this.players.values()][0];
    this.hostId = next ? next.id : null;
  }

  // Decides what happens to the game when someone goes away
  private handleDeparture(playerId: string) {
    if (this.hostId === playerId) this.reassignHost();
    if (this.phase === 'LOBBY' || this.phase === 'GAME_END') return;
    if (this.connectedPlayers.length < 2) {
      this.systemMessage('Not enough players. The game is over.');
      this.transitionTo('GAME_END');
      return;
    }
    if (playerId === this.drawerId) {
      if (this.phase === 'CHOOSING_WORD') this.nextTurn();
      else if (this.phase === 'DRAWING') this.transitionTo('ROUND_END');
      return;
    }
    if (this.phase === 'DRAWING') this.checkAllGuessed();
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    for (const p of this.players.values()) {
      if (p.removeTimer) clearTimeout(p.removeTimer);
    }
    this.onEmpty();
  }

  // ---------- state snapshots ----------

  private mask(): string {
    return this.currentWord ? maskWord(this.currentWord, this.revealed) : '';
  }

  // Drawer and players who already guessed see the word. Everyone else sees the mask.
  private hintFor(player: Player): string {
    if (!this.currentWord) return '';
    return player.id === this.drawerId || player.hasGuessed ? this.currentWord : this.mask();
  }

  snapshot(): RoomState {
    return {
      code: this.code,
      phase: this.phase,
      settings: { ...this.settings },
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        connected: p.connected,
        hasGuessed: p.hasGuessed,
        isDrawer: p.id === this.drawerId,
        isHost: p.id === this.hostId,
      })),
      round: this.round,
      totalRounds: this.settings.rounds,
      drawerId: this.drawerId,
      endsAt: this.endsAt,
      maskedWord: this.phase === 'DRAWING' ? this.mask() : null,
    };
  }

  broadcastState() {
    this.emitAll('room:state', this.snapshot());
  }

  private broadcastHint() {
    for (const p of this.players.values()) this.emitTo(p, 'word:hint', this.hintFor(p));
  }

  // ---------- host actions ----------

  updateSettings(playerId: string, partial: Partial<Settings>) {
    if (playerId !== this.hostId || this.phase !== 'LOBBY') return;
    const next = { ...partial };
    if (next.maxPlayers !== undefined) {
      next.maxPlayers = Math.max(next.maxPlayers, this.players.size);
    }
    this.settings = { ...this.settings, ...next };
    this.broadcastState();
  }

  // Returns an error message, or null when the game started
  start(playerId: string): string | null {
    if (playerId !== this.hostId) return 'Only the host can start the game.';
    if (this.phase !== 'LOBBY') return 'A game is already running.';
    if (this.connectedPlayers.length < 2) return 'You need at least 2 players.';
    for (const p of this.players.values()) p.score = 0;
    this.usedWords.clear();
    this.drawerQueue = [];
    this.round = 0;
    this.systemMessage('The game has started!');
    this.nextTurn();
    return null;
  }

  // ---------- the state machine ----------

  // Every phase change goes through here, so timers are always cleaned up
  transitionTo(phase: Phase) {
    this.clearTimers();
    this.phase = phase;
    this.endsAt = null;
    switch (phase) {
      case 'LOBBY':
        this.enterLobby();
        break;
      case 'CHOOSING_WORD':
        this.beginChoosing();
        break;
      case 'DRAWING':
        this.beginDrawing();
        break;
      case 'ROUND_END':
        this.endTurn();
        break;
      case 'GAME_END':
        this.endGame();
        break;
    }
    this.emitAll('game:phase', {
      phase,
      endsAt: this.endsAt,
      drawerId: this.drawerId,
      round: this.round,
    });
    this.broadcastState();
  }

  private nextDrawer(): string | null {
    for (;;) {
      if (this.drawerQueue.length === 0) {
        this.round += 1;
        if (this.round > this.settings.rounds) return null;
        this.drawerQueue = this.connectedPlayers.map((p) => p.id);
        if (this.drawerQueue.length === 0) return null;
      }
      const id = this.drawerQueue.shift()!;
      const player = this.players.get(id);
      if (player && player.connected) return id;
    }
  }

  private nextTurn() {
    const id = this.nextDrawer();
    if (!id) {
      this.transitionTo('GAME_END');
      return;
    }
    this.drawerId = id;
    this.transitionTo('CHOOSING_WORD');
  }

  private enterLobby() {
    this.drawerId = null;
    this.currentWord = null;
    this.round = 0;
    this.actions = [];
    this.activeStroke = null;
    for (const p of this.players.values()) {
      p.score = 0;
      p.hasGuessed = false;
    }
  }

  private beginChoosing() {
    this.currentWord = null;
    this.revealed.clear();
    this.actions = [];
    this.activeStroke = null;
    for (const p of this.players.values()) p.hasGuessed = false;
    this.wordOptions = pickWords(this.settings.wordChoices, this.usedWords);
    this.endsAt = Date.now() + CHOOSE_MS;
    const drawer = this.drawerId ? this.players.get(this.drawerId) : undefined;
    if (drawer) this.emitTo(drawer, 'word:options', this.wordOptions);
    this.later(CHOOSE_MS, () => this.pickWord(0)); // auto-pick if the drawer is idle
  }

  chooseWord(playerId: string, index: number) {
    if (this.phase !== 'CHOOSING_WORD' || playerId !== this.drawerId) return;
    this.pickWord(index);
  }

  private pickWord(index: number) {
    const word = this.wordOptions[index] ?? this.wordOptions[0];
    if (!word) return;
    this.currentWord = word;
    this.usedWords.add(word);
    this.transitionTo('DRAWING');
  }

  private beginDrawing() {
    const total = this.settings.drawTimeSec * 1000;
    this.endsAt = Date.now() + total;
    this.guessPoints = [];
    this.turnDeltas = {};
    this.broadcastHint();
    this.later(total, () => this.transitionTo('ROUND_END'));
    if (this.settings.hints) {
      this.later(total * 0.5, () => this.revealHint());
      this.later(total * 0.75, () => this.revealHint());
    }
  }

  private revealHint() {
    if (this.phase !== 'DRAWING' || !this.currentWord) return;
    const index = pickHintIndex(this.currentWord, this.revealed);
    if (index === null) return;
    this.revealed.add(index);
    this.broadcastHint();
    this.broadcastState();
  }

  private endTurn() {
    const word = this.currentWord ?? '';
    const drawer = this.drawerId ? this.players.get(this.drawerId) : undefined;
    if (drawer && drawer.connected) {
      const guessers = this.connectedPlayers.filter((p) => p.id !== drawer.id).length;
      const points = drawerScore(this.guessPoints, Math.max(guessers, this.guessPoints.length));
      drawer.score += points;
      this.turnDeltas[drawer.id] = points;
    }
    this.emitAll('word:reveal', word);
    this.emitAll('round:end', { word, deltas: this.turnDeltas });
    this.endsAt = Date.now() + ROUND_END_MS;
    this.later(ROUND_END_MS, () => this.nextTurn());
  }

  private endGame() {
    const leaderboard: LeaderboardEntry[] = [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ id: p.id, name: p.name, score: p.score }));
    this.emitAll('game:end', leaderboard);
    this.endsAt = Date.now() + GAME_END_MS;
    this.later(GAME_END_MS, () => this.transitionTo('LOBBY'));
  }

  // ---------- drawing ----------

  canDraw(playerId: string): boolean {
    return this.phase === 'DRAWING' && playerId === this.drawerId;
  }

  applyStroke(chunk: StrokeChunk): boolean {
    if (this.activeStroke?.id !== chunk.strokeId) {
      if (this.actions.length >= MAX_ACTIONS) return false;
      this.activeStroke = {
        id: chunk.strokeId,
        tool: chunk.tool,
        color: chunk.color,
        size: chunk.size,
        points: [],
      };
      this.actions.push({ type: 'stroke', stroke: this.activeStroke });
    }
    const stroke = this.activeStroke!;
    if (stroke.points.length + chunk.points.length > MAX_POINTS_PER_STROKE) return false;
    stroke.points.push(...chunk.points);
    return true;
  }

  applyFill(fill: FillAction): boolean {
    if (this.actions.length >= MAX_ACTIONS) return false;
    this.actions.push({ type: 'fill', fill });
    this.activeStroke = null;
    return true;
  }

  undo() {
    this.actions.pop();
    this.activeStroke = null;
  }

  clearCanvas() {
    this.actions = [];
    this.activeStroke = null;
  }

  // ---------- chat and guessing ----------

  handleChat(playerId: string, rawText: string) {
    const player = this.players.get(playerId);
    const text = rawText.trim();
    if (!player || !text) return;

    const message: ChatMessage = {
      id: randomUUID(),
      kind: 'chat',
      playerId,
      name: player.name,
      text,
      at: Date.now(),
    };

    if (this.phase === 'DRAWING' && this.currentWord) {
      // The drawer may chat, but never say the word
      if (playerId === this.drawerId) {
        if (normalize(text).includes(normalize(this.currentWord))) return;
        this.emitAll('chat:message', message);
        return;
      }
      // Players who already guessed only talk to other guessers and the drawer
      if (player.hasGuessed) {
        for (const other of this.players.values()) {
          if (other.hasGuessed || other.id === this.drawerId) {
            this.emitTo(other, 'chat:message', message);
          }
        }
        return;
      }
      const verdict = judgeGuess(text, this.currentWord);
      if (verdict === 'correct') {
        this.awardGuess(player);
        return;
      }
      if (verdict === 'close') {
        this.emitTo(player, 'chat:message', {
          id: randomUUID(),
          kind: 'close',
          playerId: null,
          name: '',
          text: `'${text}' is close!`,
          at: Date.now(),
        });
      }
    }
    this.emitAll('chat:message', message);
  }

  private awardGuess(player: Player) {
    const total = this.settings.drawTimeSec * 1000;
    const left = Math.max(0, (this.endsAt ?? 0) - Date.now());
    const points = guesserScore(left / total, this.guessPoints.length);
    this.guessPoints.push(points);
    this.turnDeltas[player.id] = points;
    player.score += points;
    player.hasGuessed = true;
    this.emitTo(player, 'word:hint', this.currentWord!);
    this.emitAll('chat:message', {
      id: randomUUID(),
      kind: 'correct',
      playerId: player.id,
      name: player.name,
      text: `${player.name} guessed the word!`,
      at: Date.now(),
    });
    this.broadcastState();
    this.checkAllGuessed();
  }

  private checkAllGuessed() {
    const guessers = this.connectedPlayers.filter((p) => p.id !== this.drawerId);
    if (guessers.length > 0 && guessers.every((p) => p.hasGuessed)) {
      this.transitionTo('ROUND_END');
    }
  }
}
