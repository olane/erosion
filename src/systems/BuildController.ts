import { hexKey } from '../map/HexUtils.ts';
import { TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
import type { BuildingManager } from './BuildingManager.ts';
import type { IResourceProvider } from './ResourceManager.ts';
import type { TileData } from '../map/types.ts';

export class BuildController {
  private _buildMode = false;
  private _selectedType: BuildingType | null = null;

  get buildMode(): boolean {
    return this._buildMode;
  }
  get selectedType(): BuildingType | null {
    return this._selectedType;
  }

  private tiles: () => Map<string, TileData>;
  private buildingManager: BuildingManager;
  private resourceProvider: IResourceProvider | null;
  private hasAdjacentBuilding: (q: number, r: number) => boolean;
  private isCoastal: (q: number, r: number) => boolean;
  private getAvailableTypes: () => BuildingType[];
  private refreshTile: (q: number, r: number) => void;

  onChanged: (() => void) | null = null;
  onBuildPlaced: (() => void) | null = null;
  onBuildPreview: ((info: string | null) => void) | null = null;

  constructor(
    tiles: () => Map<string, TileData>,
    buildingManager: BuildingManager,
    resourceProvider: IResourceProvider | null,
    hasAdjacentBuilding: (q: number, r: number) => boolean,
    isCoastal: (q: number, r: number) => boolean,
    getAvailableTypes: () => BuildingType[],
    refreshTile: (q: number, r: number) => void,
  ) {
    this.tiles = tiles;
    this.buildingManager = buildingManager;
    this.resourceProvider = resourceProvider;
    this.hasAdjacentBuilding = hasAdjacentBuilding;
    this.isCoastal = isCoastal;
    this.getAvailableTypes = getAvailableTypes;
    this.refreshTile = refreshTile;
  }

  toggleOrCycle(): void {
    const available = this.getAvailableTypes();
    if (available.length === 0) return;

    if (this._buildMode && this._selectedType !== null) {
      const idx = available.indexOf(this._selectedType);
      this._selectedType = available[(idx + 1) % available.length];
    } else {
      this._buildMode = true;
      this._selectedType = available[0];
    }
    if (this.onChanged) this.onChanged();
  }

  cancel(): void {
    this._buildMode = false;
    this._selectedType = null;
    if (this.onChanged) this.onChanged();
  }

  canBuildAt(q: number, r: number): boolean | null {
    if (!this._buildMode || this._selectedType === null) return null;
    const tile = this.tiles().get(hexKey(q, r));
    if (!tile) return false;
    if (!this.buildingManager.canPlace(this._selectedType, tile)) return false;
    if (!this.hasAdjacentBuilding(q, r)) return false;
    const buildingConfig = BUILDING_CONFIGS[this._selectedType];
    if (buildingConfig.isWall && tile.seaWalled) return false;
    if (buildingConfig.requiresCoastal && !this.isCoastal(q, r)) return false;
    if (
      buildingConfig.cost > 0 &&
      this.resourceProvider &&
      !this.resourceProvider.canAffordMaterials(buildingConfig.cost)
    ) {
      return false;
    }
    return true;
  }

  buildBlockReason(q: number, r: number): string | null {
    if (this._selectedType === null) return null;
    const tile = this.tiles().get(hexKey(q, r));
    if (!tile) return 'out of bounds';
    const config = BUILDING_CONFIGS[this._selectedType];

    if (!TILE_CONFIGS[tile.tileType].buildable) return 'tile not buildable';
    if (!BUILDING_CONFIGS[this._selectedType].allowedTiles.includes(tile.tileType)) {
      return `requires ${config.allowedTiles.map((t) => TILE_CONFIGS[t].name).join(' or ')}`;
    }
    if (!config.isWall && tile.buildingId !== null) return 'already occupied';
    if (config.isWall && tile.seaWalled) return 'already sea-walled';
    if (!this.hasAdjacentBuilding(q, r)) return 'no adjacent building';
    if (config.requiresCoastal && !this.isCoastal(q, r)) return 'must be coastal';
    if (
      config.cost > 0 &&
      this.resourceProvider &&
      !this.resourceProvider.canAffordMaterials(config.cost)
    ) {
      return `need ${config.cost} materials`;
    }
    return null;
  }

  buildPreviewInfo(q: number, r: number): string {
    if (this._selectedType === null) return '';
    const tile = this.tiles().get(hexKey(q, r));
    if (!tile) return '';
    const config = BUILDING_CONFIGS[this._selectedType];
    const blockReason = this.buildBlockReason(q, r);
    if (blockReason) {
      return `Cannot place ${config.name}: ${blockReason}`;
    }
    if (config.isWall) {
      const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : '';
      return `${config.name} — reduces erosion${costStr ? ` | ${costStr}` : ''}`;
    }
    const yields = getBuildingYields(this._selectedType, tile.tileType);
    const parts: string[] = [];
    if (yields.food) parts.push(`Food ${yields.food > 0 ? '+' : ''}${yields.food}`);
    if (yields.materials) parts.push(`Mat ${yields.materials > 0 ? '+' : ''}${yields.materials}`);
    if (yields.science) parts.push(`Sci ${yields.science > 0 ? '+' : ''}${yields.science}`);
    if (yields.population) parts.push(`Pop ${yields.population > 0 ? '+' : ''}${yields.population}`);
    const yieldStr = parts.length > 0 ? parts.join(', ') : 'no yield';
    const costStr = config.cost > 0 ? `Cost: ${config.cost} mat` : '';
    return `${config.name} — ${yieldStr}${costStr ? ` | ${costStr}` : ''}`;
  }

  placeBuildingAt(q: number, r: number, buildingType: BuildingType): boolean {
    const tile = this.tiles().get(hexKey(q, r));
    if (!tile) return false;

    if (!this.hasAdjacentBuilding(q, r)) return false;

    const config = BUILDING_CONFIGS[buildingType];
    if (!this.buildingManager.canPlace(buildingType, tile)) return false;
    if (config.isWall && tile.seaWalled) return false;
    if (config.requiresCoastal && !this.isCoastal(q, r)) return false;
    if (config.cost > 0 && this.resourceProvider && !this.resourceProvider.canAffordMaterials(config.cost)) return false;

    if (config.cost > 0) {
      this.resourceProvider!.spendMaterials(config.cost);
    }

    if (config.isWall) {
      tile.seaWalled = true;
    } else {
      this.buildingManager.placeBuilding(buildingType, tile);
    }

    this.refreshTile(q, r);
    if (this.onBuildPlaced) this.onBuildPlaced();
    return true;
  }

  tryPlaceBuilding(q: number, r: number): void {
    const tile = this.tiles().get(hexKey(q, r));
    if (!tile || this._selectedType === null) return;

    if (!this.hasAdjacentBuilding(q, r)) return;

    const config = BUILDING_CONFIGS[this._selectedType];
    if (config.cost > 0) {
      if (this.resourceProvider && !this.resourceProvider.canAffordMaterials(config.cost)) {
        return;
      }
      if (this.resourceProvider) this.resourceProvider.spendMaterials(config.cost);
    }

    if (config.isWall) {
      tile.seaWalled = true;
      this.refreshTile(q, r);
      this.cancel();
      if (this.onBuildPlaced) this.onBuildPlaced();
      return;
    }

    const result = this.buildingManager.placeBuilding(this._selectedType, tile);
    if (result !== null) {
      this.refreshTile(q, r);
      this.cancel();
      if (this.onBuildPlaced) this.onBuildPlaced();
    }
  }
}
