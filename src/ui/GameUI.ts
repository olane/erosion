import type { TimeSystem } from '../systems/TimeSystem.ts';
import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import type { TechManager } from '../systems/TechManager.ts';

export class GameUI {
  private time: TimeSystem;
  private container: HTMLDivElement;
  private timeEl: HTMLSpanElement;
  private speedEl: HTMLSpanElement;
  private pauseEl: HTMLSpanElement;
  private infoEl: HTMLSpanElement;
  private tileInfoEl: HTMLSpanElement;
  private buildBtnEl: HTMLSpanElement;
  private buildStatusEl: HTMLSpanElement;

  onBuildSelect: ((type: BuildingType) => void) | null = null;
  onCancelBuild: (() => void) | null = null;
  onTechResearch: ((techIndex: number) => void) | null = null;

  private tech: TechManager | null = null;
  private buildMode: boolean = false;
  private activeBuildingType: BuildingType | null = null;

  constructor(time: TimeSystem, tech?: TechManager) {
    this.time = time;
    this.tech = tech ?? null;

    this.container = this.buildDOM();
    document.getElementById('game-container')!.appendChild(this.container);

    this.timeEl = this.el('time');
    this.speedEl = this.el('speed');
    this.pauseEl = this.el('pause');
    this.infoEl = this.el('info');
    this.tileInfoEl = this.el('tile-info');
    this.buildBtnEl = this.el('build-btn');
    this.buildStatusEl = this.el('build-status');

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
      wrap(span('build-btn', 'clickable')),
      wrap(span('build-status')),
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
    this.speedEl.textContent = `Speed: [${speedLabel}] (click or Space)`;

    this.pauseEl.textContent = this.time.isPaused ? '▶ Resume' : '⏸ Pause';
    this.infoEl.textContent = 'WASD/arrows to pan  |  Scroll to zoom  |  Middle-drag to pan';

    if (this.buildMode && this.activeBuildingType !== null) {
      const config = BUILDING_CONFIGS[this.activeBuildingType];
      const costStr = config.cost > 0 ? `  Cost: ${config.cost} mat` : '';
      const popStr = config.popReq > 0 ? `  Pop: ${config.popReq}` : '';
      this.buildBtnEl.textContent = `Bldg: [${config.name}] (click to switch)`;
      this.buildStatusEl.textContent = `Click tile to place${costStr}${popStr}  |  Esc to cancel`;
    } else {
      this.buildBtnEl.textContent = 'Build: [Click to start]';
      this.buildStatusEl.textContent = '';
    }
  }
}
