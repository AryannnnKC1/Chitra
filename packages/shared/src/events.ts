import type {
  ChatMessage, DrawAction, FillAction, LeaderboardEntry,
  Phase, RoomState, Settings, StrokeChunk,
} from "./types";

// Reply the server gives when you create, join, or rejoin a room
export type JoinResult =
  | { ok: true; code: string; playerId: string; reconnectToken: string }
  | { ok: false; error: string };

// Events the BROWSER sends to the SERVER
export interface ClientToServer {
  "room:create": (p: { name: string; avatar: number }, cb: (r: JoinResult) => void) => void;
  "room:join": (p: { code: string; name: string; avatar: number }, cb: (r: JoinResult) => void) => void;
  "room:rejoin": (p: { code: string; token: string }, cb: (r: JoinResult) => void) => void;
  "settings:update": (s: Partial<Settings>) => void;   // host only
  "game:start": () => void;                            // host only
  "word:choose": (index: number) => void;              // drawer only
  "draw:stroke": (chunk: StrokeChunk) => void;         // drawer only
  "draw:fill": (fill: FillAction) => void;             // drawer only
  "draw:undo": () => void;                             // drawer only
  "draw:clear": () => void;                            // drawer only
  "chat:message": (text: string) => void;              // also used for guessing
}

// Events the SERVER sends to the BROWSER
export interface ServerToClient {
  "room:state": (state: RoomState) => void;
  "game:phase": (p: {
    phase: Phase;
    endsAt: number | null;
    drawerId: string | null;
    round: number;
  }) => void;
  "word:options": (words: string[]) => void;          // sent to the drawer only
  "word:hint": (masked: string) => void;               // e.g. "_ a _ _ e"
  "word:reveal": (word: string) => void;               // sent when the turn ends
  "draw:stroke": (chunk: StrokeChunk) => void;
  "draw:fill": (fill: FillAction) => void;
  "draw:undo": () => void;
  "draw:clear": () => void;
  "draw:sync": (actions: DrawAction[]) => void;        // full drawing for late joiners
  "chat:message": (message: ChatMessage) => void;
  "round:end": (r: { word: string; deltas: Record<string, number> }) => void;
  "game:end": (leaderboard: LeaderboardEntry[]) => void;
  "error": (message: string) => void;
}
