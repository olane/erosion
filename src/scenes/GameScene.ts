import Phaser from 'phaser';
import { GameMap } from '../map/GameMap.ts';
import { TimeSystem } from '../systems/TimeSystem.ts';
import { ErosionSystem } from '../systems/ErosionSystem.ts';
import { GameUI } from '../ui/GameUI.ts';

export class GameScene extends Phaser.Scene {
  map!: GameMap;
  gameTime!: TimeSystem;
  erosion!: ErosionSystem;
  ui!: GameUI;

  private dragStartX = 0;
  private dragStartY = 0;
  private dragging = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private panWithKeys!: () => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.map = new GameMap(this);

    const bounds = this.map.worldPixelBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.centerOn(0, 0);

    this.gameTime = new TimeSystem();
    this.erosion = new ErosionSystem(this.map, this.gameTime);
    this.ui = new GameUI(this.gameTime);

    this.map.onTileSelect = (info: string | null) => {
      this.ui.showTileInfo(info);
    };

    this.setupCameraControls();
  }

  private setupCameraControls(): void {
    const cam = this.cameras.main;
    const panSpeed = 8;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.dragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown()) {
        this.dragging = false;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;

      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
      const oldZoom = cam.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - dy * 0.001, 0.4, 2.5);

      const pointer = this.input.activePointer;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);

      cam.setZoom(newZoom);
      const newWorldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      cam.scrollX += worldPoint.x - newWorldPoint.x;
      cam.scrollY += worldPoint.y - newWorldPoint.y;
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.panWithKeys = () => {
      const speed = panSpeed / cam.zoom;
      if (this.cursors.up.isDown || this.wasd.up.isDown) cam.scrollY -= speed;
      if (this.cursors.down.isDown || this.wasd.down.isDown) cam.scrollY += speed;
      if (this.cursors.left.isDown || this.wasd.left.isDown) cam.scrollX -= speed;
      if (this.cursors.right.isDown || this.wasd.right.isDown) cam.scrollX += speed;
    };
  }

  update(_time: number, delta: number): void {
    this.panWithKeys();

    const dt = this.gameTime.update(delta);
    if (dt <= 0) return;

    this.erosion.update();

    const selectedInfo = this.map.getSelectedTileInfo();
    if (selectedInfo !== null) {
      this.ui.showTileInfo(selectedInfo);
    }

    this.ui.update();
  }
}
