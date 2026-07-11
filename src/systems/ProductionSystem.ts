import { hexKey } from '../map/HexUtils.ts';
import { BuildingType, BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
import type { BuildingManager } from './BuildingManager.ts';
import type { ResourceManager } from './ResourceManager.ts';
import type { TileData } from '../map/types.ts';

const SECONDS_PER_DAY = 3.6;

export class ProductionSystem {
  private resources: ResourceManager;
  private buildings: BuildingManager;
  private getTiles: () => Map<string, TileData>;
  private refreshTile: (q: number, r: number) => void;
  private lastDay: number = -1;

  foodRate: number = 0;
  matRate: number = 0;
  scienceRate: number = 0;

  constructor(
    resources: ResourceManager,
    buildings: BuildingManager,
    getTiles: () => Map<string, TileData>,
    refreshTile: (q: number, r: number) => void,
  ) {
    this.resources = resources;
    this.buildings = buildings;
    this.getTiles = getTiles;
    this.refreshTile = refreshTile;
  }

  update(elapsed: number): void {
    const currentDay = Math.floor(elapsed / SECONDS_PER_DAY);
    if (currentDay <= this.lastDay) return;
    const daysPassed = currentDay - this.lastDay;
    this.lastDay = currentDay;

    for (let i = 0; i < daysPassed; i++) {
      this.tickDay();
    }
  }

  recalculateCaps(): void {
    let foodCap = 0;
    let matCap = 0;
    let popCap = 0;
    const tiles = this.getTiles();

    for (const b of this.buildings.buildings.values()) {
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;

      const config = BUILDING_CONFIGS[b.buildingType];
      foodCap += config.storageFood ?? 0;
      matCap += config.storageMat ?? 0;
      popCap += config.popCap;
    }

    this.resources.setCaps(foodCap, matCap);
    this.resources.setPopCap(popCap);
  }

  private tickDay(): void {
    this.recalculateCaps();
    this.resources.eat();
    this.resolveWorkforce();

    const yields = this.computeYields();
    this.resources.addFood(yields.food);
    this.resources.addMaterials(yields.materials);
    this.resources.addScience(yields.science);

    this.foodRate = yields.food - this.resources.population;
    this.matRate = yields.materials;
    this.scienceRate = yields.science;
  }

  private resolveWorkforce(): void {
    const tiles = this.getTiles();
    const buildingList: Array<{ id: string; type: BuildingType; disabled: boolean; q: number; r: number }> = [];

    for (const b of this.buildings.buildings.values()) {
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      buildingList.push({ id: b.id, type: b.buildingType, disabled: b.disabled, q: b.q, r: b.r });
    }

    let totalReq = 0;
    for (const b of buildingList) {
      if (b.type === BuildingType.TOWN_HALL) continue;
      if (!b.disabled) {
        totalReq += BUILDING_CONFIGS[b.type].popReq;
      }
    }

    if (this.resources.population < totalReq) {
      for (let i = buildingList.length - 1; i >= 0; i--) {
        const b = buildingList[i];
        if (b.type === BuildingType.TOWN_HALL) continue;
        if (b.disabled) continue;
        const inst = this.buildings.buildings.get(b.id);
        if (inst) {
          inst.disabled = true;
          this.refreshTile(b.q, b.r);
        }
        totalReq -= BUILDING_CONFIGS[b.type].popReq;
        if (this.resources.population >= totalReq) break;
      }
    } else {
      for (let i = buildingList.length - 1; i >= 0; i--) {
        const b = buildingList[i];
        if (b.type === BuildingType.TOWN_HALL) continue;
        if (!b.disabled) continue;
        const req = BUILDING_CONFIGS[b.type].popReq;
        if (totalReq + req <= this.resources.population) {
          totalReq += req;
          const inst = this.buildings.buildings.get(b.id);
          if (inst) {
            inst.disabled = false;
            this.refreshTile(b.q, b.r);
          }
        }
      }
    }
  }

  private computeYields(): { food: number; materials: number; science: number } {
    let food = 0;
    let materials = 0;
    let science = 0;
    const tiles = this.getTiles();
    for (const b of this.buildings.buildings.values()) {
      if (b.disabled) continue;
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      const y = getBuildingYields(b.buildingType, tile.tileType);
      food += y.food;
      materials += y.materials;
      science += y.science;
    }
    return { food, materials, science };
  }
}
