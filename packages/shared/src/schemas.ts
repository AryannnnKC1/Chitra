import { z } from 'zod';
import {
  AVATAR_COUNT,
  LIMITS,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_POINTS_PER_CHUNK,
} from './constants';

const name = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const avatar = z.number().int().min(0).max(AVATAR_COUNT - 1);
const code = z.string().trim().min(3).max(10);
const unit = z.number().min(0).max(1);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const createSchema = z.object({ name, avatar });
export const joinSchema = z.object({ code, name, avatar });
export const rejoinSchema = z.object({ code, token: z.string().min(10).max(100) });

const range = (r: { min: number; max: number }) => z.number().int().min(r.min).max(r.max);

export const settingsSchema = z
  .object({
    maxPlayers: range(LIMITS.maxPlayers),
    rounds: range(LIMITS.rounds),
    drawTimeSec: range(LIMITS.drawTimeSec),
    wordChoices: range(LIMITS.wordChoices),
    hints: z.boolean(),
  })
  .partial();

export const strokeChunkSchema = z.object({
  strokeId: z.string().min(1).max(64),
  tool: z.enum(['brush', 'eraser']),
  color: hexColor,
  size: z.number().min(0.001).max(0.2),
  points: z.array(z.object({ x: unit, y: unit })).min(1).max(MAX_POINTS_PER_CHUNK),
});

export const fillSchema = z.object({ x: unit, y: unit, color: hexColor });
export const chatSchema = z.string().trim().min(1).max(MAX_CHAT_LENGTH);
export const chooseSchema = z.number().int().min(0).max(9);
