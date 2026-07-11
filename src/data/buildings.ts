import { TileType } from './tiles.ts';

export enum BuildingType {
  TOWN_HALL,
  FARM,
  QUARRY,
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
    yields: {
      default: { science: 1 },
    },
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
