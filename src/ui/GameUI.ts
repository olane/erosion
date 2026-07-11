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
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div id="hud-left">
        <div><span id="time"></span></div>
        <div><span id="speed" class="clickable"></span></div>
        <div><span id="pause" class="clickable"></span></div>
      </div>
      <div id="hud-right">
        <div><span id="info"></span></div>
        <div><span id="tile-info"></span></div>
      </div>
    `;
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

  showTileInfo(text: string): void {
    this.tileInfoEl.textContent = text;
  }

  update(): void {
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const days = Math.floor(this.time.elapsed / 60);
    const hours = Math.floor((this.time.elapsed % 60) / 3.6);
    this.timeEl.textContent = `Day ${days + 1}  ${hours.toString().padStart(2, '0')}:00`;

    const speedLabel = this.time.speed === 0 ? 'Paused' : `${this.time.speed}x`;
    this.speedEl.textContent = `Speed: [${speedLabel}] (click or Space)`;

    this.pauseEl.textContent = this.time.isPaused ? '▶ Resume' : '⏸ Pause';
    this.infoEl.textContent = 'WASD/arrows to pan  |  Scroll to zoom  |  Middle-drag to pan';
  }
}
