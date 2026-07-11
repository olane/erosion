import Phaser from 'phaser';
import { hexKey, getNeighbors } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import { MAP_RADIUS, HEX_SIZE } from '../constants.ts';
import { MapRenderer } from './MapRenderer.ts';
import { MapGenerator } from './MapGenerator.ts';
import { BuildingManager } from '../systems/BuildingManager.ts';
import type { TileData } from './types.ts';

export type { TileData } from './types.ts';

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  renderer: MapRenderer;
  buildingManager: BuildingManager;
  onTileSelect: ((info: string | null) => void) | null = null;
  onBuildPlaced: (() => void) | null = null;

  buildMode: boolean = false;
  selectedBuildingType: BuildingType | null = null;

  constructor(scene: Phaser.Scene) {
    this.buildingManager = new BuildingManager();

    this.renderer = new MapRenderer(
      scene,
      () => this.tiles,
      (tile) => this.buildingManager.getBuildingAt(tile.q, tile.r),
      (q, r) => this.canBuildAt(q, r),
    );
    this.renderer.onTileClick = (q, r) => this.handleTileClick(q, r);

    this.tiles = new MapGenerator().generate();
    this.renderer.render();
  }

  axialToWorld(q: number, r: number): { x: number; y: number } {
    return this.renderer.axialToWorld(q, r);
  }

  refreshTile(q: number, r: number): void {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return;
    this.renderer.refreshTile(tile);
  }

  getWaterNeighbors(q: number, r: number): TileData[] {
    const neighbors = getNeighbors(q, r);
    const result: TileData[] = [];
    for (const n of neighbors) {
      const tile = this.tiles.get(hexKey(n.q, n.r));
      if (
        tile &&
        (tile.tileType === TileType.WATER ||
          tile.tileType === TileType.SHALLOW_WATER)
      ) {
        result.push(tile);
      }
    }
    return result;
  }

  isCoastal(q: number, r: number): boolean {
    return this.getWaterNeighbors(q, r).length > 0;
  }

  private handleTileClick(q: number, r: number): void {
    if (this.buildMode && this.selectedBuildingType !== null) {
      this.tryPlaceBuilding(q, r);
      return;
    }

    if (this.renderer.isSelected(q, r)) {
      this.renderer.deselectTile();
      if (this.onTileSelect) this.onTileSelect(null);
      return;
    }

    this.renderer.selectTile(q, r);
    const info = this.buildTileInfo(q, r);
    if (this.onTileSelect) this.onTileSelect(info);
  }

  private tryPlaceBuilding(q: number, r: number): void {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile || this.selectedBuildingType === null) return;

    if (!this.hasAdjacentBuilding(q, r)) return;

    const result = this.buildingManager.placeBuilding(this.selectedBuildingType, tile);
    if (result !== null) {
      this.refreshTile(q, r);
      this.exitBuildMode();
      if (this.onBuildPlaced) this.onBuildPlaced();
    }
  }

  enterBuildMode(type: BuildingType): void {
    this.renderer.deselectTile();
    this.buildMode = true;
    this.selectedBuildingType = type;
    if (this.onTileSelect) this.onTileSelect(null);
  }

  exitBuildMode(): void {
    this.buildMode = false;
    this.selectedBuildingType = null;
  }

  hasAdjacentBuilding(q: number, r: number): boolean {
    const neighbors = getNeighbors(q, r);
    for (const n of neighbors) {
      const neighbor = this.tiles.get(hexKey(n.q, n.r));
      if (neighbor && neighbor.buildingId !== null) return true;
    }
    return false;
  }

  canBuildAt(q: number, r: number): boolean | null {
    if (!this.buildMode || this.selectedBuildingType === null) return null;
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return false;
    if (!this.buildingManager.canPlace(this.selectedBuildingType, tile)) return false;
    if (!this.hasAdjacentBuilding(q, r)) return false;
    return true;
  }

  // Pick a random inland tile that neighbors a coastal tile (one tile back from the sea).
  placeInitialTownHall(): void {
    const candidates: TileData[] = [];
    for (const [, tile] of this.tiles) {
      if (!this.buildingManager.canPlace(BuildingType.TOWN_HALL, tile)) continue;
      if (this.isCoastal(tile.q, tile.r)) continue;
      const neighbors = getNeighbors(tile.q, tile.r);
      if (neighbors.some((n) => this.isCoastal(n.q, n.r))) {
        candidates.push(tile);
      }
    }
    if (candidates.length === 0) return;

    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const result = this.buildingManager.placeBuilding(BuildingType.TOWN_HALL, tile);
    if (result !== null) {
      this.refreshTile(tile.q, tile.r);
    }
  }

  onBuildingLost(q: number, r: number): void {
    this.buildingManager.removeBuildingAt(q, r);
    this.refreshTile(q, r);
  }

  isBuildingCompatibleWithTile(q: number, r: number, newTileType: TileType): boolean {
    return this.buildingManager.isCompatibleWithTile(q, r, newTileType);
  }

  private buildTileInfo(q: number, r: number): string {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return '';
    const config = TILE_CONFIGS[tile.tileType];
    const coastal = this.isCoastal(q, r);
    const building = this.buildingManager.getBuildingAt(q, r);
    const bldgString = building
      ? `  |  ${BUILDING_CONFIGS[building.buildingType].name}`
      : '';
    const tileName =
      tile.tileType === TileType.SAND
        ? coastal
          ? 'Beach'
          : 'Desert'
        : config.name;
    return (
      `(${q},${r}) ${tileName}${bldgString}  |  ` +
      `Erosion ${tile.erosionProgress.toFixed(0)}%  |  ` +
      `${coastal ? 'Coastal' : 'Inland'}  |  ` +
      `Rate ${tile.erosionRate.toFixed(2)}x  |  ` +
      `Food ${config.foodYield}  Mat ${config.materialYield}`
    );
  }

  getSelectedTileInfo(): string | null {
    const coords = this.renderer.getSelectedCoords();
    if (!coords) return null;
    return this.buildTileInfo(coords.q, coords.r);
  }

  centerPosition(): { x: number; y: number } {
    return this.axialToWorld(0, 0);
  }

  worldPixelBounds(): { x: number; y: number; width: number; height: number } {
    const toWorld = (q: number, r: number) => this.axialToWorld(q, r);
    const corners = [
      toWorld(-MAP_RADIUS, 0),
      toWorld(MAP_RADIUS, 0),
      toWorld(0, -MAP_RADIUS),
      toWorld(0, MAP_RADIUS),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const pad = HEX_SIZE * 2;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
