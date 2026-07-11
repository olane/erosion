import { TileType } from './tiles.ts';

export enum BuildingType {
  TOWN_HALL,
  FARM,
  QUARRY,
}

export interface BuildingTypeConfig {
  name: string;
  iconColor: number;
  iconShape: 'circle' | 'triangle' | 'square';
  allowedTiles: TileType[];
  iconText: string;
  tileYieldModifiers?: Partial<Record<TileType, { food?: number; material?: number }>>;
}

export const BUILDING_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  [BuildingType.TOWN_HALL]: {
    name: 'Town Hall',
    iconColor: 0xffaa44,
    iconShape: 'square',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.ROCK, TileType.RUBBLE, TileType.SAND],
    iconText: 'T',
  },
  [BuildingType.FARM]: {
    name: 'Farm',
    iconColor: 0x44cc44,
    iconShape: 'circle',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.SAND],
    iconText: 'F',
    tileYieldModifiers: {
      [TileType.SAND]: { food: -0.5 },
    },
  },
  [BuildingType.QUARRY]: {
    name: 'Quarry',
    iconColor: 0x999999,
    iconShape: 'triangle',
    allowedTiles: [TileType.ROCK, TileType.RUBBLE],
    iconText: 'Q',
  },
};

export interface BuildingInstance {
  id: string;
  buildingType: BuildingType;
  q: number;
  r: number;
}
