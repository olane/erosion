import Phaser from 'phaser';
import { hexKey, getNeighbors, hexDistance } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
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
  onBuildingRemoved: (() => void) | null = null;
  onCannotAfford: ((cost: number) => void) | null = null;
  canAfford: ((materials: number) => boolean) | null = null;
  spendMaterials: ((amount: number) => boolean) | null = null;

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

    let attempts = 0;
    do {
      this.tiles = new MapGenerator().generate();
      attempts++;
    } while (!this.canPlaceInitialTownHall() && attempts < 100);

    this.renderer.render();
    this.placeInitialTownHall();
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

    const config = BUILDING_CONFIGS[this.selectedBuildingType];
    if (config.cost > 0) {
      if (this.canAfford && !this.canAfford(config.cost)) {
        if (this.onCannotAfford) this.onCannotAfford(config.cost);
        return;
      }
      if (this.spendMaterials) this.spendMaterials(config.cost);
    }

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
    const buildingConfig = BUILDING_CONFIGS[this.selectedBuildingType];
    if (buildingConfig.requiresCoastal && !this.isCoastal(q, r)) return false;
    return true;
  }

  private hasForestNearby(q: number, r: number): boolean {
    for (const [, t] of this.tiles) {
      if (t.tileType === TileType.FOREST && hexDistance({ q, r }, { q: t.q, r: t.r }) <= 2) {
        return true;
      }
    }
    return false;
  }

  private canPlaceInitialTownHall(): boolean {
    for (const [, tile] of this.tiles) {
      if (!this.buildingManager.canPlace(BuildingType.TOWN_HALL, tile)) continue;
      if (this.isCoastal(tile.q, tile.r)) continue;
      const neighbors = getNeighbors(tile.q, tile.r);
      if (!neighbors.some((n) => this.isCoastal(n.q, n.r))) continue;
      if (!this.hasForestNearby(tile.q, tile.r)) continue;
      return true;
    }
    return false;
  }

  // Pick a random inland tile that neighbors a coastal tile and is within 2 hexes of a Forest.
  private placeInitialTownHall(): void {
    const candidates: TileData[] = [];
    for (const [, tile] of this.tiles) {
      if (!this.buildingManager.canPlace(BuildingType.TOWN_HALL, tile)) continue;
      if (this.isCoastal(tile.q, tile.r)) continue;
      const neighbors = getNeighbors(tile.q, tile.r);
      if (!neighbors.some((n) => this.isCoastal(n.q, n.r))) continue;
      if (!this.hasForestNearby(tile.q, tile.r)) continue;
      candidates.push(tile);
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
    if (this.onBuildingRemoved) this.onBuildingRemoved();
  }

  isBuildingCompatibleWithTile(q: number, r: number, newTileType: TileType): boolean {
    return this.buildingManager.isCompatibleWithTile(q, r, newTileType);
  }

  getBuildingTypeAt(q: number, r: number): BuildingType | null {
    return this.buildingManager.getBuildingTypeAt(q, r);
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
    let yieldStr = '';
    if (building) {
      const y = getBuildingYields(building.buildingType, tile.tileType);
      const parts: string[] = [];
      if (y.food) parts.push(`Food +${y.food}`);
      if (y.materials) parts.push(`Mat +${y.materials}`);
      if (y.science) parts.push(`Sci +${y.science}`);
      if (parts.length) yieldStr = ` | ${parts.join(' ')}`;
    }
    return (
      `(${q},${r}) ${tileName}${bldgString}${yieldStr}  |  ` +
      `Erosion ${tile.erosionProgress.toFixed(0)}%  |  ` +
      `${coastal ? 'Coastal' : 'Inland'}  |  ` +
      `Rate ${tile.erosionRate.toFixed(2)}x`
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
