import Phaser from 'phaser';
import { getHexVertices } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { HEX_SIZE } from '../constants.ts';
import type { TileData } from './types.ts';

export class MapRenderer {
  container: Phaser.GameObjects.Container;
  onTileClick: ((q: number, r: number) => void) | null = null;

  private scene: Phaser.Scene;
  private getTiles: () => Map<string, TileData>;
  private selectedQ: number | null = null;
  private selectedR: number | null = null;
  private highlightGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, getTiles: () => Map<string, TileData>) {
    this.scene = scene;
    this.getTiles = getTiles;
    this.container = scene.add.container(0, 0);
  }

  axialToWorld(q: number, r: number): { x: number; y: number } {
    const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = HEX_SIZE * ((3 / 2) * r);
    return { x, y };
  }

  render(): void {
    for (const [, tile] of this.getTiles()) {
      const gfx = this.scene.add.graphics();
      this.drawHex(gfx, tile.q, tile.r, tile.tileType);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      gfx.setInteractive(
        new Phaser.Geom.Polygon(
          getHexVertices(x, y, HEX_SIZE - 1).flatMap((v) => [v.x, v.y]),
        ),
        Phaser.Geom.Polygon.Contains,
      );
      gfx.on('pointerover', () => gfx.setAlpha(0.8));
      gfx.on('pointerout', () => gfx.setAlpha(1));
      gfx.on('pointerdown', () => {
        if (this.onTileClick) {
          this.onTileClick(tile.q, tile.r);
        }
      });
      tile.graphics = gfx;
      this.container.add(gfx);
    }
  }

  private drawHex(
    gfx: Phaser.GameObjects.Graphics,
    q: number,
    r: number,
    tileType: TileType,
    borderColor: number = 0x333333,
    borderAlpha: number = 0.4,
  ): void {
    const config = TILE_CONFIGS[tileType];
    const { x, y } = this.axialToWorld(q, r);
    const vertices = getHexVertices(x, y, HEX_SIZE);

    gfx.clear();
    gfx.fillStyle(config.color, 1);
    gfx.beginPath();
    gfx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) {
      gfx.lineTo(vertices[i].x, vertices[i].y);
    }
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(1, borderColor, borderAlpha);
    gfx.beginPath();
    gfx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) {
      gfx.lineTo(vertices[i].x, vertices[i].y);
    }
    gfx.closePath();
    gfx.strokePath();
  }

  refreshTile(tile: TileData): void {
    const hexBorder = tile.erosionProgress > 0 ? 0xff4444 : 0x333333;
    const hexBorderAlpha = tile.erosionProgress > 0 ? 0.8 : 0.4;
    this.drawHex(tile.graphics, tile.q, tile.r, tile.tileType, hexBorder, hexBorderAlpha);

    if (tile.erosionProgress > 0) {
      const pct = tile.erosionProgress / 100;
      tile.graphics.fillStyle(0xff0000, pct * 0.3);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      const vertices = getHexVertices(x, y, HEX_SIZE);
      tile.graphics.beginPath();
      tile.graphics.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < 6; i++) tile.graphics.lineTo(vertices[i].x, vertices[i].y);
      tile.graphics.closePath();
      tile.graphics.fillPath();
    }
  }

  getSelectedCoords(): { q: number; r: number } | null {
    if (this.selectedQ === null || this.selectedR === null) return null;
    return { q: this.selectedQ, r: this.selectedR };
  }

  selectTile(q: number, r: number): void {
    this.deselectTile();

    const { x, y } = this.axialToWorld(q, r);
    const vertices = getHexVertices(x, y, HEX_SIZE - 1);

    const gfx = this.scene.add.graphics();
    gfx.lineStyle(2, 0xffdd44, 1);
    gfx.beginPath();
    gfx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) gfx.lineTo(vertices[i].x, vertices[i].y);
    gfx.closePath();
    gfx.strokePath();

    this.container.add(gfx);
    this.highlightGfx = gfx;
    this.selectedQ = q;
    this.selectedR = r;
  }

  deselectTile(): void {
    if (this.highlightGfx) {
      this.highlightGfx.destroy();
      this.highlightGfx = null;
    }
    this.selectedQ = null;
    this.selectedR = null;
  }

  isSelected(q: number, r: number): boolean {
    return this.selectedQ === q && this.selectedR === r;
  }
}
