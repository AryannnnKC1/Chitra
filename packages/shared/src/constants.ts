import type { Settings } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const MAX_NAME_LENGTH = 16;
export const MAX_CHAT_LENGTH = 100;
export const MAX_POINTS_PER_CHUNK = 200;

export const LIMITS = {
  maxPlayers: { min: 2, max: 12 },
  rounds: { min: 2, max: 10 },
  drawTimeSec: { min: 30, max: 180 },
  wordChoices: { min: 1, max: 5 },
} as const;

export const DEFAULT_SETTINGS: Settings = {
  maxPlayers: 8,
  rounds: 3,
  drawTimeSec: 80,
  wordChoices: 3,
  hints: true,
};

export const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
];
export const AVATAR_COUNT = AVATAR_COLORS.length;

export const PALETTE = [
  '#000000', '#4b5563', '#9ca3af', '#ffffff', '#7f1d1d',
  '#ef4444', '#f97316', '#facc15', '#a3e635', '#16a34a',
  '#14b8a6', '#06b6d4', '#2563eb', '#1e3a8a', '#7c3aed',
  '#d946ef', '#ec4899', '#92400e', '#d97706', '#fcd34d',
];

export const BRUSH_SIZES_PX = [4, 8, 14, 22, 32];
