export interface AxialCoords {
  q: number;
  r: number;
}

export const AXIAL_DIRECTIONS: AxialCoords[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = size * ((3 / 2) * r);
  return { x, y };
}

export function hexDistance(a: AxialCoords, b: AxialCoords): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr)) / 2;
}

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function getNeighbors(q: number, r: number): AxialCoords[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function getHexVertices(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    vertices.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle),
    });
  }
  return vertices;
}

