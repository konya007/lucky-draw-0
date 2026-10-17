import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parseEntries, type Entry, MAX_BALLS } from '../lib/parseEntries'
import { cryptoInt } from '../lib/random'
import { maskIds } from '../lib/maskIds'

export type Phase =
  | 'EDITING'
  | 'PACKING'
  | 'HOST_ENTER'
  | 'LOADING_CAGE'
  | 'IDLE_READY'
  | 'SPINNING'
  | 'DECELERATING'
  | 'DISPENSING'
  | 'HOST_PICKUP'
  | 'BALL_PRESENTED'
  | 'OPENING'
  | 'TICKET_SHOWN'
  | 'FINISHED'

export type HostState =
  | 'offstage'
  | 'walking'
  | 'idle'
  | 'gesturing'
  | 'cranking'
  | 'walkingToTray'
  | 'pickingUp'
  | 'holding'
  | 'opening'
  | 'presenting'
  | 'bowing'
  | 'walkingOut'

/** Legal transitions. Anything else is rejected (prevents overlapping phases). */
const NEXT: Record<Phase, Phase[]> = {
  EDITING: ['PACKING'],
  PACKING: ['HOST_ENTER', 'EDITING'],
  HOST_ENTER: ['LOADING_CAGE', 'EDITING'],
  LOADING_CAGE: ['IDLE_READY', 'EDITING'],
  IDLE_READY: ['SPINNING', 'EDITING', 'FINISHED', 'LOADING_CAGE'],
  SPINNING: ['DECELERATING'],
  DECELERATING: ['DISPENSING'],
  DISPENSING: ['HOST_PICKUP'],
  HOST_PICKUP: ['BALL_PRESENTED'],
  BALL_PRESENTED: ['OPENING'],
  OPENING: ['TICKET_SHOWN'],
  TICKET_SHOWN: ['IDLE_READY', 'EDITING', 'FINISHED', 'LOADING_CAGE'],
  FINISHED: ['EDITING'],
}

export interface PackCard {
  text: string
  ball: number
  x: number
  y: number
  color: string
}

export interface Win {
  serial: string
  entry: Entry
  at: number
  title: string
}

interface GameState {
  phase: Phase
  hostState: HostState
  // ---- persisted data ----
  text: string
  title: string
  removeWinners: boolean
  history: Win[]
  /** Entries still in the draw pool. */
  pool: Entry[]
  // ---- runtime ----
  current: Win | null
  sceneReady: boolean
  loadProgress: number
  hintShown: boolean
  settingsOpen: boolean
  historyOpen: boolean
  /** first-time "drag the crank" line visible */
  hint: boolean
  /** the list editor is shown (after "Bắt đầu quay" on the home screen) */
  editorOpen: boolean
  /** display mode: mask the middle of ID-like numbers everywhere on screen (data stays intact) */
  maskIds: boolean
  /** stop after this many winners in a session (null = keep drawing until the pool is empty) */
  winnerLimit: number | null
  /** cards flying from the editor into the balls (PACKING) */
  packing: { cards: PackCard[] } | null
  setPhase: (p: Phase) => boolean
  setHostState: (h: HostState) => void
  setText: (t: string) => void
  setTitle: (t: string) => void
  setRemoveWinners: (v: boolean) => void
  buildPool: () => number
  /** Pick a winner from the pool at the moment the ball leaves the cage. */
  drawWinner: () => Win | null
  set: (p: Partial<GameState>) => void
  clearHistory: () => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'EDITING',
      hostState: 'offstage',
      text: '',
      title: 'GRAND DRAW',
      removeWinners: true,
      history: [],
      pool: [],
      current: null,
      sceneReady: false,
      loadProgress: 0,
      hintShown: false,
      settingsOpen: false,
      historyOpen: false,
      hint: false,
      editorOpen: false,
      maskIds: false,
      winnerLimit: null,
      packing: null,
      setPhase: (p) => {
        const cur = get().phase
        if (cur === p) return true
        if (!NEXT[cur].includes(p)) {
          console.warn(`[game] illegal transition ${cur} → ${p}`)
          return false
        }
        set({ phase: p })
        return true
      },
      setHostState: (hostState) => set({ hostState }),
      setText: (text) => set({ text }),
      setTitle: (title) => set({ title }),
      setRemoveWinners: (removeWinners) => set({ removeWinners }),
      buildPool: () => {
        const { entries } = parseEntries(get().text)
        let pool = entries
        if (get().removeWinners && get().history.length) {
          // Remove one occurrence per previous win (matched by raw text) so a resumed session stays fair.
          const won = new Map<string, number>()
          for (const w of get().history) won.set(w.entry.raw, (won.get(w.entry.raw) ?? 0) + 1)
          pool = entries.filter((e) => {
            const n = won.get(e.raw) ?? 0
            if (n > 0) {
              won.set(e.raw, n - 1)
              return false
            }
            return true
          })
        }
        set({ pool })
        return pool.length
      },
      drawWinner: () => {
        const { pool, removeWinners, title, history } = get()
        if (!pool.length) return null
        const idx = cryptoInt(pool.length)
        const entry = pool[idx]
        const win: Win = {
          entry,
          at: Date.now(),
          title,
          serial: `GD-${String(history.length + 1).padStart(4, '0')}-${(Date.now() % 100000).toString(36).toUpperCase()}`,
        }
        set({
          current: win,
          history: [...history, win],
          pool: removeWinners ? pool.filter((_, i) => i !== idx) : pool,
        })
        return win
      },
      set: (p) => set(p),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'grand-draw:game',
      partialize: (s) => ({ text: s.text, title: s.title, removeWinners: s.removeWinners, history: s.history, hintShown: s.hintShown, maskIds: s.maskIds, winnerLimit: s.winnerLimit }),
    },
  ),
)

/** Balls in the cage for a given pool size. */
export const ballsFor = (poolSize: number) => Math.min(poolSize, MAX_BALLS)

export const game = () => useGameStore.getState()

/** Text as it should appear on screen (applies the ID mask when that mode is on). */
export const shown = (text: string) => (useGameStore.getState().maskIds ? maskIds(text) : text)
/** Reactive version for components. */
export function useShown() {
  const on = useGameStore((s) => s.maskIds)
  return (text: string) => (on ? maskIds(text) : text)
}
