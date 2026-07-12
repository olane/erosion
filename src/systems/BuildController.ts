import { hexKey } from '../map/HexUtils.ts';
import { TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import type { BuildingManager } from './BuildingManager.ts';
import type { IResourceProvider } from './ResourceManager.ts';
import type { TileData } from '../map/types.ts';

export class BuildController {
  private _buildMode = false;
  private _selectedType: BuildingType | null = null;
  private _buildTile: { q: number; r: number } | null = null;

  get buildMode(): boolean {
    return this._buildMode;
  }
  get selectedType(): BuildingType | null {
    return this._selectedType;
  }
  get buildTile(): { q: number; r: number } | null {
    return this._buildTile;
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

  // Enter build mode locked to a single tile. The player then cycles through
  // the available building types (seeing a ghost + validity on this tile) and
  // confirms one to place. Returns false if the tile can't host a build.
  enterBuildModeAt(q: number, r: number): boolean {
    if (!this.hasAdjacentBuilding(q, r)) return false;
    const available = this.getAvailableTypes();
    if (available.length === 0) return false;

    this._buildMode = true;
    this._buildTile = { q, r };
    this._selectedType = available[0];
    if (this.onChanged) this.onChanged();
    return true;
  }

  cycle(dir: number): void {
    if (!this._buildMode || this._selectedType === null) return;
    const available = this.getAvailableTypes();
    if (available.length === 0) return;
    const n = available.length;
    const idx = available.indexOf(this._selectedType);
    this._selectedType = available[(((idx + dir) % n) + n) % n];
    if (this.onChanged) this.onChanged();
  }

  // Place the currently-selected building on the locked tile. Exits build mode
  // on success. Returns false (and stays in build mode) if placement is invalid.
  confirm(): boolean {
    if (!this._buildTile || this._selectedType === null) return false;
    const { q, r } = this._buildTile;
    const ok = this.placeBuildingAt(q, r, this._selectedType);
    if (ok) this.cancel();
    return ok;
  }

  cancel(): void {
    this._buildMode = false;
    this._selectedType = null;
    this._buildTile = null;
    if (this.onChanged) this.onChanged();
  }

  canBuildAt(q: number, r: number): boolean | null {
    if (!this._buildMode || this._selectedType === null) return null;
    // Build mode is locked to a single tile, so only that tile has a meaningful
    // valid/invalid state (used for the hover highlight and ghost tint).
    if (this._buildTile && (this._buildTile.q !== q || this._buildTile.r !== r)) return null;
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
}
