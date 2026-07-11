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

  foodRate: number = 0;
  matRate: number = 0;
  scienceRate: number = 0;
  workforceShortfall: boolean = false;
  totalPopReq: number = 0;

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
    this.resources.eat();

    let totalReq = 0;
    const tiles = this.getTiles();
    for (const b of this.buildings.buildings.values()) {
      if (b.buildingType === BuildingType.TOWN_HALL) continue;
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      totalReq += BUILDING_CONFIGS[b.buildingType].popReq;
    }

    this.workforceShortfall = this.resources.population < totalReq;
    this.totalPopReq = totalReq;

    const matMult = this.workforceShortfall ? 0.5 : 1;
    const sciMult = this.workforceShortfall ? 0 : 1;
    const yields = this.computeYields(matMult, sciMult);

    this.resources.addFood(yields.food);
    this.resources.addMaterials(yields.materials);
    this.resources.addScience(yields.science);

    this.foodRate = yields.food - this.resources.population;
    this.matRate = yields.materials;
    this.scienceRate = yields.science;
  }

  private computeYields(
    matMult: number,
    sciMult: number,
  ): { food: number; materials: number; science: number } {
    let food = 0;
    let materials = 0;
    let science = 0;
    const tiles = this.getTiles();
    for (const b of this.buildings.buildings.values()) {
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      const y = getBuildingYields(b.buildingType, tile.tileType);
      food += y.food;
      materials += y.materials;
      science += y.science;
    }
    return {
      food,
      materials: Math.floor(materials * matMult),
      science: Math.floor(science * sciMult),
    };
  }
}
