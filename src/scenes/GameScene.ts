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
import {
  BuildingType,
  BUILDING_CONFIGS,
  getBuildingYields,
  formatYields,
} from '../data/buildings.ts';
import { TILE_CONFIGS } from '../data/tiles.ts';
import { GameUI } from '../ui/GameUI.ts';
import { CameraController } from '../systems/CameraController.ts';
import { WorldUI } from '../ui/WorldUI.ts';
import { PanelManager } from '../ui/PanelManager.ts';

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
      this.researchNextTech();
    });

    this.input.keyboard!.on('keydown-M', () => {
      this.panelManager.showTechTree();
    });

    // Capture Space so it cycles game speed instead of scrolling the page.
    this.input.keyboard!.addCapture('SPACE');
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.gameTime.cycleSpeed();
      this.ui.update();
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

  private researchNextTech(): void {
    const available = this.tech.getAvailableNodes();
    if (available.length === 0) return;
    const node = available[0];
    if (!this.tech.tryResearch(node)) return;
    this.applyTechEffect(node);
  }

  // Non-building tech effects. Building unlocks are handled by TechManager via
  // TECH_CONFIGS.unlocks; effects that reach into other systems live here.
  private applyTechEffect(node: TechNode): void {
    if (node === TechNode.COASTAL_ENGINEERING) {
      this.erosion.upgradeSeaWalls();
    }
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
      this.worldUI.showYieldIcons(q, r, getBuildingYields(building.buildingType, tile.tileType));
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
    const parts = formatYields(getBuildingYields(buildingType, tileType));
    return parts.length > 0 ? parts.join(', ') : 'no yield';
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
