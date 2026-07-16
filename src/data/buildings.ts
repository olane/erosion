import { TileType } from './tiles.ts';
import type { UpgradeType } from './upgrades.ts';
import { ICONS } from './icons.ts';

export enum BuildingType {
  TOWN_HALL,
  FARM,
  QUARRY,
  LUMBER_CAMP,
  FISHING_DOCK,
  HOUSE,
  WORKSHOP,
  WAREHOUSE,
  LIGHTHOUSE,
  ADVANCED_FARM,
  DEEP_QUARRY,
}

export interface BuildingYields {
  food: number;
  materials: number;
  science: number;
  population: number;
}

export interface BuildingTypeConfig {
  name: string;
  iconColor: number;
  iconShape: 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon';
  allowedTiles: TileType[];
  iconText: string;
  cost: number;
  storageFood?: number;
  storageMat?: number;
  yields: {
    default: Partial<BuildingYields>;
    perTile?: Partial<Record<TileType, Partial<BuildingYields>>>;
  };
  requiresCoastal?: boolean;
  tier: number;
  // Game-seconds to construct. Defaults by tier via getBuildTime() when omitted.
  buildTime?: number;
}

// Default construction time (game-seconds) indexed by building tier.
const DEFAULT_BUILD_TIME_BY_TIER = [3, 5, 8];

export const BUILDING_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  [BuildingType.TOWN_HALL]: {
    name: 'Town Hall',
    iconColor: 0xffaa44,
    iconShape: 'square',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'T',
    cost: 0,
    storageFood: 100,
    storageMat: 100,
    yields: { default: { materials: 1, population: 2 } },
    tier: 0,
  },
  [BuildingType.FARM]: {
    name: 'Farm',
    iconColor: 0x44cc44,
    iconShape: 'circle',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.SAND],
    iconText: 'F',
    cost: 10,
    yields: {
      default: { population: -1 },
      perTile: {
        [TileType.GRASS]: { food: 3 },
        [TileType.FOREST]: { food: 2 },
        [TileType.SAND]: { food: 1 },
      },
    },
    tier: 0,
  },
  [BuildingType.QUARRY]: {
    name: 'Quarry',
    iconColor: 0x999999,
    iconShape: 'triangle',
    allowedTiles: [TileType.ROCK, TileType.RUBBLE],
    iconText: 'Q',
    cost: 10,
    yields: {
      default: { population: -1 },
      perTile: {
        [TileType.ROCK]: { materials: 4 },
        [TileType.RUBBLE]: { materials: 3 },
      },
    },
    tier: 0,
  },
  [BuildingType.LUMBER_CAMP]: {
    name: 'Lumber Camp',
    iconColor: 0x66bb44,
    iconShape: 'triangle',
    allowedTiles: [TileType.FOREST, TileType.GRASS],
    iconText: 'L',
    cost: 10,
    yields: {
      default: { population: -1 },
      perTile: {
        [TileType.FOREST]: { materials: 3 },
        [TileType.GRASS]: { materials: 1 },
      },
    },
    tier: 0,
  },
  [BuildingType.FISHING_DOCK]: {
    name: 'Fishing Dock',
    iconColor: 0x4488cc,
    iconShape: 'circle',
    allowedTiles: [TileType.SAND],
    iconText: 'D',
    cost: 15,
    yields: {
      default: { population: -1 },
      perTile: { [TileType.SAND]: { food: 4 } },
    },
    requiresCoastal: true,
    tier: 0,
  },
  [BuildingType.HOUSE]: {
    name: 'House',
    iconColor: 0xcc9966,
    iconShape: 'square',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'H',
    cost: 15,
    yields: { default: { food: -3, population: 2 } },
    tier: 0,
  },
  [BuildingType.WORKSHOP]: {
    name: 'Workshop',
    iconColor: 0xcccc44,
    iconShape: 'diamond',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'S',
    cost: 20,
    yields: { default: { science: 2, population: -2 } },
    tier: 0,
  },
  [BuildingType.WAREHOUSE]: {
    name: 'Warehouse',
    iconColor: 0xaa8844,
    iconShape: 'diamond',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'R',
    cost: 15,
    storageFood: 100,
    storageMat: 100,
    yields: { default: {} },
    tier: 1,
  },
  [BuildingType.LIGHTHOUSE]: {
    name: 'Lighthouse',
    iconColor: 0xffeebb,
    iconShape: 'hexagon',
    allowedTiles: [TileType.ROCK, TileType.RUBBLE],
    iconText: 'B',
    cost: 40,
    yields: { default: { population: -2 } },
    tier: 2,
  },
  [BuildingType.ADVANCED_FARM]: {
    name: 'Advanced Farm',
    iconColor: 0x22aa22,
    iconShape: 'circle',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.SAND],
    iconText: 'A',
    cost: 25,
    yields: {
      default: { population: -1 },
      perTile: {
        [TileType.GRASS]: { food: 5 },
        [TileType.FOREST]: { food: 3 },
        [TileType.SAND]: { food: 2 },
      },
    },
    tier: 2,
  },
  [BuildingType.DEEP_QUARRY]: {
    name: 'Deep Quarry',
    iconColor: 0xaaaaaa,
    iconShape: 'triangle',
    allowedTiles: [TileType.ROCK, TileType.RUBBLE],
    iconText: 'M',
    cost: 25,
    yields: {
      default: { population: -2 },
      perTile: {
        [TileType.ROCK]: { materials: 6 },
        [TileType.RUBBLE]: { materials: 4 },
      },
    },
    tier: 2,
  },
};

export function getBuildTime(buildingType: BuildingType): number {
  const config = BUILDING_CONFIGS[buildingType];
  return config.buildTime ?? DEFAULT_BUILD_TIME_BY_TIER[config.tier] ?? 4;
}

export function getBuildingYields(buildingType: BuildingType, tileType: TileType): BuildingYields {
  const config = BUILDING_CONFIGS[buildingType];
  const base: BuildingYields = {
    food: 0,
    materials: 0,
    science: 0,
    population: 0,
    ...config.yields.default,
  };
  if (config.yields.perTile && config.yields.perTile[tileType]) {
    Object.assign(base, config.yields.perTile[tileType]);
  }
  return base;
}

// Formats non-zero yields as signed labels, e.g. ['🌾 +3', '👥 -1'].
// Callers join the parts however they need (', ' for summaries, ' ' inline).
export function formatYields(yields: BuildingYields): string[] {
  const parts: string[] = [];
  const add = (label: string, value: number) => {
    if (value) parts.push(`${label} ${value > 0 ? '+' : ''}${value}`);
  };
  add(ICONS.food, yields.food);
  add(ICONS.materials, yields.materials);
  add(ICONS.science, yields.science);
  add(ICONS.population, yields.population);
  return parts;
}

export interface BuildingInstance {
  id: string;
  buildingType: BuildingType;
  q: number;
  r: number;
  upgrades: UpgradeType[];
}
