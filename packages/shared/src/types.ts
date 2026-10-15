export type Phase = 'LOBBY' | 'CHOOSING_WORD' | 'DRAWING' | 'ROUND_END' | 'GAME_END';

export interface PlayerPublic {
  id: string;
  name: string;
  avatar: number;
  score: number;
  connected: boolean;
  hasGuessed: boolean;
  isDrawer: boolean;
  isHost: boolean;
}

export interface Settings {
  maxPlayers: number;
  rounds: number;
  drawTimeSec: number;
  wordChoices: number;
  hints: boolean;
}

// Coordinates are normalized: 0 to 1 across the canvas
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  tool: 'brush' | 'eraser';
  color: string;
  size: number; // fraction of canvas width
  points: Point[];
}

// A batch of new points for one stroke
export interface StrokeChunk {
  strokeId: string;
  tool: 'brush' | 'eraser';
  color: string;
  size: number;
  points: Point[];
}

export interface FillAction {
  x: number;
  y: number;
  color: string;
}

export type DrawAction =
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'fill'; fill: FillAction };

export interface ChatMessage {
  id: string;
  kind: 'chat' | 'system' | 'correct' | 'close';
  playerId: string | null;
  name: string;
  text: string;
  at: number;
}

// Sent to every player. Never contains the secret word.
export interface RoomState {
  code: string;
  phase: Phase;
  settings: Settings;
  players: PlayerPublic[];
  round: number;
  totalRounds: number;
  drawerId: string | null;
  endsAt: number | null;
  maskedWord: string | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}
