import { useEffect } from 'react'
import { LEVELS, useSettingsStore, type QualityLevel } from '../store/useSettingsStore'
import { useGameStore, type Phase } from '../store/useGameStore'

/** Phases where swapping the render pipeline would not interrupt a draw. */
const SAFE: Phase[] = ['EDITING', 'IDLE_READY', 'TICKET_SHOWN', 'FINISHED']

export function stepLevel(level: QualityLevel, dir: 1 | -1): QualityLevel {
  const i = LEVELS.indexOf(level) + dir
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))]
}

/** Request a level change from the PerformanceMonitor; applied only when the phase is safe. */
export function requestLevel(dir: 1 | -1) {
  const s = useSettingsStore.getState()
  if (s.quality !== 'auto') return
  const next = stepLevel(s.pendingLevel ?? s.level, dir)
  if (next === s.level) {
    s.set({ pendingLevel: null })
    return
  }
  if (SAFE.includes(useGameStore.getState().phase)) s.set({ level: next, pendingLevel: null })
  else s.set({ pendingLevel: next })
}

/** Flushes a deferred auto-quality change once we reach a safe phase. */
export function useAutoQualityFlush() {
  const phase = useGameStore((s) => s.phase)
  useEffect(() => {
    const s = useSettingsStore.getState()
    if (s.pendingLevel && SAFE.includes(phase)) s.set({ level: s.pendingLevel, pendingLevel: null })
  }, [phase])
}
