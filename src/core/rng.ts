export interface Rng {
  /** Returns a float in [0, 1) */
  next(): number;
  /** Returns an integer in [0, max) */
  nextInt(max: number): number;
}

export class MathRng implements Rng {
  next(): number {
    return Math.random();
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

/** Deterministic Mulberry32 PRNG for reproducible tests */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
