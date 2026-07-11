import Phaser from 'phaser';
import { GameMap } from '../map/GameMap.ts';
import { TimeSystem } from '../systems/TimeSystem.ts';
import { ErosionSystem } from '../systems/ErosionSystem.ts';
import { ResourceManager } from '../systems/ResourceManager.ts';
import { ProductionSystem } from '../systems/ProductionSystem.ts';
import { TechManager } from '../systems/TechManager.ts';
import { TechNode } from '../data/tech.ts';
import { BuildController } from '../systems/BuildController.ts';
import { BuildingType } from '../data/buildings.ts';
import { GameUI } from '../ui/GameUI.ts';
import { CameraController } from '../systems/CameraController.ts';

export class GameScene extends Phaser.Scene {
  map!: GameMap;
  gameTime!: TimeSystem;
  erosion!: ErosionSystem;
  resources!: ResourceManager;
  production!: ProductionSystem;
  tech!: TechManager;
  ui!: GameUI;

  private camera!: CameraController;

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
    this.tech = new TechManager(this.resources);
    this.erosion = new ErosionSystem(this.map, this.gameTime);
    this.production = new ProductionSystem(
      this.resources,
      this.map.buildingManager,
      () => this.map.tiles,
    );

    this.map.resourceProvider = {
      canAffordMaterials: (amount: number) => this.resources.materials >= amount,
      spendMaterials: (amount: number) => this.resources.spendMaterials(amount),
      getAvailablePopulation: () => this.resources.population - this.production.totalPopReq,
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

    this.map.buildController = buildCtrl;

    buildCtrl.onBuildPlaced = () => {
      this.production.recalculateCaps();
    };
    buildCtrl.onBuildPreview = (info) => {
      this.ui.showTileInfo(info);
    };
    buildCtrl.onChanged = () => {
      this.ui.update();
    };

    this.ui = new GameUI(this.gameTime, this.resources, this.tech, this.production, buildCtrl);

    this.map.onTileInspect = (info) => {
      this.ui.showTileInfo(info);
    };

    this.map.onBuildingRemoved = () => {
      this.production.recalculateCaps();
    };

    this.camera = new CameraController(this);

    this.input.keyboard!.on('keydown-ESC', () => {
      if (buildCtrl.buildMode) {
        buildCtrl.cancel();
        this.map.renderer.deselectTile();
      }
    });

    this.input.keyboard!.on('keydown-B', () => {
      buildCtrl.toggleOrCycle();
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
  }

  update(_time: number, delta: number): void {
    this.camera.panWithKeys();

    const dt = this.gameTime.update(delta);
    if (dt <= 0) return;

    this.erosion.update();
    this.production.update(this.gameTime.elapsed);

    const selectedInfo = this.map.getSelectedTileInfo();
    if (selectedInfo !== null) {
      this.ui.showTileInfo(selectedInfo);
    }

    this.ui.update();
  }
}
