import { hexKey } from '../map/HexUtils.ts';
import { TileType, TILE_CONFIGS } from '../data/tiles.ts';
import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import type { BuildingInstance } from '../data/buildings.ts';
import type { TileData } from '../map/types.ts';

export class BuildingManager {
  buildings: Map<string, BuildingInstance> = new Map();
  private nextId: number = 0;

  static isTileAllowed(type: BuildingType, tileType: TileType): boolean {
    return BUILDING_CONFIGS[type].allowedTiles.includes(tileType);
  }

  canPlace(type: BuildingType, tile: TileData): boolean {
    if (!TILE_CONFIGS[tile.tileType].buildable) return false;
    if (!BUILDING_CONFIGS[type].isWall && tile.buildingId !== null) return false;
    return BuildingManager.isTileAllowed(type, tile.tileType);
  }

  isCompatibleWithTile(q: number, r: number, newTileType: TileType): boolean {
    const building = this.getBuildingAt(q, r);
    if (!building) return true;
    return BuildingManager.isTileAllowed(building.buildingType, newTileType);
  }

  placeBuilding(type: BuildingType, tile: TileData): BuildingInstance | null {
    if (!this.canPlace(type, tile)) return null;

    const id = `bldg_${this.nextId++}`;
    const instance: BuildingInstance = {
      id,
      buildingType: type,
      q: tile.q,
      r: tile.r,
    };

    this.buildings.set(id, instance);
    tile.buildingId = id;

    return instance;
  }

  removeBuildingAt(q: number, r: number): void {
    const key = hexKey(q, r);
    for (const [id, inst] of this.buildings) {
      if (hexKey(inst.q, inst.r) === key) {
        this.buildings.delete(id);
        return;
      }
    }
  }

  getBuildingAt(q: number, r: number): BuildingInstance | null {
    const key = hexKey(q, r);
    for (const inst of this.buildings.values()) {
      if (hexKey(inst.q, inst.r) === key) return inst;
    }
    return null;
  }

  getBuildingTypeAt(q: number, r: number): BuildingType | null {
    const building = this.getBuildingAt(q, r);
    return building ? building.buildingType : null;
  }
}
