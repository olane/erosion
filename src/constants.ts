export const HEX_SIZE = 32;

export const MAP_RADIUS = 12;

export const EROSION_CHECK_INTERVAL = 30;

export const EROSION_BASE_PROGRESS = 10;

export const EROSION_ADJACENCY_BONUS = 10;

export const SPEED_OPTIONS = [0, 1, 2, 4] as const;

export type GameSpeed = (typeof SPEED_OPTIONS)[number];
