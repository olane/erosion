export interface ResourceState {
  food: number;
  materials: number;
  science: number;
  foodCap: number;
  matCap: number;
  population: number;
  popCap: number;
}

export class ResourceManager implements ResourceState {
  food: number = 0;
  materials: number = 0;
  science: number = 0;
  foodCap: number = 100;
  matCap: number = 100;
  population: number = 5;
  popCap: number = 5;

  onChanged: (() => void) | null = null;

  private popGrowthTimer: number = 0;
  private popDeclineTimer: number = 0;
  private static readonly POP_INTERVAL = 2;
  private prevPop: number = 5;

  addFood(amount: number): number {
    const space = this.foodCap - this.food;
    const added = Math.min(amount, space);
    this.food += added;
    return added;
  }

  addMaterials(amount: number): number {
    const space = this.matCap - this.materials;
    const added = Math.min(amount, space);
    this.materials += added;
    return added;
  }

  addScience(amount: number): void {
    this.science += amount;
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

  setCaps(foodCap: number, matCap: number): void {
    this.foodCap = Math.max(0, foodCap);
    this.matCap = Math.max(0, matCap);
    this.food = Math.min(this.food, this.foodCap);
    this.materials = Math.min(this.materials, this.matCap);
  }

  setPopCap(cap: number): void {
    this.popCap = Math.max(0, cap);
    this.population = Math.min(this.population, this.popCap);
  }

  eat(): void {
    this.prevPop = this.population;
    const required = this.population;
    if (this.food >= required) {
      this.food -= required;
      this.popGrowthTimer += 1;
      this.popDeclineTimer = 0;
      if (this.popGrowthTimer >= ResourceManager.POP_INTERVAL && this.population < this.popCap) {
        this.popGrowthTimer = 0;
        this.population += 1;
      }
    } else {
      this.food = 0;
      this.popGrowthTimer = 0;
      this.popDeclineTimer += 1;
      if (this.popDeclineTimer >= ResourceManager.POP_INTERVAL && this.population > 0) {
        this.popDeclineTimer = 0;
        this.population -= 1;
      }
    }
    if (this.prevPop !== this.population && this.onChanged) {
      this.onChanged();
    }
  }
}
