import { TileType, TILE_CONFIGS, EROSION_TRANSITION } from '../data/tiles.ts';
import { BuildingType } from '../data/buildings.ts';
import {
  EROSION_CHECK_INTERVAL,
  EROSION_BASE_PROGRESS,
  EROSION_ADJACENCY_BONUS,
} from '../constants.ts';
import { hexDistance, hexKey, getNeighbors } from '../map/HexUtils.ts';
import type { TileData } from '../map/types.ts';
import type { IClock } from './TimeSystem.ts';

export interface IErosionTarget {
  tiles: Map<string, TileData>;
  getWaterNeighbors(q: number, r: number): TileData[];
  refreshTile(q: number, r: number): void;
  onBuildingLost?: (q: number, r: number) => void;
  isBuildingCompatibleWithTile?: (q: number, r: number, newTileType: TileType) => boolean;
  getBuildingTypeAt?: (q: number, r: number) => BuildingType | null;
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

  seaWallSelfMult: number = 0.2;
  seaWallAdjMult: number = 0.8;

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
      const jitter =
        this.config.jitterMin + Math.random() * (this.config.jitterMax - this.config.jitterMin);
      const progress =
        (this.config.baseProgress / config.erosionResistance + adjacencyBonus) *
        tile.erosionRate *
        jitter;

      tile.erosionProgress += progress * this.getProtectionMultiplier(tile);
      this.map.refreshTile(tile.q, tile.r);

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

  private getProtectionMultiplier(tile: TileData): number {
    if (tile.seaWalled) return this.seaWallSelfMult;

    const neighborWalled = getNeighbors(tile.q, tile.r).some((n) => {
      const nt = this.map.tiles.get(hexKey(n.q, n.r));
      return nt?.seaWalled ?? false;
    });
    if (neighborWalled) return this.seaWallAdjMult;

    if (this.map.getBuildingTypeAt) {
      for (const [, other] of this.map.tiles) {
        if (this.map.getBuildingTypeAt(other.q, other.r) === BuildingType.LIGHTHOUSE) {
          if (hexDistance(tile, other) <= 3) {
            return 0.5;
          }
        }
      }
    }

    return 1;
  }

  private changeTile(q: number, r: number, newType: TileType): void {
    const tile = this.map.tiles.get(`${q},${r}`);
    if (!tile) return;

    tile.tileType = newType;
    tile.erosionProgress = 0;
    tile.seaWalled = false;

    if (tile.buildingId !== null) {
      const compatible =
        this.map.isBuildingCompatibleWithTile &&
        this.map.isBuildingCompatibleWithTile(q, r, newType);

      if (!compatible) {
        tile.buildingId = null;
        if (this.map.onBuildingLost) {
          this.map.onBuildingLost(q, r);
        }
      }
    }

    this.map.refreshTile(q, r);
  }
}
