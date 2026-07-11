import Phaser from 'phaser';
import { hexKey, getNeighbors, hexDistance } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
import { MAP_RADIUS, HEX_SIZE } from '../constants.ts';
import { MapRenderer } from './MapRenderer.ts';
import { MapGenerator } from './MapGenerator.ts';
import { BuildingManager } from '../systems/BuildingManager.ts';
import type { IResourceProvider } from '../systems/ResourceManager.ts';
import type { BuildController } from '../systems/BuildController.ts';
import type { TileData } from './types.ts';

export type { TileData } from './types.ts';

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  renderer: MapRenderer;
  buildingManager: BuildingManager;
  buildController: BuildController | null = null;
  resourceProvider: IResourceProvider | null = null;

  onTileInspect: ((info: string | null) => void) | null = null;
  onBuildingRemoved: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.buildingManager = new BuildingManager();

    this.renderer = new MapRenderer(
      scene,
      () => this.tiles,
      (tile) => this.buildingManager.getBuildingAt(tile.q, tile.r),
      (q, r) => this.canBuildAt(q, r),
    );
    this.renderer.onTileClick = (q, r) => this.handleTileClick(q, r);
    this.renderer.onTileHover = (q, r) => this.handleTileHover(q, r);

    let attempts = 0;
    let candidates: TileData[] = [];
    do {
      this.tiles = new MapGenerator().generate();
      candidates = this.findTownHallCandidates();
      attempts++;
    } while (candidates.length === 0 && attempts < 100);

    this.renderer.render();

    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const result = this.buildingManager.placeBuilding(BuildingType.TOWN_HALL, tile);
    if (result !== null) {
      this.refreshTile(tile.q, tile.r);
    }
  }

  axialToWorld(q: number, r: number): { x: number; y: number } {
    return this.renderer.axialToWorld(q, r);
  }

  refreshTile(q: number, r: number): void {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return;
    this.renderer.refreshTile(tile);
  }

  applyErosion(tile: TileData, progress: number): void {
    tile.erosionProgress += progress;
    this.refreshTile(tile.q, tile.r);
  }

  transitionTile(q: number, r: number, newType: TileType): void {
    const tile = this.tiles.get(`${q},${r}`);
    if (!tile) return;

    tile.tileType = newType;
    tile.erosionProgress = 0;
    tile.seaWalled = false;

    if (tile.buildingId !== null) {
      if (!this.buildingManager.isCompatibleWithTile(q, r, newType)) {
        tile.buildingId = null;
        this.onBuildingLost(q, r);
      }
    }

    this.refreshTile(q, r);
  }

  getWaterNeighbors(q: number, r: number): TileData[] {
    const neighbors = getNeighbors(q, r);
    const result: TileData[] = [];
    for (const n of neighbors) {
      const tile = this.tiles.get(hexKey(n.q, n.r));
      if (tile && (tile.tileType === TileType.WATER || tile.tileType === TileType.SHALLOW_WATER)) {
        result.push(tile);
      }
    }
    return result;
  }

  isCoastal(q: number, r: number): boolean {
    return this.getWaterNeighbors(q, r).length > 0;
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
    if (!this.buildController) return null;
    return this.buildController.canBuildAt(q, r);
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

  private handleTileClick(q: number, r: number): void {
    if (
      this.buildController &&
      this.buildController.buildMode &&
      this.buildController.selectedType !== null
    ) {
      this.buildController.tryPlaceBuilding(q, r);
      return;
    }

    if (this.renderer.isSelected(q, r)) {
      this.renderer.deselectTile();
      if (this.onTileInspect) this.onTileInspect(null);
      return;
    }

    this.renderer.selectTile(q, r);
    const info = this.buildTileInfo(q, r);
    if (this.onTileInspect) this.onTileInspect(info);
  }

  private handleTileHover(q: number, r: number): void {
    if (
      !this.buildController ||
      !this.buildController.buildMode ||
      this.buildController.selectedType === null
    ) {
      return;
    }
    const info = this.buildController.buildPreviewInfo(q, r);
    if (this.buildController.onBuildPreview) this.buildController.onBuildPreview(info);
  }

  private buildTileInfo(q: number, r: number): string {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return '';
    const config = TILE_CONFIGS[tile.tileType];
    const coastal = this.isCoastal(q, r);
    const building = this.buildingManager.getBuildingAt(q, r);
    const bldgString = building ? `  |  ${BUILDING_CONFIGS[building.buildingType].name}` : '';
    const tileName = tile.tileType === TileType.SAND ? (coastal ? 'Beach' : 'Desert') : config.name;
    let yieldStr = '';
    if (building) {
      const y = getBuildingYields(building.buildingType, tile.tileType);
      const parts: string[] = [];
      if (y.food) parts.push(`Food ${y.food > 0 ? '+' : ''}${y.food}`);
      if (y.materials) parts.push(`Mat ${y.materials > 0 ? '+' : ''}${y.materials}`);
      if (y.science) parts.push(`Sci ${y.science > 0 ? '+' : ''}${y.science}`);
      if (y.population) parts.push(`Pop ${y.population > 0 ? '+' : ''}${y.population}`);
      if (parts.length) yieldStr = ` | ${parts.join(' ')}`;
    }
    const wallStr = tile.seaWalled ? ' | Sea Walled' : '';
    return (
      `(${q},${r}) ${tileName}${bldgString}${wallStr}${yieldStr}  |  ` +
      `Erosion ${tile.erosionProgress.toFixed(0)}%  |  ` +
      `${coastal ? 'Coastal' : 'Inland'}  |  ` +
      `Rate ${tile.erosionRate.toFixed(2)}x`
    );
  }

  private hasForestNearby(q: number, r: number): boolean {
    for (const [, t] of this.tiles) {
      if (t.tileType === TileType.FOREST && hexDistance({ q, r }, { q: t.q, r: t.r }) <= 2) {
        return true;
      }
    }
    return false;
  }

  private findTownHallCandidates(): TileData[] {
    const candidates: TileData[] = [];
    for (const [, tile] of this.tiles) {
      if (!this.buildingManager.canPlace(BuildingType.TOWN_HALL, tile)) continue;
      if (this.isCoastal(tile.q, tile.r)) continue;
      const neighbors = getNeighbors(tile.q, tile.r);
      if (!neighbors.some((n) => this.isCoastal(n.q, n.r))) continue;
      if (!this.hasForestNearby(tile.q, tile.r)) continue;
      candidates.push(tile);
    }
    return candidates;
  }
}
