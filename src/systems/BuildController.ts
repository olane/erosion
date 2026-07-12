import { hexKey } from '../map/HexUtils.ts';
import { TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildTime } from '../data/buildings.ts';
import { UpgradeType, UPGRADE_CONFIGS, upgradeAppliesTo } from '../data/upgrades.ts';
import type { BuildingManager } from './BuildingManager.ts';
import type { ConstructionSystem } from './ConstructionSystem.ts';
import type { IResourceProvider } from './ResourceManager.ts';
import type { TileData } from '../map/types.ts';

// A single choice offered in a tile-locked action session. Build sessions offer
// buildings to place; upgrade sessions offer upgrades to apply to a building.
export type ActionOption =
  { kind: 'build'; building: BuildingType } | { kind: 'upgrade'; upgrade: UpgradeType };

export class BuildController {
  // Options for the current session, cycled through by the player, plus the
  // tile the session is locked to. Empty/null when no session is active.
  private _options: ActionOption[] = [];
  private _index = 0;
  private _buildTile: { q: number; r: number } | null = null;

  get active(): boolean {
    return this._buildTile !== null;
  }
  get buildTile(): { q: number; r: number } | null {
    return this._buildTile;
  }
  get current(): ActionOption | null {
    return this._buildTile !== null ? (this._options[this._index] ?? null) : null;
  }

  private tiles: () => Map<string, TileData>;
  private buildingManager: BuildingManager;
  private construction: ConstructionSystem;
  private resourceProvider: IResourceProvider | null;
  private hasAdjacentBuilding: (q: number, r: number) => boolean;
  private isCoastal: (q: number, r: number) => boolean;
  private getAvailableTypes: () => BuildingType[];
  private getAvailableUpgrades: (q: number, r: number) => UpgradeType[];
  private refreshTile: (q: number, r: number) => void;

  onChanged: (() => void) | null = null;
  // Fires when a building is placed or an upgrade applied (i.e. on completion of
  // a construction job), so dependent systems (e.g. storage caps) can refresh.
  onBuildPlaced: (() => void) | null = null;

  constructor(
    tiles: () => Map<string, TileData>,
    buildingManager: BuildingManager,
    construction: ConstructionSystem,
    resourceProvider: IResourceProvider | null,
    hasAdjacentBuilding: (q: number, r: number) => boolean,
    isCoastal: (q: number, r: number) => boolean,
    getAvailableTypes: () => BuildingType[],
    getAvailableUpgrades: (q: number, r: number) => UpgradeType[],
    refreshTile: (q: number, r: number) => void,
  ) {
    this.tiles = tiles;
    this.buildingManager = buildingManager;
    this.construction = construction;
    this.resourceProvider = resourceProvider;
    this.hasAdjacentBuilding = hasAdjacentBuilding;
    this.isCoastal = isCoastal;
    this.getAvailableTypes = getAvailableTypes;
    this.getAvailableUpgrades = getAvailableUpgrades;
    this.refreshTile = refreshTile;
  }

  // Enter build mode locked to a single tile. The player then cycles through
  // the available building types (seeing a ghost + validity on this tile) and
  // confirms one to place. Returns false if the tile can't host a build.
  enterBuildModeAt(q: number, r: number): boolean {
    if (!this.hasAdjacentBuilding(q, r)) return false;
    const available = this.getAvailableTypes();
    if (available.length === 0) return false;

    this.startSession(
      q,
      r,
      available.map((building) => ({ kind: 'build', building })),
    );
    return true;
  }

  // Enter upgrade mode locked to a tile with a building. The player cycles
  // through the upgrades applicable to that building and confirms one to apply.
  // Returns false if there is no building or no upgrades are available.
  enterUpgradeModeAt(q: number, r: number): boolean {
    const available = this.getAvailableUpgrades(q, r);
    if (available.length === 0) return false;

    this.startSession(
      q,
      r,
      available.map((upgrade) => ({ kind: 'upgrade', upgrade })),
    );
    return true;
  }

  private startSession(q: number, r: number, options: ActionOption[]): void {
    this._buildTile = { q, r };
    this._options = options;
    this._index = 0;
    if (this.onChanged) this.onChanged();
  }

  cycle(dir: number): void {
    if (!this.active || this._options.length === 0) return;
    const n = this._options.length;
    this._index = (((this._index + dir) % n) + n) % n;
    if (this.onChanged) this.onChanged();
  }

