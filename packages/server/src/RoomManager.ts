
import { Room } from './Room';
import type { RoomIO } from './Room';

// The tiny part of Socket.IO we need: send to a room or to one socket
export interface Emitter {
  to(target: string): { emit(event: string, ...args: any[]): unknown };
}

// No 0, O, 1, I so codes are easy to read out loud
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private roomIO: RoomIO;

  constructor(
    emitter: Emitter,
    private maxRooms = 500,
  ) {
    this.roomIO = {
      toRoom: (code, event, ...args) => {
        emitter.to(code).emit(event, ...args);
      },
      toSocket: (socketId, event, ...args) => {
        emitter.to(socketId).emit(event, ...args);
      },
    };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  create(): Room | null {
    if (this.rooms.size >= this.maxRooms) return null;
    let code = '';
    do {
      code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.roomIO, () => {
      this.rooms.delete(code);
    });
    this.rooms.set(code, room);
    return room;
  }
}
