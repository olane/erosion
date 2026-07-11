import { TileType } from './tiles.ts';

export enum BuildingType {
  FARM,
  QUARRY,
}

export interface BuildingTypeConfig {
  name: string;
  iconColor: number;
  iconShape: 'circle' | 'triangle';
  allowedTiles: TileType[];
  iconText: string;
  tileYieldModifiers?: Partial<Record<TileType, { food?: number; material?: number }>>;
}

export const BUILDING_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  [BuildingType.FARM]: {
    name: 'Farm',
    iconColor: 0x44cc44,
    iconShape: 'circle',
    allowedTiles: [TileType.GRASS, TileType.FOREST, TileType.BEACH],
    iconText: 'F',
    tileYieldModifiers: {
      [TileType.BEACH]: { food: -0.5 },
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
