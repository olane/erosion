import type Phaser from 'phaser';
import type { TileType } from '../data/tiles.ts';

export interface TileData {
  q: number;
  r: number;
  tileType: TileType;
  noiseValue: number;
  erosionProgress: number;
  erosionRate: number;
  buildingId: string | null;
  seaWalled: boolean;
  graphics: Phaser.GameObjects.Graphics;
}
