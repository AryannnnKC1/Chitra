import type { Server, Socket } from 'socket.io';
import {
  chatSchema,
  chooseSchema,
  createSchema,
  fillSchema,
  joinSchema,
  rejoinSchema,
  settingsSchema,
  strokeChunkSchema,
} from '@skribbl/shared';
import type { ClientToServer, JoinResult, ServerToClient } from '@skribbl/shared';
import type { Player } from '../player';
import type { Room } from '../Room';
import type { RoomManager } from '../RoomManager';
import { TokenBucket } from '../rateLimit';

export type TypedServer = Server<ClientToServer, ServerToClient>;
export type TypedSocket = Socket<ClientToServer, ServerToClient>;
type Ack = ((result: JoinResult) => void) | undefined;

export function registerHandlers(socket: TypedSocket, rooms: RoomManager) {
  let room: Room | undefined;
  let player: Player | undefined;
  const chatLimit = new TokenBucket(5, 1); // 5 messages, then 1 per second
  const drawLimit = new TokenBucket(100, 60);

  const reply = (cb: Ack, result: JoinResult) => {
    if (typeof cb === 'function') cb(result);
  };
  const fail = (cb: Ack, error: string) => reply(cb, { ok: false, error });

  // Leave the current room (used if a socket creates or joins another one)
  const detach = () => {
    if (room && player) {
      room.leave(player.id);
      socket.leave(room.code);
    }
    room = undefined;
    player = undefined;
  };

  const enter = (r: Room, p: Player, rejoined: boolean, cb: Ack) => {
    room = r;
    player = p;
    socket.join(r.code);
    r.onPlayerEntered(p, rejoined);
    reply(cb, { ok: true, code: r.code, playerId: p.id, reconnectToken: p.token });
  };

  socket.on('room:create', (raw: unknown, cb: Ack) => {
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return fail(cb, 'Please enter a valid name.');
    detach();
    const r = rooms.create();
    if (!r) return fail(cb, 'The server is full. Try again later.');
    const p = r.addPlayer(parsed.data.name, parsed.data.avatar, socket.id);
    enter(r, p, false, cb);
  });

  socket.on('room:join', (raw: unknown, cb: Ack) => {
    const parsed = joinSchema.safeParse(raw);
    if (!parsed.success) return fail(cb, 'Please enter a valid name and room code.');
    const r = rooms.get(parsed.data.code);
    if (!r) return fail(cb, 'Room not found.');
    if (r.isFull()) return fail(cb, 'This room is full.');
    detach();
    const p = r.addPlayer(parsed.data.name, parsed.data.avatar, socket.id);
    enter(r, p, false, cb);
  });

  socket.on('room:rejoin', (raw: unknown, cb: Ack) => {
    const parsed = rejoinSchema.safeParse(raw);
    if (!parsed.success) return fail(cb, 'Invalid session.');
    const r = rooms.get(parsed.data.code);
    const p = r?.rejoin(parsed.data.token, socket.id);
    if (!r || !p) return fail(cb, 'Your session has expired.');
    enter(r, p, true, cb);
  });

  socket.on('settings:update', (raw: unknown) => {
    if (!room || !player) return;
    const parsed = settingsSchema.safeParse(raw);
    if (parsed.success) room.updateSettings(player.id, parsed.data);
  });

  socket.on('game:start', () => {
    if (!room || !player) return;
    const error = room.start(player.id);
    if (error) socket.emit('error', error);
  });

  socket.on('word:choose', (raw: unknown) => {
    if (!room || !player) return;
    const parsed = chooseSchema.safeParse(raw);
    if (parsed.success) room.chooseWord(player.id, parsed.data);
  });

  socket.on('draw:stroke', (raw: unknown) => {
    if (!room || !player || !room.canDraw(player.id) || !drawLimit.take()) return;
    const parsed = strokeChunkSchema.safeParse(raw);
    if (!parsed.success) return;
    if (room.applyStroke(parsed.data)) socket.to(room.code).emit('draw:stroke', parsed.data);
  });

  socket.on('draw:fill', (raw: unknown) => {
    if (!room || !player || !room.canDraw(player.id) || !drawLimit.take()) return;
    const parsed = fillSchema.safeParse(raw);
    if (!parsed.success) return;
    if (room.applyFill(parsed.data)) socket.to(room.code).emit('draw:fill', parsed.data);
  });

  socket.on('draw:undo', () => {
    if (!room || !player || !room.canDraw(player.id)) return;
    room.undo();
    socket.to(room.code).emit('draw:undo');
  });

  socket.on('draw:clear', () => {
    if (!room || !player || !room.canDraw(player.id)) return;
    room.clearCanvas();
    socket.to(room.code).emit('draw:clear');
  });

  socket.on('chat:message', (raw: unknown) => {
    if (!room || !player) return;
    if (!chatLimit.take()) {
      socket.emit('error', 'You are sending messages too fast.');
      return;
    }
    const parsed = chatSchema.safeParse(raw);
    if (parsed.success) room.handleChat(player.id, parsed.data);
  });

  socket.on('disconnect', () => {
    if (room && player) room.disconnect(player.id, socket.id);
  });
}
