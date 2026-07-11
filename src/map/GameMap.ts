import Phaser from 'phaser';
import { hexKey, getNeighbors, hexDistance } from './HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
import { MAP_RADIUS, HEX_SIZE } from '../constants.ts';
import { MapRenderer } from './MapRenderer.ts';
import { MapGenerator } from './MapGenerator.ts';
import { BuildingManager } from '../systems/BuildingManager.ts';
import type { IResourceProvider } from '../systems/ResourceManager.ts';
import type { TileData } from './types.ts';

export type { TileData } from './types.ts';

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  renderer: MapRenderer;
  buildingManager: BuildingManager;
  onTileInspect: ((info: string | null) => void) | null = null;
  onBuildPreview: ((info: string | null) => void) | null = null;
  onBuildPlaced: (() => void) | null = null;
  onBuildingRemoved: (() => void) | null = null;
  onCannotAfford: ((cost: number) => void) | null = null;
  resourceProvider: IResourceProvider | null = null;

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

  private handleTileClick(q: number, r: number): void {
    if (this.buildMode && this.selectedBuildingType !== null) {
      this.tryPlaceBuilding(q, r);
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
    if (!this.buildMode || this.selectedBuildingType === null) return;
    const info = this.buildPreviewInfo(q, r);
    if (this.onBuildPreview) this.onBuildPreview(info);
  }

  private buildPreviewInfo(q: number, r: number): string {
    if (this.selectedBuildingType === null) return '';
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return '';
    const config = BUILDING_CONFIGS[this.selectedBuildingType];
    const blockReason = this.buildBlockReason(q, r);
    if (blockReason) {
      return `Cannot place ${config.name}: ${blockReason}`;
    }
    if (config.isWall) {
      const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : '';
      return `${config.name} — reduces erosion${costStr ? ` | ${costStr}` : ''}`;
    }
    const yields = getBuildingYields(this.selectedBuildingType, tile.tileType);
    const parts: string[] = [];
    if (yields.food) parts.push(`Food +${yields.food}`);
    if (yields.materials) parts.push(`Mat +${yields.materials}`);
    if (yields.science) parts.push(`Sci +${yields.science}`);
    const yieldStr = parts.length > 0 ? parts.join(', ') : 'no yield';
    const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : '';
    return `${config.name} — ${yieldStr}${costStr ? ` | ${costStr}` : ''}`;
  }

  private buildBlockReason(q: number, r: number): string | null {
    if (this.selectedBuildingType === null) return null;
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile) return 'out of bounds';
    const config = BUILDING_CONFIGS[this.selectedBuildingType];

    if (!TILE_CONFIGS[tile.tileType].buildable) return 'tile not buildable';
    if (!BUILDING_CONFIGS[this.selectedBuildingType].allowedTiles.includes(tile.tileType)) {
      return `requires ${config.allowedTiles.map((t) => TILE_CONFIGS[t].name).join(' or ')}`;
    }
    if (!config.isWall && tile.buildingId !== null) return 'already occupied';
    if (config.isWall && tile.seaWalled) return 'already sea-walled';
    if (!this.hasAdjacentBuilding(q, r)) return 'no adjacent building';
    if (config.requiresCoastal && !this.isCoastal(q, r)) return 'must be coastal';
    if (config.cost > 0 && this.resourceProvider && !this.resourceProvider.canAffordMaterials(config.cost)) {
      return `need ${config.cost} materials`;
    }
    if (config.popReq > 0 && this.resourceProvider && this.resourceProvider.getAvailablePopulation() < config.popReq) {
      return 'not enough population';
    }
    return null;
  }

  private tryPlaceBuilding(q: number, r: number): void {
    const tile = this.tiles.get(hexKey(q, r));
    if (!tile || this.selectedBuildingType === null) return;

    if (!this.hasAdjacentBuilding(q, r)) return;

    const config = BUILDING_CONFIGS[this.selectedBuildingType];
    if (config.cost > 0) {
      if (this.resourceProvider && !this.resourceProvider.canAffordMaterials(config.cost)) {
        if (this.onCannotAfford) this.onCannotAfford(config.cost);
        return;
      }
      if (this.resourceProvider) this.resourceProvider.spendMaterials(config.cost);
    }

    if (config.isWall) {
      tile.seaWalled = true;
      this.refreshTile(q, r);
      this.exitBuildMode();
      if (this.onBuildPlaced) this.onBuildPlaced();
      return;
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
    if (this.onTileInspect) this.onTileInspect(null);
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
    if (buildingConfig.isWall && tile.seaWalled) return false;
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
    const bldgString = building ? `  |  ${BUILDING_CONFIGS[building.buildingType].name}` : '';
    const tileName = tile.tileType === TileType.SAND ? (coastal ? 'Beach' : 'Desert') : config.name;
    let yieldStr = '';
    if (building) {
      const y = getBuildingYields(building.buildingType, tile.tileType);
      const parts: string[] = [];
      if (y.food) parts.push(`Food +${y.food}`);
      if (y.materials) parts.push(`Mat +${y.materials}`);
      if (y.science) parts.push(`Sci +${y.science}`);
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
