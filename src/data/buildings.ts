import { TileType } from './tiles.ts';

export enum BuildingType {
  TOWN_HALL,
  FARM,
  QUARRY,
  LUMBER_CAMP,
  FISHING_DOCK,
  HOUSE,
  SEA_WALL,
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
}

export interface BuildingTypeConfig {
  name: string;
  iconColor: number;
  iconShape: 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon';
  allowedTiles: TileType[];
  iconText: string;
  cost: number;
  popReq: number;
  popCap: number;
  storageFood?: number;
  storageMat?: number;
  yields: {
    default: Partial<BuildingYields>;
    perTile?: Partial<Record<TileType, Partial<BuildingYields>>>;
  };
  requiresCoastal?: boolean;
  tier: number;
}

export const BUILDING_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  [BuildingType.TOWN_HALL]: {
    name: 'Town Hall',
    iconColor: 0xffaa44,
    iconShape: 'square',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'T',
    cost: 0,
    popReq: 0,
    popCap: 5,
    storageFood: 100,
    storageMat: 100,
      yields: { default: { materials: 1, science: 1 } },
    tier: 0,
  },
  [BuildingType.FARM]: {
    name: 'Farm',
    iconColor: 0x44cc44,
    iconShape: 'circle',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.SAND],
    iconText: 'F',
    cost: 10,
    popReq: 1,
    popCap: 0,
    yields: {
      default: {},
      perTile: {
        [TileType.GRASS]: { food: 3 },
        [TileType.FOREST]: { food: 1 },
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
    popReq: 1,
    popCap: 0,
    yields: {
      default: {},
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
    popReq: 1,
    popCap: 0,
    yields: {
      default: {},
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
    popReq: 1,
    popCap: 0,
    yields: {
      default: {},
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
    popReq: 0,
    popCap: 5,
    yields: { default: {} },
    tier: 0,
  },
  [BuildingType.SEA_WALL]: {
    name: 'Sea Wall',
    iconColor: 0x8888cc,
    iconShape: 'hexagon',
    allowedTiles: [TileType.SAND, TileType.GRASS],
    iconText: 'W',
    cost: 20,
    popReq: 1,
    popCap: 0,
    yields: { default: {} },
    requiresCoastal: true,
    tier: 1,
  },
  [BuildingType.WORKSHOP]: {
    name: 'Workshop',
    iconColor: 0xcccc44,
    iconShape: 'diamond',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'S',
    cost: 20,
    popReq: 2,
    popCap: 0,
    yields: { default: { science: 2 } },
    tier: 1,
  },
  [BuildingType.WAREHOUSE]: {
    name: 'Warehouse',
    iconColor: 0xaa8844,
    iconShape: 'diamond',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'R',
    cost: 15,
    popReq: 1,
    popCap: 0,
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
    popReq: 2,
    popCap: 0,
    yields: { default: {} },
    tier: 2,
  },
  [BuildingType.ADVANCED_FARM]: {
    name: 'Advanced Farm',
    iconColor: 0x22aa22,
    iconShape: 'circle',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.SAND],
    iconText: 'A',
    cost: 25,
    popReq: 2,
    popCap: 0,
    yields: {
      default: {},
      perTile: {
        [TileType.GRASS]: { food: 5 },
        [TileType.FOREST]: { food: 2 },
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
    popReq: 2,
    popCap: 0,
    yields: {
      default: {},
      perTile: {
        [TileType.ROCK]: { materials: 6 },
        [TileType.RUBBLE]: { materials: 4 },
      },
    },
    tier: 2,
  },
};

export function getBuildingYields(buildingType: BuildingType, tileType: TileType): BuildingYields {
  const config = BUILDING_CONFIGS[buildingType];
  const base: BuildingYields = {
    food: 0,
    materials: 0,
    science: 0,
    ...config.yields.default,
  };
  if (config.yields.perTile && config.yields.perTile[tileType]) {
    Object.assign(base, config.yields.perTile[tileType]);
  }
  return base;
}

export interface BuildingInstance {
  id: string;
  buildingType: BuildingType;
  q: number;
  r: number;
  disabled: boolean;
}
