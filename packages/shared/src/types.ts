export type Phase = "LOBBY" | "CHOOSING_WORD" | "DRAWING" | "ROUND_END" | "GAME_END";

export interface PlayerPublic{
  id: string;
  name: string;
  avatar: number;
  score: number;
  connected: boolean;
  hasGuessed: boolean;
  isDrawer: boolean;
  isHost: boolean;
}

export interface Settings{
  maxPlayers: number;
  rounds: number;
  drawTimeSec: number;
  wordChoices: number;
  hints: boolean;
}

export interface Point{
  x: number;
  y: number;
}

export interface Stroke{
  id: string;
  tool: "brush" | "eraser";
  color: string;
  size: number;
  points: Point[];
}
