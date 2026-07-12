import { hexKey } from '../map/HexUtils.ts';
import { BUILDING_CONFIGS, getBuildingYields } from '../data/buildings.ts';
import { SECONDS_PER_DAY } from '../constants.ts';
import type { BuildingManager } from './BuildingManager.ts';
import type { ResourceManager } from './ResourceManager.ts';
import type { TileData } from '../map/types.ts';

export class ProductionSystem {
  private resources: ResourceManager;
  private buildings: BuildingManager;
  private getTiles: () => Map<string, TileData>;
  private lastDay: number = -1;

  foodRate: number = 0;
  matRate: number = 0;
  scienceRate: number = 0;
  popRate: number = 0;

  onGameOver: (() => void) | null = null;

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
    const tiles = this.getTiles();

    for (const b of this.buildings.buildings.values()) {
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;

      const config = BUILDING_CONFIGS[b.buildingType];
      foodCap += config.storageFood ?? 0;
      matCap += config.storageMat ?? 0;
    }

    this.resources.setCaps(foodCap, matCap);
  }

  private tickDay(): void {
    this.recalculateCaps();

    const yields = this.computeYields();

    this.resources.addFood(yields.food);
    this.resources.addMaterials(yields.materials);
    this.resources.addScience(yields.science);
    this.resources.addPopulation(yields.population);

    this.foodRate = yields.food;
    this.matRate = yields.materials;
    this.scienceRate = yields.science;
    this.popRate = yields.population;

    if (this.resources.tickNegativePop()) {
      this.onGameOver?.();
    }
  }

  private computeYields(): {
    food: number;
    materials: number;
    science: number;
    population: number;
  } {
    let food = 0;
    let materials = 0;
    let science = 0;
    let population = 0;

    const tiles = this.getTiles();
    for (const b of this.buildings.buildings.values()) {
      const tile = tiles.get(hexKey(b.q, b.r));
      if (!tile || tile.buildingId !== b.id) continue;
      const y = getBuildingYields(b.buildingType, tile.tileType);
      food += y.food;
      materials += y.materials;
      science += y.science;
      population += y.population;
    }

    return { food, materials, science, population };
  }
}
