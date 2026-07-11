import type { TimeSystem } from '../systems/TimeSystem.ts';
import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import { TECH_CONFIGS } from '../data/tech.ts';
import type { TechManager } from '../systems/TechManager.ts';
import type { ResourceManager } from '../systems/ResourceManager.ts';
import type { ProductionSystem } from '../systems/ProductionSystem.ts';

export class GameUI {
  private time: TimeSystem;
  private resources: ResourceManager | null;
  private production: ProductionSystem | null;
  private tech: TechManager | null;
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

  onBuildSelect: ((type: BuildingType) => void) | null = null;
  onCancelBuild: (() => void) | null = null;

  private buildMode: boolean = false;
  private activeBuildingType: BuildingType | null = null;

  constructor(time: TimeSystem, resources?: ResourceManager, tech?: TechManager, production?: ProductionSystem) {
    this.time = time;
    this.resources = resources ?? null;
    this.tech = tech ?? null;
    this.production = production ?? null;

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
      document.createElement('hr'),
      wrap(span('food')),
      wrap(span('mat')),
      wrap(span('science')),
      wrap(span('pop')),
      document.createElement('hr'),
      wrap(span('build-btn', 'clickable')),
      wrap(span('build-status')),
      wrap(span('tech')),
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
    this.buildBtnEl.addEventListener('click', () => this.toggleBuild());
  }

  toggleBuild(): void {
    const availableTypes = this.getAvailableTypes();
    if (availableTypes.length === 0) return;

    if (this.buildMode && this.activeBuildingType !== null) {
      const currentIdx = availableTypes.indexOf(this.activeBuildingType);
      const nextType = availableTypes[(currentIdx + 1) % availableTypes.length];
      this.activeBuildingType = nextType;
      if (this.onBuildSelect) this.onBuildSelect(nextType);
    } else {
      this.buildMode = true;
      this.activeBuildingType = availableTypes[0];
      if (this.onBuildSelect) this.onBuildSelect(availableTypes[0]);
    }
    this.updateDisplay();
  }

  private getAvailableTypes(): BuildingType[] {
    const all = Object.values(BuildingType).filter(
      (v): v is BuildingType => typeof v === 'number' && v !== BuildingType.TOWN_HALL,
    );
    if (!this.tech) return all;
    return all.filter((t) => this.tech!.isBuildingAvailable(t));
  }

  cancelBuild(): void {
    this.buildMode = false;
    this.activeBuildingType = null;
    if (this.onCancelBuild) this.onCancelBuild();
    this.updateDisplay();
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
    this.speedEl.textContent = `Speed: [${speedLabel}] (Space)`;

    this.pauseEl.textContent = this.time.isPaused ? '▶ Resume' : '⏸ Pause';

    if (this.resources) {
      const r = this.resources;
      const p = this.production;
      const foodNet = p ? p.foodRate : 0;
      const matNet = p ? p.matRate : 0;
      const sciNet = p ? p.scienceRate : 0;

      const sign = (v: number) => v > 0 ? `+${v}` : `${v}`;
      const rateStr = (v: number) => v !== 0 ? ` (${sign(v)}/d)` : '';

      this.foodEl.textContent = `Food: ${Math.floor(r.food)}/${r.foodCap}${rateStr(foodNet)}`;
      this.matEl.textContent = `Mat:  ${Math.floor(r.materials)}/${r.matCap}${rateStr(matNet)}`;
      this.scienceEl.textContent = `Sci:  ${Math.floor(r.science)}${rateStr(sciNet)}`;
      this.popEl.textContent = `Pop:  ${r.population}/${r.popCap}`;
    }

    if (this.buildMode && this.activeBuildingType !== null) {
      const config = BUILDING_CONFIGS[this.activeBuildingType];
      const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : 'Free';
      const popStr = config.popReq > 0 ? ` | Req: ${config.popReq} pop` : '';
      this.buildBtnEl.textContent = `Bldg: [${config.name}]`;
      this.buildStatusEl.textContent = `${costStr}${popStr} | Click tile to place | Esc to cancel`;
    } else {
      this.buildBtnEl.textContent = 'Build: [B] (click to start)';
      this.buildStatusEl.textContent = '';
    }

    this.techEl.textContent = this.buildTechText();

    this.infoEl.textContent = 'WASD/arrows pan  |  Scroll zoom  |  T research';
  }

  private buildTechText(): string {
    if (!this.tech) return '';
    const available = this.tech.getAvailableNodes();
    if (available.length === 0) return 'All tech researched';
    const node = available[0];
    const config = TECH_CONFIGS[node];
    return `Tech: [${config.name} ${config.cost} sci] (T to research) | ${available.length} available`;
  }
}
