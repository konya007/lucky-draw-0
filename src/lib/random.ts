// Crypto-backed RNG. Used for every draw decision so results are unbiased and not seedable.
const buf = new Uint32Array(1)

/** Uniform float in [0, 1) from crypto.getRandomValues. */
export function cryptoRandom(): number {
  crypto.getRandomValues(buf)
  return buf[0] / 4294967296
}

/** Unbiased integer in [0, max) using rejection sampling. */
export function cryptoInt(max: number): number {
  if (max <= 0) return 0
  const limit = Math.floor(4294967296 / max) * max
  let v: number
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit)
  return v % max
}

export const randRange = (a: number, b: number) => a + cryptoRandom() * (b - a)

/** Cheap non-crypto random for visuals (confetti, jitter). */
export const vrand = (a = 0, b = 1) => a + Math.random() * (b - a)
