export interface ResourceState {
  food: number;
  materials: number;
  science: number;
  population: number;
  foodCap: number;
  matCap: number;
}

export interface IResourceProvider {
  canAffordMaterials(amount: number): boolean;
  spendMaterials(amount: number): boolean;
}

export class ResourceManager implements ResourceState {
  food: number = 0;
  materials: number = 0;
  science: number = 0;
  population: number = 2;
  foodCap: number = 100;
  matCap: number = 100;

  onChanged: (() => void) | null = null;

  negativePopDays: number = 0;
  static readonly NEGATIVE_POP_GRACE_DAYS = 7;

  addFood(amount: number): number {
    if (amount < 0) {
      this.food += amount;
      return amount;
    }
    const space = this.foodCap - this.food;
    const added = Math.min(amount, space);
    this.food += added;
    return added;
  }

  addMaterials(amount: number): number {
    if (amount < 0) {
      this.materials += amount;
      return amount;
    }
    const space = this.matCap - this.materials;
    const added = Math.min(amount, space);
    this.materials += added;
    return added;
  }

  addScience(amount: number): void {
    this.science += Math.max(0, amount);
  }

  addPopulation(amount: number): void {
    this.population += amount;
  }

  spendFood(amount: number): boolean {
    if (this.food < amount) return false;
    this.food -= amount;
    return true;
  }

  spendMaterials(amount: number): boolean {
    if (this.materials < amount) return false;
    this.materials -= amount;
    return true;
  }

  spendScience(amount: number): boolean {
    if (this.science < amount) return false;
    this.science -= amount;
    return true;
  }

  spendPopulation(amount: number): boolean {
    if (this.population < amount) return false;
    this.population -= amount;
    return true;
  }

  setCaps(foodCap: number, matCap: number): void {
    this.foodCap = Math.max(0, foodCap);
    this.matCap = Math.max(0, matCap);
    this.food = Math.min(this.food, this.foodCap);
    this.materials = Math.min(this.materials, this.matCap);
  }

  tickNegativePop(): boolean {
    if (this.population < 0) {
      this.negativePopDays++;
    } else {
      this.negativePopDays = 0;
    }
    return this.negativePopDays >= ResourceManager.NEGATIVE_POP_GRACE_DAYS;
  }
}
