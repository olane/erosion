let seed = Math.floor(Math.random() * 2147483647);

export function setNoiseSeed(s: number): void {
  seed = s;
}

export function getNoiseSeed(): number {
  return seed;
}

function hash(x: number, y: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);

  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);

  const nx0 = lerp(n00, n10, fx);
  const nx1 = lerp(n01, n11, fx);
  return lerp(nx0, nx1, fy);
}

export function fbm(x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}
