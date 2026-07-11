import { BuildingType } from './buildings.ts';

export enum TechNode {
  COASTAL_ENGINEERING,
  CRAFTSMANSHIP,
  LOGISTICS,
  BEACON,
  ADVANCED_AGRICULTURE,
  DEEP_MINING,
}

export interface TechNodeConfig {
  name: string;
  cost: number;
  tier: number;
  unlocks: BuildingType[];
}

export const TECH_CONFIGS: Record<TechNode, TechNodeConfig> = {
  [TechNode.COASTAL_ENGINEERING]: {
    name: 'Coastal Engineering',
    cost: 15,
    tier: 1,
    unlocks: [], // upgrades sea wall effectiveness
  },
  [TechNode.CRAFTSMANSHIP]: {
    name: 'Craftsmanship',
    cost: 15,
    tier: 1,
    unlocks: [BuildingType.WORKSHOP],
  },
  [TechNode.LOGISTICS]: {
    name: 'Logistics',
    cost: 15,
    tier: 1,
    unlocks: [BuildingType.WAREHOUSE],
  },
  [TechNode.BEACON]: {
    name: 'Beacon',
    cost: 40,
    tier: 2,
    unlocks: [BuildingType.LIGHTHOUSE],
  },
  [TechNode.ADVANCED_AGRICULTURE]: {
    name: 'Advanced Agriculture',
    cost: 40,
    tier: 2,
    unlocks: [BuildingType.ADVANCED_FARM],
  },
  [TechNode.DEEP_MINING]: {
    name: 'Deep Mining',
    cost: 40,
    tier: 2,
    unlocks: [BuildingType.DEEP_QUARRY],
  },
};

export function getTechPrerequisites(node: TechNode): TechNode[] {
  const config = TECH_CONFIGS[node];
  if (config.tier <= 1) return [];
  return Object.values(TechNode)
    .filter((n): n is TechNode => typeof n === 'number')
    .filter((n) => TECH_CONFIGS[n].tier === 1);
}
