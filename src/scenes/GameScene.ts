import Phaser from 'phaser';
import { GameMap } from '../map/GameMap.ts';
import { hexKey } from '../map/HexUtils.ts';
import { TimeSystem } from '../systems/TimeSystem.ts';
import { ErosionSystem } from '../systems/ErosionSystem.ts';
import { ResourceManager } from '../systems/ResourceManager.ts';
import { ProductionSystem } from '../systems/ProductionSystem.ts';
import { TechManager } from '../systems/TechManager.ts';
import { TechNode } from '../data/tech.ts';
import { BuildController } from '../systems/BuildController.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
import { TILE_CONFIGS } from '../data/tiles.ts';
import { GameUI } from '../ui/GameUI.ts';
import { CameraController } from '../systems/CameraController.ts';
import { WorldUI } from '../ui/WorldUI.ts';
import { PanelManager } from '../ui/PanelManager.ts';
import type { TileIcon } from '../ui/types.ts';

export class GameScene extends Phaser.Scene {
  map!: GameMap;
  gameTime!: TimeSystem;
  erosion!: ErosionSystem;
  resources!: ResourceManager;
  production!: ProductionSystem;
  tech!: TechManager;
  ui!: GameUI;

  private worldUI!: WorldUI;
  private panelManager!: PanelManager;
  private camera!: CameraController;
  private gameOver = false;
  private buildCtrl!: BuildController;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.map = new GameMap(this);

    const bounds = this.map.worldPixelBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.centerOn(0, 0);

    this.gameTime = new TimeSystem();
    this.resources = new ResourceManager();
    this.resources.food = 20;
    this.resources.materials = 10;
    this.resources.population = 5;
    this.tech = new TechManager(this.resources);
    this.erosion = new ErosionSystem(this.map, this.gameTime);
    this.production = new ProductionSystem(
      this.resources,
      this.map.buildingManager,
      () => this.map.tiles,
    );

    this.production.onGameOver = () => {
      this.triggerGameOver();
    };

    this.map.resourceProvider = {
      canAffordMaterials: (amount: number) => this.resources.materials >= amount,
      spendMaterials: (amount: number) => this.resources.spendMaterials(amount),
    };

    const getAvailableTypes = (): BuildingType[] => {
      const all = Object.values(BuildingType).filter(
        (v): v is BuildingType => typeof v === 'number' && v !== BuildingType.TOWN_HALL,
      );
      return all.filter((t) => this.tech.isBuildingAvailable(t));
    };

    const buildCtrl = new BuildController(
      () => this.map.tiles,
      this.map.buildingManager,
      this.map.resourceProvider,
      (q, r) => this.map.hasAdjacentBuilding(q, r),
      (q, r) => this.map.isCoastal(q, r),
      getAvailableTypes,
      (q, r) => this.map.refreshTile(q, r),
    );
    this.buildCtrl = buildCtrl;

    this.map.buildController = buildCtrl;

    buildCtrl.onBuildPlaced = () => {
      this.production.recalculateCaps();
    };
    buildCtrl.onChanged = () => {
      // Fires on enter/cycle/cancel/confirm. Re-render the ghost + cycler; when
      // no longer in build mode, restore the plain selection UI for the tile.
      this.refreshBuildMode();
      if (!buildCtrl.buildMode) this.refreshSelectionUI();
      this.ui.update();
    };

    this.ui = new GameUI(this.gameTime, this.resources, this.tech, this.production, buildCtrl);

    this.worldUI = new WorldUI(this, (q, r) => this.map.axialToWorld(q, r));
    this.worldUI.onBuildStart = (q, r) => {
      this.buildCtrl.enterBuildModeAt(q, r);
    };
    this.worldUI.onCyclePrev = () => this.buildCtrl.cycle(-1);
    this.worldUI.onCycleNext = () => this.buildCtrl.cycle(1);
    this.worldUI.onBuildConfirm = () => this.buildCtrl.confirm();

    this.panelManager = new PanelManager();

    this.map.onTileInspect = (info) => {
      this.ui.showTileInfo(info);
      if (info !== null) {
        this.refreshSelectionUI();
      } else {
        this.worldUI.clearBuildUI();
        this.worldUI.clearTileIcons();
      }
    };

    this.map.onBuildingRemoved = () => {
      this.production.recalculateCaps();
    };

    this.camera = new CameraController(this);

    this.input.keyboard!.on('keydown-ESC', () => {
      if (buildCtrl.buildMode) {
        // Back out of build mode; onChanged restores the selection UI.
        buildCtrl.cancel();
        return;
      }
      this.map.renderer.deselectTile();
      this.worldUI.clearBuildUI();
      this.worldUI.clearTileIcons();
      this.ui.showTileInfo(null);
    });

    this.input.keyboard!.on('keydown-B', () => {
      if (buildCtrl.buildMode) buildCtrl.cycle(1);
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (buildCtrl.buildMode) buildCtrl.confirm();
    });

