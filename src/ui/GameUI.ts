import type { TimeSystem } from '../systems/TimeSystem.ts';

export class GameUI {
  private time: TimeSystem;
  private container: HTMLDivElement;
  private timeEl: HTMLSpanElement;
  private speedEl: HTMLSpanElement;
  private pauseEl: HTMLSpanElement;
  private infoEl: HTMLSpanElement;
  private tileInfoEl: HTMLSpanElement;

  constructor(time: TimeSystem) {
    this.time = time;

    this.container = this.buildDOM();
    document.getElementById('game-container')!.appendChild(this.container);

    this.timeEl = this.el('time');
    this.speedEl = this.el('speed');
    this.pauseEl = this.el('pause');
    this.infoEl = this.el('info');
    this.tileInfoEl = this.el('tile-info');

    this.bindEvents();
    this.updateDisplay();
  }

  private buildDOM(): HTMLDivElement {
    const span = (id: string, className?: string) => {
      const el = document.createElement('span');
      el.id = id;
      if (className) el.className = className;
      return el;
    };
    const div = (id: string, children: HTMLElement[]) => {
      const el = document.createElement('div');
      el.id = id;
      children.forEach(c => el.appendChild(c));
      return el;
    };
    const wrap = (...children: HTMLElement[]) => {
      const el = document.createElement('div');
      children.forEach(c => el.appendChild(c));
      return el;
    };

    const root = document.createElement('div');
    root.id = 'hud';
    root.appendChild(div('hud-left', [
      wrap(span('time')),
      wrap(span('speed', 'clickable')),
      wrap(span('pause', 'clickable')),
    ]));
    root.appendChild(div('hud-right', [
      wrap(span('info')),
      wrap(span('tile-info')),
    ]));
    return root;
  }

  private el(id: string): HTMLSpanElement {
    return this.container.querySelector(`#${id}`)!;
  }

  private bindEvents(): void {
    this.speedEl.addEventListener('click', () => {
      this.time.cycleSpeed();
      this.updateDisplay();
    });
    this.pauseEl.addEventListener('click', () => {
      this.time.togglePause();
      this.updateDisplay();
    });
  }

  showTileInfo(text: string | null): void {
    this.tileInfoEl.textContent = text ?? '';
  }

  update(): void {
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const days = Math.floor(this.time.elapsed / 3.6);
    this.timeEl.textContent = `Day ${days + 1}`;

    const speedLabel = this.time.speed === 0 ? 'Paused' : `${this.time.speed}x`;
    this.speedEl.textContent = `Speed: [${speedLabel}] (click or Space)`;

    this.pauseEl.textContent = this.time.isPaused ? '▶ Resume' : '⏸ Pause';
    this.infoEl.textContent = 'WASD/arrows to pan  |  Scroll to zoom  |  Middle-drag to pan';
  }
}
