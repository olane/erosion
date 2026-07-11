export class Noise {
  private seed: number;

  constructor(seed: number = Math.floor(Math.random() * 2147483647)) {
    this.seed = seed;
  }

  getSeed(): number {
    return this.seed;
  }

  private hash(x: number, y: number): number {
    let h = this.seed + x * 374761393 + y * 668265263;
    h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private noise2D(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = this.smoothstep(x - ix);
    const fy = this.smoothstep(y - iy);

    const n00 = this.hash(ix, iy);
    const n10 = this.hash(ix + 1, iy);
    const n01 = this.hash(ix, iy + 1);
    const n11 = this.hash(ix + 1, iy + 1);

    const nx0 = this.lerp(n00, n10, fx);
    const nx1 = this.lerp(n01, n11, fx);
    return this.lerp(nx0, nx1, fy);
  }

  fbm(x: number, y: number, octaves: number = 4): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

let defaultInstance = new Noise();

export function setNoiseSeed(s: number): void {
  defaultInstance = new Noise(s);
}

export function getNoiseSeed(): number {
  return defaultInstance.getSeed();
}

export function fbm(x: number, y: number, octaves: number = 4): number {
  return defaultInstance.fbm(x, y, octaves);
}
