import Phaser from 'phaser';
import { hexKey, getNeighbors } from './HexUtils.ts';
import {
  TileType,
  TILE_CONFIGS,
} from '../data/tiles.ts';
import { MAP_RADIUS, HEX_SIZE } from '../constants.ts';
import { fbm } from './Noise.ts';
import { MapRenderer } from './MapRenderer.ts';
import type { TileData } from './types.ts';

export type { TileData } from './types.ts';

const NOISE_SCALE = 0.07;
const NOISE_OCTAVES = 4;

const STRETCH_R = 1.6;

const ROCK_PCT = 0.10;
const FOREST_PCT = 0.30;

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  renderer: MapRenderer;
  onTileSelect: ((info: string | null) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.renderer = new MapRenderer(scene, () => this.tiles);
    this.renderer.onTileClick = (q, r) => this.handleTileClick(q, r);

    this.generate();
    this.renderer.render();
  }

  generate(): void {
    this.tiles.clear();

    const landTiles: { q: number; r: number; noise: number }[] = [];

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

    landTiles.sort((a, b) => b.noise - a.noise);
    for (let i = 0; i < landTiles.length; i++) {
      const pct = i / landTiles.length;
      const tile = this.tiles.get(hexKey(landTiles[i].q, landTiles[i].r))!;
      if (pct < ROCK_PCT) {
        tile.tileType = TileType.ROCK;
      } else if (pct < ROCK_PCT + FOREST_PCT) {
        tile.tileType = TileType.FOREST;
      }
    }

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

  axialToWorld(q: number, r: number): { x: number; y: number } {
    return this.renderer.axialToWorld(q, r);
  }

  refreshTile(q: number, r: number): void {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return;
    this.renderer.refreshTile(tile);
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

  private handleTileClick(q: number, r: number): void {
    if (this.renderer.isSelected(q, r)) {
      this.renderer.deselectTile();
      if (this.onTileSelect) this.onTileSelect(null);
      return;
    }

    this.renderer.selectTile(q, r);
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
    const coords = this.renderer.getSelectedCoords();
    if (!coords) return null;
    return this.buildTileInfo(coords.q, coords.r);
  }

  centerPosition(): { x: number; y: number } {
    return this.axialToWorld(0, 0);
  }

  worldPixelBounds(): { x: number; y: number; width: number; height: number } {
    const toWorld = (q: number, r: number) => this.axialToWorld(q, r);
    const corners = [
      toWorld(-MAP_RADIUS, 0),
      toWorld(MAP_RADIUS, 0),
      toWorld(0, -MAP_RADIUS),
      toWorld(0, MAP_RADIUS),
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
