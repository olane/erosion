import { SPEED_OPTIONS, type GameSpeed } from '../constants.ts';

export interface IClock {
  readonly isPaused: boolean;
  readonly elapsed: number;
}

export class TimeSystem implements IClock {
  elapsed: number = 0;
  speed: GameSpeed = 1;
  paused: boolean = false;

  get isPaused(): boolean {
    return this.paused || this.speed === 0;
  }

  update(deltaMs: number): number {
    if (this.isPaused) return 0;
    const dt = (deltaMs / 1000) * this.speed;
    this.elapsed += dt;
    return dt;
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    if (speed > 0) this.paused = false;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  cycleSpeed(): void {
    const idx = SPEED_OPTIONS.indexOf(this.speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    this.setSpeed(next);
  }
}
