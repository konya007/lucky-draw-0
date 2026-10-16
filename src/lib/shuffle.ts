import { cryptoInt } from './random'

/** Fisher–Yates with crypto RNG. Returns a new array. */
export function shuffle<T>(input: readonly T[]): T[] {
  const a = input.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1)
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}
