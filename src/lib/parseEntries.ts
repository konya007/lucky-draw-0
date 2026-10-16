export interface Entry {
  /** Stable id: source line index + hash, so duplicates stay distinct entries. */
  id: string
  raw: string
  /** Parsed columns: [name, prize, note, ...] */
  cols: string[]
}

export interface ParseStats {
  total: number
  empty: number
  duplicates: number
  balls: number
}

export const MAX_BALLS = 200

/** Split one line by `|`, tab or CSV comma (respecting "quoted, values"). */
export function splitLine(line: string): string[] {
  if (line.includes('|')) return line.split('|').map((s) => s.trim())
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim())
  if (line.includes(',')) {
    const out: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"'
          i++
        } else q = !q
      } else if (c === ',' && !q) {
        out.push(cur.trim())
        cur = ''
      } else cur += c
    }
    out.push(cur.trim())
    return out
  }
  return [line.trim()]
}

export function parseEntries(text: string): { entries: Entry[]; stats: ParseStats } {
  // trailing blank lines (e.g. after a paste) are not counted as skipped rows
  const lines = text.replace(/\s+$/, '').split(/\r?\n/)
  if (lines.length === 1 && !lines[0].trim()) lines.length = 0
  const entries: Entry[] = []
  const seen = new Set<string>()
  let empty = 0
  let duplicates = 0
  lines.forEach((line, i) => {
    const t = line.trim()
    if (!t) {
      empty++
      return
    }
    const key = t.toLowerCase()
    if (seen.has(key)) duplicates++
    seen.add(key)
    entries.push({ id: `${i}:${hash(t)}`, raw: t, cols: splitLine(t).filter((c, ci) => c.length > 0 || ci === 0) })
  })
  return {
    entries,
    stats: { total: entries.length, empty, duplicates, balls: Math.min(entries.length, MAX_BALLS) },
  }
}

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

// ---- toolbar transforms (operate on raw text, keep the textarea the source of truth) ----
const nonEmpty = (t: string) => t.split(/\r?\n/).filter((l) => l.trim())

export const tools = {
  sortAZ: (t: string) => nonEmpty(t).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })).join('\n'),
  reverse: (t: string) => t.split(/\r?\n/).reverse().join('\n'),
  removeEmpty: (t: string) => nonEmpty(t).join('\n'),
  dedupe: (t: string) => {
    const seen = new Set<string>()
    return t
      .split(/\r?\n/)
      .filter((l) => {
        const k = l.trim().toLowerCase()
        if (!k) return true
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .join('\n')
  },
}

export function toCSV(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
}