  // Start construction of the currently-selected option on the locked tile.
  // Materials are spent now; the building is placed (or upgrade applied) once the
  // construction job finishes. Exits the session on success. Returns false (and
  // stays active) if the action is invalid.
  confirm(): boolean {
    const option = this.current;
    if (!this._buildTile || !option) return false;
    const { q, r } = this._buildTile;
    const ok =
      option.kind === 'build'
        ? this.startBuild(q, r, option.building)
        : this.startUpgrade(q, r, option.upgrade);
    if (ok) this.cancel();
    return ok;
  }

  cancel(): void {
    this._buildTile = null;
    this._options = [];
    this._index = 0;
    if (this.onChanged) this.onChanged();
  }

  canConfirmAt(q: number, r: number): boolean | null {
    const option = this.current;
    if (option === null) return null;
    // Sessions are locked to a single tile, so only that tile has a meaningful
    // valid/invalid state (used for the hover highlight and ghost tint).
    if (this._buildTile && (this._buildTile.q !== q || this._buildTile.r !== r)) return null;
    return this.actionError(option, q, r) === null;
  }

  blockReason(q: number, r: number): string | null {
    const option = this.current;
    if (option === null) return null;
    return this.actionError(option, q, r);
  }

  private actionError(option: ActionOption, q: number, r: number): string | null {
    return option.kind === 'build'
      ? this.placementError(q, r, option.building)
      : this.upgradeError(q, r, option.upgrade);
  }

  // Single source of truth for build placement rules. Returns null if `type`
  // can be placed on (q, r), otherwise a human-readable reason it can't.
  private placementError(q: number, r: number, type: BuildingType): string | null {
    const tile = this.tiles().get(hexKey(q, r));
    if (!tile) return 'out of bounds';
    const config = BUILDING_CONFIGS[type];

    if (!TILE_CONFIGS[tile.tileType].buildable) return 'tile not buildable';
    if (!config.allowedTiles.includes(tile.tileType)) {
      return `requires ${config.allowedTiles.map((t) => TILE_CONFIGS[t].name).join(' or ')}`;
    }
    if (tile.buildingId !== null) return 'already occupied';
    if (this.construction.hasBuildJobAt(q, r)) return 'under construction';
    if (!this.hasAdjacentBuilding(q, r)) return 'no adjacent building';
    if (config.requiresCoastal && !this.isCoastal(q, r)) return 'must be coastal';
    if (config.cost > 0 && !this.canAfford(config.cost)) {
      return `need ${config.cost} materials`;
    }
    return null;
  }

  // Single source of truth for upgrade rules. Returns null if `upgrade` can be
  // applied to the building on (q, r), otherwise a human-readable reason.
  private upgradeError(q: number, r: number, upgrade: UpgradeType): string | null {
    const building = this.buildingManager.getBuildingAt(q, r);
    if (!building) return 'no building';
    const config = UPGRADE_CONFIGS[upgrade];

    if (!upgradeAppliesTo(upgrade, building.buildingType)) return 'not applicable';
    if (building.upgrades.includes(upgrade)) return 'already applied';
    if (config.requiresCoastal && !this.isCoastal(q, r)) return 'must be coastal';
    if (config.cost > 0 && !this.canAfford(config.cost)) {
      return `need ${config.cost} materials`;
    }
    return null;
  }

  private canAfford(cost: number): boolean {
    return !this.resourceProvider || this.resourceProvider.canAffordMaterials(cost);
  }

  private startBuild(q: number, r: number, buildingType: BuildingType): boolean {
    if (this.placementError(q, r, buildingType) !== null) return false;
    const config = BUILDING_CONFIGS[buildingType];

    if (config.cost > 0) {
      this.resourceProvider!.spendMaterials(config.cost);
    }

    this.construction.start({
      q,
      r,
      kind: 'build',
      buildingType,
      totalTime: getBuildTime(buildingType),
      onComplete: () => {
        const tile = this.tiles().get(hexKey(q, r));
        if (tile) this.buildingManager.placeBuilding(buildingType, tile);
        this.refreshTile(q, r);
        if (this.onBuildPlaced) this.onBuildPlaced();
      },
    });
    return true;
  }

  private startUpgrade(q: number, r: number, upgrade: UpgradeType): boolean {
    if (this.upgradeError(q, r, upgrade) !== null) return false;
    const config = UPGRADE_CONFIGS[upgrade];

    if (config.cost > 0) {
      this.resourceProvider!.spendMaterials(config.cost);
    }

    this.construction.start({
      q,
      r,
      kind: 'upgrade',
      upgradeType: upgrade,
      totalTime: config.buildTime,
      onComplete: () => {
        this.buildingManager.applyUpgrade(q, r, upgrade);
        this.refreshTile(q, r);
        if (this.onBuildPlaced) this.onBuildPlaced();
      },
    });
    return true;
  }
}
