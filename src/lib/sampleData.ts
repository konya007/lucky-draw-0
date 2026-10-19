import { cryptoInt } from './random'

const FIRST = ['Alex', 'Jamie', 'Sam', 'Taylor', 'Jordan', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Drew', 'Harper', 'Emery', 'Rowan', 'Skyler', 'Parker', 'Reese', 'Logan', 'Elliot', 'Hayden', 'Noah', 'Mia', 'Liam', 'Emma', 'Lucas', 'Ava', 'Ethan', 'Chloe']
const LAST = ['Carter', 'Nguyen', 'Lee', 'Patel', 'Smith', 'Garcia', 'Kim', 'Brown', 'Tanaka', 'Silva', 'Muller', 'Rossi', 'Cohen', 'Novak', 'Walsh', 'Khan']
const pick = <T,>(a: readonly T[]) => a[cryptoInt(a.length)]

/**
 * Sample list in the "Name | Student ID | Prize" format (handy to try the show and the ID masking).
 * Prizes: 1 first, 2 second, 3 third, the rest consolation.
 */
export function sampleEntries(count = 30): string {
  const lines: string[] = []
  const used = new Set<string>()
  for (let i = 0; lines.length < count && i < count * 20; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`
    const id = `${pick(['22', '23', '24'])}${String(51000000 + cryptoInt(99999999 - 51000000)).padStart(8, '0')}`
    if (used.has(id)) continue
    used.add(id)
    const n = lines.length
    const prize = n === 0 ? 'First prize' : n <= 2 ? 'Second prize' : n <= 5 ? 'Third prize' : 'Consolation prize'
    lines.push(`${name} | ${id} | ${prize}`)
  }
  return lines.join('\n')
}
