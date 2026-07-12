import { hexKey, getNeighbors, hexDistance } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import { MAP_RADIUS } from '../constants.ts';
import { fbm } from './Noise.ts';
import type { TileData } from './types.ts';

export interface GeneratedMap {
  tiles: Map<string, TileData>;
  // The chosen Town Hall start tile, or null if no valid site was found.
  townHall: TileData | null;
}

const NOISE_SCALE = 0.07;
const NOISE_OCTAVES = 4;
const STRETCH_R = 1.6;
const ROCK_PCT = 0.1;
const FOREST_PCT = 0.3;
const INLAND_SAND_PCT = 0.2;

export class MapGenerator {
  // Generates terrain and picks a Town Hall start site, retrying the terrain
  // until a valid site exists (or a bounded number of attempts is exhausted).
  generate(): GeneratedMap {
    let tiles = new Map<string, TileData>();
    let candidates: TileData[] = [];
    let attempts = 0;
    do {
      tiles = this.generateTiles();
      candidates = this.findTownHallCandidates(tiles);
      attempts++;
    } while (candidates.length === 0 && attempts < 100);

    const townHall =
      candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    return { tiles, townHall };
  }

  private generateTiles(): Map<string, TileData> {
    const tiles = new Map<string, TileData>();
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

        tiles.set(hexKey(q, r), {
          q,
          r,
          tileType,
          noiseValue: noise,
          erosionProgress: 0,
          erosionRate,
          buildingId: null,
        });

        if (isLand) {
          landTiles.push({ q, r, noise });
        }
      }
    }

    landTiles.sort((a, b) => b.noise - a.noise);
    for (let i = 0; i < landTiles.length; i++) {
      const pct = i / landTiles.length;
      const tile = tiles.get(hexKey(landTiles[i].q, landTiles[i].r))!;
      if (pct < ROCK_PCT) {
        tile.tileType = TileType.ROCK;
      } else if (pct < ROCK_PCT + FOREST_PCT) {
        tile.tileType = TileType.FOREST;
      }
    }

    const getLandNeighbors = (q: number, r: number): TileData[] => {
      const result: TileData[] = [];
      for (const n of getNeighbors(q, r)) {
        const neighbor = tiles.get(hexKey(n.q, n.r));
        if (
          neighbor &&
          neighbor.tileType !== TileType.WATER &&
          neighbor.tileType !== TileType.SHALLOW_WATER
        ) {
          result.push(neighbor);
        }
      }
      return result;
    };

    const getWaterOrShallowNeighbors = (q: number, r: number): TileData[] => {
      const result: TileData[] = [];
      for (const n of getNeighbors(q, r)) {
        const neighbor = tiles.get(hexKey(n.q, n.r));
        if (
          neighbor &&
          (neighbor.tileType === TileType.WATER || neighbor.tileType === TileType.SHALLOW_WATER)
        ) {
          result.push(neighbor);
        }
      }
      return result;
    };

    for (const [, tile] of tiles) {
      if (tile.tileType === TileType.WATER) {
        if (getLandNeighbors(tile.q, tile.r).length > 0) {
          tile.tileType = TileType.SHALLOW_WATER;
        }
      } else if (tile.tileType === TileType.GRASS) {
        const waterN = getWaterOrShallowNeighbors(tile.q, tile.r);
        if (waterN.length >= 2) {
          tile.tileType = TileType.SAND;
        }
      }
    }

    const inlandSandCandidates: { q: number; r: number; noise: number }[] = [];
    for (const [, tile] of tiles) {
      if (tile.tileType !== TileType.GRASS) continue;
      if (getWaterOrShallowNeighbors(tile.q, tile.r).length > 0) continue;
      inlandSandCandidates.push({ q: tile.q, r: tile.r, noise: tile.noiseValue });
    }
    inlandSandCandidates.sort((a, b) => a.noise - b.noise);
    const inlandSandCount = Math.floor(inlandSandCandidates.length * INLAND_SAND_PCT);
    for (let i = 0; i < inlandSandCount; i++) {
      const tile = tiles.get(hexKey(inlandSandCandidates[i].q, inlandSandCandidates[i].r))!;
      tile.tileType = TileType.SAND;
    }

    return tiles;
  }

  private isCoastal(tiles: Map<string, TileData>, q: number, r: number): boolean {
    return getNeighbors(q, r).some((n) => {
      const t = tiles.get(hexKey(n.q, n.r));
      return t?.tileType === TileType.WATER || t?.tileType === TileType.SHALLOW_WATER;
    });
  }

  private hasForestNearby(tiles: Map<string, TileData>, q: number, r: number): boolean {
    for (const [, t] of tiles) {
      if (t.tileType === TileType.FOREST && hexDistance({ q, r }, { q: t.q, r: t.r }) <= 2) {
        return true;
      }
    }
    return false;
  }

  // A good start site is inland but on the coast's doorstep, with forest for
  // early materials: a buildable Town Hall tile that isn't itself coastal but
  // borders the sea and has forest within reach.
  private findTownHallCandidates(tiles: Map<string, TileData>): TileData[] {
    const allowed = BUILDING_CONFIGS[BuildingType.TOWN_HALL].allowedTiles;
    const candidates: TileData[] = [];
    for (const [, tile] of tiles) {
      if (!TILE_CONFIGS[tile.tileType].buildable) continue;
      if (!allowed.includes(tile.tileType)) continue;
      if (this.isCoastal(tiles, tile.q, tile.r)) continue;
      if (!getNeighbors(tile.q, tile.r).some((n) => this.isCoastal(tiles, n.q, n.r))) continue;
      if (!this.hasForestNearby(tiles, tile.q, tile.r)) continue;
      candidates.push(tile);
    }
    return candidates;
  }
}
