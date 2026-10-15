const randomUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

export class Player {
  readonly id = randomUUID();
  readonly token = randomUUID(); // secret used to rejoin after a disconnect
  score = 0;
  connected = true;
  hasGuessed = false;
  removeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public name: string,
    public avatar: number,
    public socketId: string,
  ) {}
}
