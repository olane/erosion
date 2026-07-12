import type { TimeSystem } from '../systems/TimeSystem.ts';
import { BUILDING_CONFIGS } from '../data/buildings.ts';
import { SECONDS_PER_DAY } from '../constants.ts';
import type { TechManager } from '../systems/TechManager.ts';
import { ResourceManager } from '../systems/ResourceManager.ts';
import type { ProductionSystem } from '../systems/ProductionSystem.ts';
import type { BuildController } from '../systems/BuildController.ts';

export class GameUI {
  private time: TimeSystem;
  private resources: ResourceManager;
  private production: ProductionSystem;
  private tech: TechManager;
  private buildCtrl: BuildController;
  private container: HTMLDivElement;
  private timeEl: HTMLSpanElement;
  private speedEl: HTMLSpanElement;
  private pauseEl: HTMLSpanElement;
  private foodEl: HTMLSpanElement;
  private matEl: HTMLSpanElement;
  private scienceEl: HTMLSpanElement;
  private popEl: HTMLSpanElement;
  private buildBtnEl: HTMLSpanElement;
  private buildStatusEl: HTMLSpanElement;
  private techEl: HTMLSpanElement;
  private infoEl: HTMLSpanElement;
  private tileInfoEl: HTMLSpanElement;

  constructor(
    time: TimeSystem,
    resources: ResourceManager,
    tech: TechManager,
    production: ProductionSystem,
    buildCtrl: BuildController,
  ) {
    this.time = time;
    this.resources = resources;
    this.tech = tech;
    this.production = production;
    this.buildCtrl = buildCtrl;

    this.container = this.buildDOM();
    document.getElementById('game-container')!.appendChild(this.container);

    this.timeEl = this.el('time');
    this.speedEl = this.el('speed');
    this.pauseEl = this.el('pause');
    this.foodEl = this.el('food');
    this.matEl = this.el('mat');
    this.scienceEl = this.el('science');
    this.popEl = this.el('pop');
    this.buildBtnEl = this.el('build-btn');
    this.buildStatusEl = this.el('build-status');
    this.techEl = this.el('tech');
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
      children.forEach((c) => el.appendChild(c));
      return el;
    };
    const wrap = (...children: HTMLElement[]) => {
      const el = document.createElement('div');
      children.forEach((c) => el.appendChild(c));
      return el;
    };

    const root = document.createElement('div');
    root.id = 'hud';
    root.appendChild(
      div('hud-left', [
        wrap(span('time')),
        wrap(span('speed', 'clickable')),
        wrap(span('pause', 'clickable')),
        document.createElement('hr'),
        wrap(span('food')),
        wrap(span('mat')),
        wrap(span('science')),
        wrap(span('pop')),
        document.createElement('hr'),
        wrap(span('build-btn', 'clickable')),
        wrap(span('build-status')),
        wrap(span('tech')),
      ]),
    );
    root.appendChild(div('hud-right', [wrap(span('info')), wrap(span('tile-info'))]));
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
    this.buildBtnEl.addEventListener('click', () => {
      if (this.buildCtrl.buildMode) {
        this.buildCtrl.cycle(1);
      }
    });
  }

  showTileInfo(text: string | null): void {
    this.tileInfoEl.textContent = text ?? '';
  }

  update(): void {
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const days = Math.floor(this.time.elapsed / SECONDS_PER_DAY);
    this.timeEl.textContent = `Day ${days + 1}`;

    const speedLabel = this.time.speed === 0 ? 'Paused' : `${this.time.speed}x`;
    this.speedEl.textContent = `Speed: [${speedLabel}] (Space)`;

    this.pauseEl.textContent = this.time.isPaused ? '\u25B6 Resume' : '\u23F8 Pause';

    const r = this.resources;
    const p = this.production;

    const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
    const rate = (v: number) => (v !== 0 ? ` (${sign(v)})` : '');

    this.foodEl.textContent = `Food: ${Math.floor(r.food)}/${r.foodCap}${rate(p.foodRate)}`;
    this.matEl.textContent = `Mat:  ${Math.floor(r.materials)}/${r.matCap}${rate(p.matRate)}`;
    this.scienceEl.textContent = `Sci:  ${Math.floor(r.science)}${rate(p.scienceRate)}`;
    this.popEl.textContent = `Pop:  ${Math.floor(r.population)}${rate(p.popRate)}`;

    if (r.population < 0) {
      const remaining = ResourceManager.NEGATIVE_POP_GRACE_DAYS - r.negativePopDays;
      const warnClass = remaining <= 3 ? 'pop-danger' : 'pop-warn';
      this.popEl.className = warnClass;
      this.popEl.textContent += `  |  WARNING: Negative population! ${remaining} day${remaining !== 1 ? 's' : ''} to fix or game over`;
    } else {
      this.popEl.className = '';
    }

    if (this.buildCtrl.buildMode && this.buildCtrl.selectedType !== null) {
      const config = BUILDING_CONFIGS[this.buildCtrl.selectedType];
      const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : 'Free';
      this.buildBtnEl.textContent = `Bldg: [${config.name}]`;
      this.buildStatusEl.textContent = `${costStr} | ◀ ▶ cycle (B) | Enter to build | Esc to cancel`;
    } else {
      this.buildBtnEl.textContent = 'Build: select a tile next to a building';
      this.buildStatusEl.textContent = '';
    }

    this.techEl.textContent = this.buildTechText();

    this.infoEl.textContent = 'WASD/arrows pan  |  Scroll zoom  |  T research';
  }

  private buildTechText(): string {
    const info = this.tech.getNextTechInfo();
    if (!info) return 'All tech researched';
    return `Tech: [${info.name} ${info.cost} sci] (T to research) | ${info.availableCount} available`;
  }
}
