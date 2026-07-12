import type { BuildingType } from '../data/buildings.ts';

export interface YieldBreakdown {
  food: number;
  materials: number;
  science: number;
  population: number;
}

export interface BuildOption {
  buildingType: BuildingType;
  name: string;
  iconColor: number;
  iconShape: 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon';
  cost: number;
  canAfford: boolean;
  yields: YieldBreakdown;
  allowed: boolean;
  blockReason: string | null;
}

export interface TileIcon {
  q: number;
  r: number;
  text: string;
  color: number;
  bgColor: number;
  size?: 'small' | 'medium';
}
