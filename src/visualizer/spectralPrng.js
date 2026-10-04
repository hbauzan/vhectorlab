/**
 * Mulberry32: Fast, high-quality, 32-bit deterministic PRNG with seed.
 * Produces uniform pseudo-random numbers in [0, 1).
 * Guaranteed bit-for-bit parity across all JS runtimes (V8, JSC, SpiderMonkey).
 *
 * @param {number} [seed=0xDEADBEEF] - 32-bit integer seed
 * @returns {() => number} Generator returning float in [0, 1)
 */
export function createMulberry32(seed = 0xDEADBEEF) {
  let s = Math.trunc(Number(seed) || 0) >>> 0;
  if (s === 0) s = 0xDEADBEEF;

  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
