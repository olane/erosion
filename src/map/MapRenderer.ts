import Phaser from 'phaser';
import { getHexVertices } from './HexUtils.ts';
import { TileType, TILE_CONFIGS, EROSION_TRANSITION } from '../data/tiles.ts';
import { BUILDING_CONFIGS } from '../data/buildings.ts';
import type { BuildingInstance } from '../data/buildings.ts';
import { HEX_SIZE } from '../constants.ts';
import type { TileData } from './types.ts';

export class MapRenderer {
  container: Phaser.GameObjects.Container;
  onTileClick: ((q: number, r: number) => void) | null = null;

  private scene: Phaser.Scene;
  private getTiles: () => Map<string, TileData>;
  private getBuildingAtTile: ((tile: TileData) => BuildingInstance | null) | null = null;
  private canBuildAt: ((q: number, r: number) => boolean | null) | null = null;
  private selectedQ: number | null = null;
  private selectedR: number | null = null;
  private highlightGfx: Phaser.GameObjects.Graphics | null = null;
  private hoverHighlight: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    getTiles: () => Map<string, TileData>,
    getBuildingAtTile?: (tile: TileData) => BuildingInstance | null,
    canBuildAt?: (q: number, r: number) => boolean | null,
  ) {
    this.scene = scene;
    this.getTiles = getTiles;
    this.getBuildingAtTile = getBuildingAtTile ?? null;
    this.canBuildAt = canBuildAt ?? null;
    this.container = scene.add.container(0, 0);
    this.hoverHighlight = scene.add.graphics();
    this.container.add(this.hoverHighlight);
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
      this.drawBuildingIcon(gfx, tile);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      gfx.setInteractive(
        new Phaser.Geom.Polygon(
          getHexVertices(x, y, HEX_SIZE - 1).flatMap((v) => [v.x, v.y]),
        ),
        Phaser.Geom.Polygon.Contains,
      );
      gfx.on('pointerover', () => {
        if (this.canBuildAt) {
          const valid = this.canBuildAt(tile.q, tile.r);
          if (valid !== null) {
            this.drawHoverHighlight(tile.q, tile.r, valid);
            return;
          }
        }
        gfx.setAlpha(0.8);
      });
      gfx.on('pointerout', () => {
        this.hoverHighlight!.clear();
        gfx.setAlpha(1);
      });
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

    this.drawBuildingIcon(tile.graphics, tile);
  }

  private drawBuildingIcon(
    gfx: Phaser.GameObjects.Graphics,
    tile: TileData,
  ): void {
    if (!this.getBuildingAtTile) return;
    const building = this.getBuildingAtTile(tile);
    if (!building) return;

    const config = BUILDING_CONFIGS[building.buildingType];
    const { x, y } = this.axialToWorld(tile.q, tile.r);
    const iconSize = HEX_SIZE * 0.35;
    const danger =
      tile.erosionProgress >= 70 &&
      this.isBuildingDanger(building, tile.tileType);

    const fillColor = danger ? 0xff2222 : config.iconColor;
    const fillAlpha = danger ? 0.85 : 0.9;
    const borderColor = danger ? 0xffcc00 : 0x000000;
    const borderAlpha = danger ? 0.9 : 0.3;
    const borderWidth = danger ? 1.5 : 1;

    gfx.fillStyle(fillColor, fillAlpha);
    gfx.lineStyle(borderWidth, borderColor, borderAlpha);

    if (config.iconShape === 'circle') {
      gfx.beginPath();
      gfx.arc(x, y, iconSize, 0, Math.PI * 2);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (config.iconShape === 'triangle') {
      const h = iconSize * 1.5;
      const w = iconSize * 1.3;
      gfx.beginPath();
      gfx.moveTo(x, y - h * 0.6);
      gfx.lineTo(x + w, y + h * 0.4);
      gfx.lineTo(x - w, y + h * 0.4);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (config.iconShape === 'square') {
      const s = iconSize * 0.85;
      gfx.beginPath();
      gfx.moveTo(x, y - s);
      gfx.lineTo(x + s, y);
      gfx.lineTo(x, y + s);
      gfx.lineTo(x - s, y);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (config.iconShape === 'diamond') {
      const s = iconSize * 1.1;
      gfx.beginPath();
      gfx.moveTo(x, y - s);
      gfx.lineTo(x + s * 0.7, y);
      gfx.lineTo(x, y + s);
      gfx.lineTo(x - s * 0.7, y);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (config.iconShape === 'hexagon') {
      const s = iconSize;
      gfx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const vx = x + s * Math.cos(angle);
        const vy = y + s * Math.sin(angle);
        if (i === 0) gfx.moveTo(vx, vy);
        else gfx.lineTo(vx, vy);
      }
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    }

    if (danger) {
      const warnY = y - iconSize - 2;
      gfx.fillStyle(0xffcc00, 1);
      gfx.beginPath();
      gfx.moveTo(x, warnY - 4);
      gfx.lineTo(x + 3, warnY + 2);
      gfx.lineTo(x - 3, warnY + 2);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x000000, 1);
      gfx.fillRect(x - 0.5, warnY, 1, 2);
      gfx.fillRect(x - 0.5, warnY + 4, 1, 1);
    }
  }

  private isBuildingDanger(building: BuildingInstance, currentTileType: TileType): boolean {
    const nextType = EROSION_TRANSITION[currentTileType];
    if (nextType === null) return false;
    return !BUILDING_CONFIGS[building.buildingType].allowedTiles.includes(nextType);
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

  private drawHoverHighlight(q: number, r: number, valid: boolean): void {
    const { x, y } = this.axialToWorld(q, r);
    const vertices = getHexVertices(x, y, HEX_SIZE - 1);
    const color = valid ? 0x44cc44 : 0xcc4444;

    this.container.bringToTop(this.hoverHighlight!);
    this.hoverHighlight!.clear();
    this.hoverHighlight!.fillStyle(color, 0.25);
    this.hoverHighlight!.lineStyle(2, color, 0.6);
    this.hoverHighlight!.beginPath();
    this.hoverHighlight!.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) this.hoverHighlight!.lineTo(vertices[i].x, vertices[i].y);
    this.hoverHighlight!.closePath();
    this.hoverHighlight!.fillPath();
    this.hoverHighlight!.strokePath();
  }

  isSelected(q: number, r: number): boolean {
    return this.selectedQ === q && this.selectedR === r;
  }
}