    this.input.keyboard!.on('keydown-T', () => {
      const available = this.tech.getAvailableNodes();
      if (available.length > 0) {
        const researched = available[0];
        this.tech.tryResearch(researched);
        if (researched === TechNode.COASTAL_ENGINEERING) {
          this.erosion.seaWallSelfMult = 0.1;
          this.erosion.seaWallAdjMult = 0.6;
        }
      }
    });

    this.input.keyboard!.on('keydown-M', () => {
      this.panelManager.showTechTree();
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    this.camera.panWithKeys();

    const dt = this.gameTime.update(delta);
    if (dt <= 0) return;

    this.erosion.update();
    this.production.update(this.gameTime.elapsed);

    if (!this.map.buildController?.buildMode) {
      const selectedInfo = this.map.getSelectedTileInfo();
      if (selectedInfo !== null) {
        this.ui.showTileInfo(selectedInfo);
      }
    }

    this.ui.update();
  }

  // Selection UI (not in build mode): buildings show their yields; empty
  // buildable tiles adjacent to a building offer a "Build" button.
  private refreshSelectionUI(): void {
    const coords = this.map.renderer.getSelectedCoords();
    if (!coords) return;
    const { q, r } = coords;

    if (this.buildCtrl?.buildMode) return;

    const tile = this.map.tiles.get(hexKey(q, r));
    if (!tile) return;

    this.worldUI.clearBuildUI();
    this.worldUI.clearTileIcons();

    const building = this.map.buildingManager.getBuildingAt(q, r);

    if (building) {
      const icons = this.buildYieldIcons(q, r, building.buildingType, tile.tileType);
      if (icons.length > 0) this.worldUI.showTileIcons(icons);
    } else if (TILE_CONFIGS[tile.tileType].buildable && this.map.hasAdjacentBuilding(q, r)) {
      this.worldUI.showBuildButton(q, r);
    }
  }

  // Build mode UI: a ghost of the current building on the locked tile plus the
  // cycler panel, showing yields when valid or the reason it can't be placed.
  private refreshBuildMode(): void {
    const bt = this.buildCtrl.buildTile;
    const type = this.buildCtrl.selectedType;
    if (!this.buildCtrl.buildMode || !bt || type === null) {
      this.worldUI.clearBuildUI();
      this.map.renderer.hideGhost();
      return;
    }

    const { q, r } = bt;
    const tile = this.map.tiles.get(hexKey(q, r));
    if (!tile) return;

    const config = BUILDING_CONFIGS[type];
    const valid = this.buildCtrl.canBuildAt(q, r) === true;

    this.map.renderer.showGhost(q, r, config.iconShape, config.iconColor, valid);

    const detail = valid
      ? config.isWall
        ? 'Reduces erosion'
        : this.yieldSummary(type, tile.tileType)
      : (this.buildCtrl.buildBlockReason(q, r) ?? 'cannot build here');
    const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : 'Free';

    this.worldUI.showBuildCycler(q, r, { name: config.name, detail, valid, costStr });
  }

  private yieldSummary(buildingType: number, tileType: number): string {
    const y = getBuildingYields(buildingType, tileType);
    const parts: string[] = [];
    if (y.food) parts.push(`Food ${y.food > 0 ? '+' : ''}${y.food}`);
    if (y.materials) parts.push(`Mat ${y.materials > 0 ? '+' : ''}${y.materials}`);
    if (y.science) parts.push(`Sci ${y.science > 0 ? '+' : ''}${y.science}`);
    if (y.population) parts.push(`Pop ${y.population > 0 ? '+' : ''}${y.population}`);
    return parts.length > 0 ? parts.join(', ') : 'no yield';
  }

  private buildYieldIcons(
    q: number,
    r: number,
    buildingType: number,
    tileType: number,
  ): TileIcon[] {
    const yields = getBuildingYields(buildingType, tileType);
    const icons: TileIcon[] = [];

    const add = (value: number, posColor: number, negColor: number) => {
      if (value === 0) return;
      icons.push({
        q,
        r,
        text: value > 0 ? `+${value}` : `${value}`,
        color: 0xffffff,
        bgColor: value > 0 ? posColor : negColor,
        size: 'medium',
      });
    };

    add(yields.food, 0x44cc44, 0xcc4444);
    add(yields.materials, 0xcc9944, 0xcc6644);
    add(yields.science, 0x4488cc, 0x4444cc);
    add(yields.population, 0xccaa44, 0xcc4444);

    return icons;
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    this.gameTime.speed = 0;

    const overlay = document.createElement('div');
    overlay.id = 'game-over';
    overlay.textContent = 'GAME OVER — Your settlement was abandoned due to population collapse.';
    overlay.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(180,0,0,0.9);color:#fff;padding:20px 40px;font-size:24px;' +
      'border-radius:8px;z-index:1000;text-align:center;';
    document.getElementById('game-container')!.appendChild(overlay);
  }
}
