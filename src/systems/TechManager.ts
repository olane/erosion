import { BuildingType, BUILDING_CONFIGS } from '../data/buildings.ts';
import { TechNode, TECH_CONFIGS, getTechPrerequisites } from '../data/tech.ts';
import type { ResourceManager } from './ResourceManager.ts';

export interface NextTechInfo {
  name: string;
  cost: number;
  availableCount: number;
}

export class TechManager {
  private researched: Set<TechNode> = new Set();
  private resources: ResourceManager;

  constructor(resources: ResourceManager) {
    this.resources = resources;
  }

  isBuildingAvailable(type: BuildingType): boolean {
    if (BUILDING_CONFIGS[type].tier === 0) return true;
    for (const node of this.researched) {
      if (TECH_CONFIGS[node].unlocks.includes(type)) return true;
    }
    return false;
  }

  getAvailableNodes(): TechNode[] {
    return Object.values(TechNode)
      .filter((n): n is TechNode => typeof n === 'number')
      .filter((n) => !this.researched.has(n))
      .filter((n) => {
        const prereqs = getTechPrerequisites(n);
        if (prereqs.length === 0) return true;
        return prereqs.some((p) => this.researched.has(p));
      });
  }

  tryResearch(node: TechNode): boolean {
    if (this.researched.has(node)) return false;
    const config = TECH_CONFIGS[node];
    const prereqs = getTechPrerequisites(node);
    if (prereqs.length > 0 && !prereqs.some((p) => this.researched.has(p))) return false;
    if (!this.resources.spendScience(config.cost)) return false;
    this.researched.add(node);
    return true;
  }

  getNextTechInfo(): NextTechInfo | null {
    const available = this.getAvailableNodes();
    if (available.length === 0) return null;
    const config = TECH_CONFIGS[available[0]];
    return { name: config.name, cost: config.cost, availableCount: available.length };
  }
}
