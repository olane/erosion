import Phaser from 'phaser';
import { GameMap } from '../map/GameMap.ts';
import { TimeSystem } from '../systems/TimeSystem.ts';
import { ErosionSystem } from '../systems/ErosionSystem.ts';
import { ResourceManager } from '../systems/ResourceManager.ts';
import { ProductionSystem } from '../systems/ProductionSystem.ts';
import { TechManager } from '../systems/TechManager.ts';
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
    this.map.placeInitialTownHall();

    const bounds = this.map.worldPixelBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.centerOn(0, 0);

    this.gameTime = new TimeSystem();
    this.resources = new ResourceManager();
    this.resources.food = 20;
    this.resources.materials = 25;
    this.tech = new TechManager(this.resources);
    this.erosion = new ErosionSystem(this.map, this.gameTime);
    this.production = new ProductionSystem(
      this.resources,
      this.map.buildingManager,
      () => this.map.tiles,
      (q, r) => this.map.refreshTile(q, r),
    );
    this.ui = new GameUI(this.gameTime, this.resources, this.tech, this.production);

    this.map.onTileSelect = (info: string | null) => {
      this.ui.showTileInfo(info);
    };

    this.ui.onBuildSelect = (type) => {
      this.map.enterBuildMode(type);
    };
    this.ui.onCancelBuild = () => {
      this.map.exitBuildMode();
    };

    this.map.onBuildingRemoved = () => {
      this.production.recalculateCaps();
    };
    this.map.onBuildPlaced = () => {
      this.ui.cancelBuild();
      this.production.recalculateCaps();
    };

    this.map.canAfford = (materials: number) =>
      this.resources.materials >= materials;
    this.map.spendMaterials = (amount: number) =>
      this.resources.spendMaterials(amount);

    this.camera = new CameraController(this);

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.map.buildMode) {
        this.map.exitBuildMode();
        this.ui.cancelBuild();
      }
    });

    this.input.keyboard!.on('keydown-B', () => {
      this.ui.toggleBuild();
    });

    this.input.keyboard!.on('keydown-T', () => {
      const available = this.tech.getAvailableNodes();
      if (available.length > 0) {
        this.tech.tryResearch(available[0]);
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
