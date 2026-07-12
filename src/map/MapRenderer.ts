import Phaser from 'phaser';
import { hexKey, getHexVertices, axialToPixel } from './HexUtils.ts';
import { TileType, TILE_CONFIGS, EROSION_TRANSITION } from '../data/tiles.ts';
import { BUILDING_CONFIGS } from '../data/buildings.ts';
import type { BuildingInstance } from '../data/buildings.ts';
import { UpgradeType } from '../data/upgrades.ts';
import { HEX_SIZE } from '../constants.ts';
import type { TileData } from './types.ts';

export interface ConstructionOverlay {
  q: number;
  r: number;
  progress: number; // 0..1
  // For build jobs, a faint preview of the incoming building is drawn.
  shape?: 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon';
  color?: number;
}

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
  private ghostGfx: Phaser.GameObjects.Graphics | null = null;
  private constructionGfx: Phaser.GameObjects.Graphics | null = null;
  private tileGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();

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
    return axialToPixel(q, r, HEX_SIZE);
  }

  render(): void {
    for (const [, tile] of this.getTiles()) {
      const gfx = this.scene.add.graphics();
      this.drawHex(gfx, tile.q, tile.r, tile.tileType);
      this.drawBuildingIcon(gfx, tile);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      gfx.setInteractive(
        new Phaser.Geom.Polygon(getHexVertices(x, y, HEX_SIZE - 1).flatMap((v) => [v.x, v.y])),
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
      this.tileGraphics.set(hexKey(tile.q, tile.r), gfx);
      this.container.add(gfx);
    }
  }

  // Traces a hexagon outline onto the graphics path. Callers apply
  // fillPath()/strokePath() afterwards.
  private traceHex(gfx: Phaser.GameObjects.Graphics, vertices: { x: number; y: number }[]): void {
    gfx.beginPath();
    gfx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) gfx.lineTo(vertices[i].x, vertices[i].y);
    gfx.closePath();
  }

  private drawHex(
    gfx: Phaser.GameObjects.Graphics,
    q: number,
    r: number,
    tileType: TileType,
    borderColor: number = 0x333333,
    borderAlpha: number = 0.4,
    borderWidth: number = 1,
  ): void {
    const config = TILE_CONFIGS[tileType];
    const { x, y } = this.axialToWorld(q, r);
    const vertices = getHexVertices(x, y, HEX_SIZE);

    gfx.clear();
    gfx.fillStyle(config.color, 1);
    this.traceHex(gfx, vertices);
    gfx.fillPath();

    gfx.lineStyle(borderWidth, borderColor, borderAlpha);
    this.traceHex(gfx, vertices);
    gfx.strokePath();
  }

  refreshTile(tile: TileData): void {
    const gfx = this.tileGraphics.get(hexKey(tile.q, tile.r));
    if (!gfx) return;

    const building = this.getBuildingAtTile?.(tile) ?? null;
    const seaWalled = building?.upgrades.includes(UpgradeType.SEA_WALL) ?? false;

    const hexBorder = seaWalled ? 0x4488cc : tile.erosionProgress > 0 ? 0xff4444 : 0x333333;
    const hexBorderAlpha = seaWalled ? 0.9 : tile.erosionProgress > 0 ? 0.8 : 0.4;
    const hexBorderWidth = seaWalled ? 3 : 1;
    this.drawHex(gfx, tile.q, tile.r, tile.tileType, hexBorder, hexBorderAlpha, hexBorderWidth);

    if (tile.erosionProgress > 0) {
      const pct = tile.erosionProgress / 100;
      gfx.fillStyle(0xff0000, pct * 0.3);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      const vertices = getHexVertices(x, y, HEX_SIZE);
      this.traceHex(gfx, vertices);
      gfx.fillPath();
    }

    this.drawBuildingIcon(gfx, tile);
  }

  private drawBuildingIcon(gfx: Phaser.GameObjects.Graphics, tile: TileData): void {
    if (!this.getBuildingAtTile) return;
    const building = this.getBuildingAtTile(tile);
    if (!building) return;

    const config = BUILDING_CONFIGS[building.buildingType];
    const { x, y } = this.axialToWorld(tile.q, tile.r);
    const iconSize = HEX_SIZE * 0.35;
    const danger = tile.erosionProgress >= 70 && this.isBuildingDanger(building, tile.tileType);

    const fillColor = danger ? 0xff2222 : config.iconColor;
    const fillAlpha = danger ? 0.85 : 0.9;
    const borderColor = danger ? 0xffcc00 : 0x000000;
    const borderAlpha = danger ? 0.9 : 0.3;
    const borderWidth = danger ? 1.5 : 1;

    gfx.fillStyle(fillColor, fillAlpha);
    gfx.lineStyle(borderWidth, borderColor, borderAlpha);
    this.drawBuildingShape(gfx, x, y, config.iconShape, iconSize);

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

  private drawBuildingShape(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    shape: string,
    iconSize: number,
  ): void {
    if (shape === 'circle') {
      gfx.beginPath();
      gfx.arc(x, y, iconSize, 0, Math.PI * 2);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (shape === 'triangle') {
      const h = iconSize * 1.5;
      const w = iconSize * 1.3;
      gfx.beginPath();
      gfx.moveTo(x, y - h * 0.6);
      gfx.lineTo(x + w, y + h * 0.4);
      gfx.lineTo(x - w, y + h * 0.4);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (shape === 'square') {
      const s = iconSize * 0.85;
      gfx.beginPath();
      gfx.moveTo(x, y - s);
      gfx.lineTo(x + s, y);
      gfx.lineTo(x, y + s);
      gfx.lineTo(x - s, y);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (shape === 'diamond') {
      const s = iconSize * 1.1;
      gfx.beginPath();
      gfx.moveTo(x, y - s);
      gfx.lineTo(x + s * 0.7, y);
      gfx.lineTo(x, y + s);
      gfx.lineTo(x - s * 0.7, y);
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
    } else if (shape === 'hexagon') {
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
  }

  // Renders a translucent preview of a building on a tile, tinted green/red to
  // signal whether it can be placed there. Used by tile-locked build mode.
  showGhost(q: number, r: number, shape: string, iconColor: number, valid: boolean): void {
    if (!this.ghostGfx) {
      this.ghostGfx = this.scene.add.graphics();
      this.container.add(this.ghostGfx);
    }
    const g = this.ghostGfx;
    g.clear();

    const { x, y } = this.axialToWorld(q, r);
    const highlight = valid ? 0x44cc44 : 0xcc4444;
    const vertices = getHexVertices(x, y, HEX_SIZE - 1);

    g.fillStyle(highlight, 0.22);
    g.lineStyle(2, highlight, 0.7);
    this.traceHex(g, vertices);
    g.fillPath();
    g.strokePath();

    g.fillStyle(valid ? iconColor : 0xcc4444, 0.55);
    g.lineStyle(1, 0x000000, 0.4);
    this.drawBuildingShape(g, x, y, shape, HEX_SIZE * 0.35);

    this.container.bringToTop(g);
  }

  hideGhost(): void {
    this.ghostGfx?.clear();
  }

  // Redraws all in-progress construction overlays: a progress bar above each
  // tile, plus a faint preview of the incoming building for build jobs. Called
  // every frame, so it draws with graphics only (no per-frame text objects).
  renderConstruction(overlays: ConstructionOverlay[]): void {
    if (!this.constructionGfx) {
      this.constructionGfx = this.scene.add.graphics();
      this.container.add(this.constructionGfx);
    }
    const g = this.constructionGfx;
    g.clear();

    const barW = HEX_SIZE * 1.1;
    const barH = 5;

    for (const o of overlays) {
      const { x, y } = this.axialToWorld(o.q, o.r);

      if (o.shape) {
        g.fillStyle(o.color ?? 0xffffff, 0.35);
        g.lineStyle(1, 0x000000, 0.3);
        this.drawBuildingShape(g, x, y, o.shape, HEX_SIZE * 0.35);
      }

      // Below the tile centre, clear of the yield icons drawn above a building.
      const bx = x - barW / 2;
      const by = y + HEX_SIZE * 0.6;
      const p = Math.max(0, Math.min(1, o.progress));

      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(bx - 1, by - 1, barW + 2, barH + 2, 2);
      g.fillStyle(0x333344, 0.9);
      g.fillRect(bx, by, barW, barH);
      g.fillStyle(0x44cc44, 1);
      g.fillRect(bx, by, barW * p, barH);
    }

    this.container.bringToTop(g);
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
    this.traceHex(gfx, vertices);
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

    const hl = this.hoverHighlight!;
    this.container.bringToTop(hl);
    hl.clear();
    hl.fillStyle(color, 0.25);
    hl.lineStyle(2, color, 0.6);
    this.traceHex(hl, vertices);
    hl.fillPath();
    hl.strokePath();
  }

  isSelected(q: number, r: number): boolean {
    return this.selectedQ === q && this.selectedR === r;
  }
}
