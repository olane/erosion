export enum TileType {
  WATER,
  SHALLOW_WATER,
  BEACH,
  GRASS,
  FOREST,
  ROCK,
  RUBBLE,
}

export enum Zone {
  OCEAN,
  COAST,
  LOWLAND,
  HIGHLAND,
  PEAK,
}

export interface TileTypeConfig {
  name: string;
  color: number;
  erodible: boolean;
  erosionResistance: number;
  buildable: boolean;
  foodYield: number;
  materialYield: number;
}

export const TILE_CONFIGS: Record<TileType, TileTypeConfig> = {
  [TileType.WATER]: {
    name: 'Deep Water',
    color: 0x1a3a6b,
    erodible: false,
    erosionResistance: Infinity,
    buildable: false,
    foodYield: 0,
    materialYield: 0,
  },
  [TileType.SHALLOW_WATER]: {
    name: 'Shallow Water',
    color: 0x2b6ca3,
    erodible: false,
    erosionResistance: Infinity,
    buildable: false,
    foodYield: 1,
    materialYield: 0,
  },
  [TileType.BEACH]: {
    name: 'Beach',
    color: 0xd4c5a9,
    erodible: true,
    erosionResistance: 1,
    buildable: true,
    foodYield: 0,
    materialYield: 1,
  },
  [TileType.GRASS]: {
    name: 'Grassland',
    color: 0x4a8c3f,
    erodible: true,
    erosionResistance: 3,
    buildable: true,
    foodYield: 1,
    materialYield: 1,
  },
  [TileType.FOREST]: {
    name: 'Forest',
    color: 0x2d5a1e,
    erodible: true,
    erosionResistance: 4,
    buildable: true,
    foodYield: 0,
    materialYield: 3,
  },
  [TileType.ROCK]: {
    name: 'Rocky',
    color: 0x6b6b6b,
    erodible: true,
    erosionResistance: 8,
    buildable: true,
    foodYield: 0,
    materialYield: 2,
  },
  [TileType.RUBBLE]: {
    name: 'Rubble',
    color: 0x8b7355,
    erodible: true,
    erosionResistance: 2,
    buildable: true,
    foodYield: 0,
    materialYield: 2,
  },
};

export const EROSION_TRANSITION: Partial<Record<TileType, TileType>> = {
  [TileType.ROCK]: TileType.RUBBLE,
  [TileType.FOREST]: TileType.GRASS,
  [TileType.GRASS]: TileType.BEACH,
  [TileType.BEACH]: TileType.SHALLOW_WATER,
  [TileType.RUBBLE]: TileType.BEACH,
};

export const ZONE_TILES: Record<Zone, TileType[]> = {
  [Zone.OCEAN]: [TileType.WATER],
  [Zone.COAST]: [TileType.BEACH, TileType.SHALLOW_WATER],
  [Zone.LOWLAND]: [TileType.GRASS, TileType.FOREST],
  [Zone.HIGHLAND]: [TileType.ROCK, TileType.FOREST],
  [Zone.PEAK]: [TileType.ROCK],
};
