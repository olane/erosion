import {
  TileType,
  TILE_CONFIGS,
  EROSION_TRANSITION,
} from '../data/tiles.ts';
import {
  EROSION_CHECK_INTERVAL,
  EROSION_BASE_PROGRESS,
  EROSION_ADJACENCY_BONUS,
} from '../constants.ts';
import type { GameMap } from '../map/GameMap.ts';
import type { TimeSystem } from './TimeSystem.ts';

export class ErosionSystem {
  private map: GameMap;
  private time: TimeSystem;
  private lastCheck: number = 0;

  constructor(map: GameMap, time: TimeSystem) {
    this.map = map;
    this.time = time;
  }

  update(): void {
    if (this.time.isPaused) return;

    if (this.time.elapsed - this.lastCheck >= EROSION_CHECK_INTERVAL) {
      this.lastCheck = this.time.elapsed;
      this.tick();
    }
  }

  private tick(): void {
    const erodingNow: { q: number; r: number; tileType: TileType }[] = [];

    for (const [, tile] of this.map.tiles) {
      const config = TILE_CONFIGS[tile.tileType];
      if (!config.erodible) continue;

      const waterNeighbors = this.map.getWaterNeighbors(tile.q, tile.r);
      if (waterNeighbors.length === 0) continue;

      const waterAdjacentCount = waterNeighbors.length;
      const progress =
        (EROSION_BASE_PROGRESS / config.erosionResistance +
          waterAdjacentCount * EROSION_ADJACENCY_BONUS) *
        tile.erosionRate;

      tile.erosionProgress += progress;

      if (tile.erosionProgress >= 100) {
        const next = EROSION_TRANSITION[tile.tileType];
        if (next !== undefined) {
          erodingNow.push({ q: tile.q, r: tile.r, tileType: next });
        }
      }
    }

    for (const { q, r, tileType } of erodingNow) {
      this.changeTile(q, r, tileType);
    }
  }

  private changeTile(q: number, r: number, newType: TileType): void {
    const keys = [`${q},${r}`];
    for (const key of keys) {
      const tile = this.map.tiles.get(key);
      if (!tile) continue;

      tile.tileType = newType;
      tile.erosionProgress = 0;

      if (tile.buildingId !== null) {
        // eslint-disable-next-line no-console
        console.log(`Building lost at (${q},${r}) due to erosion!`);
        tile.buildingId = null;
      }

      this.map.refreshTile(q, r);
    }
  }
}
