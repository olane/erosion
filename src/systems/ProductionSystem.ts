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
  private lastDay: number = -1;

  constructor(
    resources: ResourceManager,
    buildings: BuildingManager,
    getTiles: () => Map<string, TileData>,
  ) {
    this.resources = resources;
    this.buildings = buildings;
    this.getTiles = getTiles;
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

    const popBefore = this.resources.population;
    this.resources.eat();

    if (this.resources.population !== popBefore) {
      this.resolveWorkforce();
    }

    this.resolveWorkforce();
    this.produce();
  }

  private resolveWorkforce(): void {
    const tiles = this.getTiles();
    const buildingList: Array<{ id: string; type: BuildingType; disabled: boolean }> = [];

    for (const b of this.buildings.buildings.values()) {
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      buildingList.push({ id: b.id, type: b.buildingType, disabled: b.disabled });
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
        if (inst) inst.disabled = true;
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
          if (inst) inst.disabled = false;
        }
      }
    }
  }

  private produce(): void {
    const tiles = this.getTiles();
    for (const b of this.buildings.buildings.values()) {
      if (b.disabled) continue;
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      const yields = getBuildingYields(b.buildingType, tile.tileType);
      if (yields.food > 0) this.resources.addFood(yields.food);
      if (yields.materials > 0) this.resources.addMaterials(yields.materials);
      if (yields.science > 0) this.resources.addScience(yields.science);
    }
  }
}
