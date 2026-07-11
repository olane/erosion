import Phaser from 'phaser';
import { hexKey, getHexVertices, getNeighbors } from './HexUtils.ts';
import {
  TileType,
  TILE_CONFIGS,
} from '../data/tiles.ts';
import { MAP_RADIUS, HEX_SIZE } from '../constants.ts';
import { fbm } from './Noise.ts';

export interface TileData {
  q: number;
  r: number;
  tileType: TileType;
  noiseValue: number;
  erosionProgress: number;
  erosionRate: number;
  buildingId: string | null;
  graphics: Phaser.GameObjects.Graphics;
}

const NOISE_SCALE = 0.07;
const NOISE_OCTAVES = 4;

// Stretch the noise input to create directional features (peninsulas)
const STRETCH_R = 1.6;

// Percentile thresholds for terrain assignment (land tiles only)
const ROCK_PCT = 0.10;
const FOREST_PCT = 0.30; // cumulative: 10% rock, 20% forest, 70% grass

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  onTileSelect: ((info: string | null) => void) | null = null;

  private selectedQ: number | null = null;
  private selectedR: number | null = null;
  private highlightGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.generate();
    this.render();
  }

  generate(): void {
    this.tiles.clear();

    const landTiles: { q: number; r: number; noise: number }[] = [];

    // Pass 1a: compute noise, determine land vs water, collect land tiles
    for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
      const rMin = Math.max(-MAP_RADIUS, -q - MAP_RADIUS);
      const rMax = Math.min(MAP_RADIUS, -q + MAP_RADIUS);
      for (let r = rMin; r <= rMax; r++) {
        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));

        const nx = q * NOISE_SCALE;
        const ny = r * NOISE_SCALE * STRETCH_R;
        const noise = fbm(nx, ny, NOISE_OCTAVES);

        const edgeFactor = dist / MAP_RADIUS;
        const landThreshold = edgeFactor * 1.25 - 0.1;

        const isLand = noise >= landThreshold;
        const tileType = isLand ? TileType.GRASS : TileType.WATER;

        const erosionNoise = fbm(q * 0.04, r * 0.04 * STRETCH_R, 3);
        const erosionRate = 0.5 + erosionNoise * 0.5 + Math.random() * 0.5;

        this.tiles.set(hexKey(q, r), {
          q,
          r,
          tileType,
          noiseValue: noise,
          erosionProgress: 0,
          erosionRate,
          buildingId: null,
          graphics: null as unknown as Phaser.GameObjects.Graphics,
        });

        if (isLand) {
          landTiles.push({ q, r, noise });
        }
      }
    }

    // Pass 1b: assign terrain by percentile (ensures consistent proportions per map)
    landTiles.sort((a, b) => b.noise - a.noise); // highest noise first
    for (let i = 0; i < landTiles.length; i++) {
      const pct = i / landTiles.length;
      const tile = this.tiles.get(hexKey(landTiles[i].q, landTiles[i].r))!;
      if (pct < ROCK_PCT) {
        tile.tileType = TileType.ROCK;
      } else if (pct < ROCK_PCT + FOREST_PCT) {
        tile.tileType = TileType.FOREST;
      }
    }

    // Pass 2: refine — shallow water and beaches
    for (const [, tile] of this.tiles) {
      if (tile.tileType === TileType.WATER) {
        if (this.getLandNeighbors(tile.q, tile.r).length > 0) {
          tile.tileType = TileType.SHALLOW_WATER;
        }
      } else if (tile.tileType === TileType.GRASS) {
        const waterN = this.getWaterOrShallowNeighbors(tile.q, tile.r);
        if (waterN.length >= 2) {
          tile.tileType = TileType.BEACH;
        }
      }
    }
  }

  private getLandNeighbors(q: number, r: number): TileData[] {
    const result: TileData[] = [];
    for (const n of getNeighbors(q, r)) {
      const tile = this.tiles.get(hexKey(n.q, n.r));
      if (
        tile &&
        tile.tileType !== TileType.WATER &&
        tile.tileType !== TileType.SHALLOW_WATER
      ) {
        result.push(tile);
      }
    }
    return result;
  }

  private getWaterOrShallowNeighbors(q: number, r: number): TileData[] {
    const result: TileData[] = [];
    for (const n of getNeighbors(q, r)) {
      const tile = this.tiles.get(hexKey(n.q, n.r));
      if (
        tile &&
        (tile.tileType === TileType.WATER ||
          tile.tileType === TileType.SHALLOW_WATER)
      ) {
        result.push(tile);
      }
    }
    return result;
  }

  private render(): void {
    const hexBorder = 0x333333;
    const hexBorderAlpha = 0.4;

    for (const [, tile] of this.tiles) {
      const gfx = this.scene.add.graphics();
      this.drawHex(gfx, tile.q, tile.r, tile.tileType, hexBorder, hexBorderAlpha);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      gfx.setInteractive(
        new Phaser.Geom.Polygon(
          getHexVertices(x, y, HEX_SIZE - 1).flatMap((v) => [v.x, v.y]),
        ),
        Phaser.Geom.Polygon.Contains,
      );
      gfx.on('pointerover', () => {
        gfx.setAlpha(0.8);
      });
      gfx.on('pointerout', () => {
        gfx.setAlpha(1);
      });
      gfx.on('pointerdown', () => {
        this.onTileClick(tile.q, tile.r);
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
    borderColor: number,
    borderAlpha: number,
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

  axialToWorld(q: number, r: number): { x: number; y: number } {
    const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = HEX_SIZE * ((3 / 2) * r);
    return { x, y };
  }

  refreshTile(q: number, r: number): void {
    const key = hexKey(q, r);
    const tile = this.tiles.get(key);
    if (!tile) return;

    const hexBorder = tile.erosionProgress > 0 ? 0xff4444 : 0x333333;
    const hexBorderAlpha = tile.erosionProgress > 0 ? 0.8 : 0.4;
    this.drawHex(tile.graphics, q, r, tile.tileType, hexBorder, hexBorderAlpha);

    if (tile.erosionProgress > 0) {
      const pct = tile.erosionProgress / 100;
      tile.graphics.fillStyle(0xff0000, pct * 0.3);
      const { x, y } = this.axialToWorld(q, r);
      const vertices = getHexVertices(x, y, HEX_SIZE);
      tile.graphics.beginPath();
      tile.graphics.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < 6; i++) tile.graphics.lineTo(vertices[i].x, vertices[i].y);
      tile.graphics.closePath();
      tile.graphics.fillPath();
    }
  }

  getWaterNeighbors(q: number, r: number): TileData[] {
    const neighbors = getNeighbors(q, r);
    const result: TileData[] = [];
    for (const n of neighbors) {
      const tile = this.tiles.get(hexKey(n.q, n.r));
      if (
        tile &&
        (tile.tileType === TileType.WATER ||
          tile.tileType === TileType.SHALLOW_WATER)
      ) {
        result.push(tile);
      }
    }
    return result;
  }

  isCoastal(q: number, r: number): boolean {
    return this.getWaterNeighbors(q, r).length > 0;
  }

  private onTileClick(q: number, r: number): void {
    if (this.selectedQ === q && this.selectedR === r) {
      this.deselectTile();
      if (this.onTileSelect) this.onTileSelect(null);
      return;
    }

    this.selectTile(q, r);
    const info = this.buildTileInfo(q, r);
    // eslint-disable-next-line no-console
    console.log(info);
    if (this.onTileSelect) this.onTileSelect(info);
  }

  private buildTileInfo(q: number, r: number): string {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return '';
    const config = TILE_CONFIGS[tile.tileType];
    const coastal = this.isCoastal(q, r);
    return (
      `(${q},${r}) ${config.name}  |  ` +
      `Erosion ${tile.erosionProgress.toFixed(0)}%  |  ` +
      `${coastal ? 'Coastal' : 'Inland'}  |  ` +
      `Rate ${tile.erosionRate.toFixed(2)}x  |  ` +
      `Food ${config.foodYield}  Mat ${config.materialYield}`
    );
  }

  getSelectedTileInfo(): string | null {
    if (this.selectedQ === null || this.selectedR === null) return null;
    return this.buildTileInfo(this.selectedQ, this.selectedR);
  }

  private selectTile(q: number, r: number): void {
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

  private deselectTile(): void {
    if (this.highlightGfx) {
      this.highlightGfx.destroy();
      this.highlightGfx = null;
    }
    this.selectedQ = null;
    this.selectedR = null;
  }

  centerPosition(): { x: number; y: number } {
    return this.axialToWorld(0, 0);
  }

  worldPixelBounds(): { x: number; y: number; width: number; height: number } {
    const corners = [
      this.axialToWorld(-MAP_RADIUS, 0),
      this.axialToWorld(MAP_RADIUS, 0),
      this.axialToWorld(0, -MAP_RADIUS),
      this.axialToWorld(0, MAP_RADIUS),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const pad = HEX_SIZE * 2;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
