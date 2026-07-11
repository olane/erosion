import Phaser from 'phaser';
import { hexKey, getNeighbors } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { MAP_RADIUS, HEX_SIZE } from '../constants.ts';
import { MapRenderer } from './MapRenderer.ts';
import { MapGenerator } from './MapGenerator.ts';
import type { TileData } from './types.ts';

export type { TileData } from './types.ts';

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  renderer: MapRenderer;
  onTileSelect: ((info: string | null) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.renderer = new MapRenderer(scene, () => this.tiles);
    this.renderer.onTileClick = (q, r) => this.handleTileClick(q, r);

    this.tiles = new MapGenerator().generate();
    this.renderer.render();
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
