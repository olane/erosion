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
import type { TileData } from '../map/types.ts';
import type { IClock } from './TimeSystem.ts';

export interface IErosionTarget {
  tiles: Map<string, TileData>;
  getWaterNeighbors(q: number, r: number): TileData[];
  refreshTile(q: number, r: number): void;
}

export interface ErosionConfig {
  checkInterval: number;
  baseProgress: number;
  adjacencyBonus: number;
  adjacencyMultiplier: number;
  adjacencyDecayBase: number;
  jitterMin: number;
  jitterMax: number;
}

const DEFAULT_CONFIG: ErosionConfig = {
  checkInterval: EROSION_CHECK_INTERVAL,
  baseProgress: EROSION_BASE_PROGRESS,
  adjacencyBonus: EROSION_ADJACENCY_BONUS,
  adjacencyMultiplier: 2,
  adjacencyDecayBase: 0.5,
  jitterMin: 0.8,
  jitterMax: 1.2,
};

export class ErosionSystem {
  private map: IErosionTarget;
  private time: IClock;
  private config: ErosionConfig;
  private lastCheck: number = 0;

  constructor(map: IErosionTarget, time: IClock, config: ErosionConfig = DEFAULT_CONFIG) {
    this.map = map;
    this.time = time;
    this.config = config;
  }

  update(): void {
    if (this.time.isPaused) return;

    if (this.time.elapsed - this.lastCheck >= this.config.checkInterval) {
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
      const adjacencyBonus =
        this.config.adjacencyMultiplier *
        this.config.adjacencyBonus *
        (1 - Math.pow(this.config.adjacencyDecayBase, waterAdjacentCount));
      const jitter = this.config.jitterMin + Math.random() * (this.config.jitterMax - this.config.jitterMin);
      const progress =
        (this.config.baseProgress / config.erosionResistance + adjacencyBonus) *
        tile.erosionRate *
        jitter;

      tile.erosionProgress += progress;

      if (tile.erosionProgress >= 100) {
        const next = EROSION_TRANSITION[tile.tileType];
        if (next !== null) {
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
