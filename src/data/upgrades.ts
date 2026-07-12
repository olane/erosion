import { BuildingType } from './buildings.ts';

export enum UpgradeType {
  SEA_WALL,
}

export interface UpgradeConfig {
  name: string;
  // Shown as the cycler detail line when the upgrade can be applied.
  description: string;
  cost: number;
  // Game-seconds to apply the upgrade.
  buildTime: number;
  // Building types this upgrade can be applied to, or null for any building.
  // Building-specific upgrades (e.g. convert to an advanced version) list types.
  appliesTo: BuildingType[] | null;
  requiresCoastal?: boolean;
}

export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
  [UpgradeType.SEA_WALL]: {
    name: 'Sea Wall',
    description: 'Reduces erosion',
    cost: 20,
    buildTime: 5,
    appliesTo: null,
    requiresCoastal: true,
  },
};

// Whether an upgrade is applicable to a building of the given type (ignoring
// per-tile validity like coastal requirements, which are checked separately).
export function upgradeAppliesTo(upgrade: UpgradeType, buildingType: BuildingType): boolean {
  const config = UPGRADE_CONFIGS[upgrade];
  return config.appliesTo === null || config.appliesTo.includes(buildingType);
}
