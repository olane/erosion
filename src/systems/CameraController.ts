import Phaser from 'phaser';

const PAN_SPEED = 8;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_SENSITIVITY = 0.001;

export class CameraController {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragging = false;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    this.cam = scene.cameras.main;

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.dragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown()) {
        this.dragging = false;
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      this.cam.scrollX -= dx / this.cam.zoom;
      this.cam.scrollY -= dy / this.cam.zoom;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });

    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
      const oldZoom = this.cam.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - dy * ZOOM_SENSITIVITY, MIN_ZOOM, MAX_ZOOM);
      const pointer = scene.input.activePointer;
      const worldPoint = this.cam.getWorldPoint(pointer.x, pointer.y);
      this.cam.setZoom(newZoom);
      const newWorldPoint = this.cam.getWorldPoint(pointer.x, pointer.y);
      this.cam.scrollX += worldPoint.x - newWorldPoint.x;
      this.cam.scrollY += worldPoint.y - newWorldPoint.y;
    });

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  panWithKeys(): void {
    const speed = PAN_SPEED / this.cam.zoom;
    if (this.cursors.up.isDown || this.wasd.up.isDown) this.cam.scrollY -= speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) this.cam.scrollY += speed;
    if (this.cursors.left.isDown || this.wasd.left.isDown) this.cam.scrollX -= speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) this.cam.scrollX += speed;
  }
}
