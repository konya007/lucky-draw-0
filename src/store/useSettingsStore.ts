import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QualityChoice = 'auto' | 'low' | 'medium' | 'high' | 'ultra'
export type QualityLevel = Exclude<QualityChoice, 'auto'>
export const LEVELS: QualityLevel[] = ['low', 'medium', 'high', 'ultra']

interface SettingsState {
  master: number
  music: number
  sfx: number
  muted: boolean
  quality: QualityChoice
  /** ×2 playback for the whole show */
  fast: boolean
  /** per-option overrides on top of the level (see QualityPreset) */
  custom: Partial<import('../quality/qualityPresets').QualityPreset>
  /** render resolution multiplier (0.5–1) */
  renderScale: number
  /** Level actually rendered (auto mode resolves this at runtime; not persisted). */
  level: QualityLevel
  /** Level the auto-tuner wants; applied only at safe phases. */
  pendingLevel: QualityLevel | null
  set: (p: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      master: 0.8,
      music: 0.5,
      sfx: 0.8,
      muted: false,
      quality: 'auto',
      fast: false,
      custom: {},
      renderScale: 1,
      // auto starts one notch below High and climbs if the machine keeps up
      level: 'medium',
      pendingLevel: null,
      set: (p) =>
        set((s) => {
          const next = { ...s, ...p }
          if (p.quality && p.quality !== 'auto') next.level = p.quality
          return next
        }),
    }),
    {
      name: 'grand-draw:settings',
      partialize: (s) => ({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted, quality: s.quality, fast: s.fast, custom: s.custom, renderScale: s.renderScale }),
      onRehydrateStorage: () => (s) => {
        if (!s) return
        // ?quality=low|medium|high|ultra|auto overrides the saved choice (handy for testing)
        const q = new URLSearchParams(location.search).get('quality') as QualityChoice | null
        if (q && ['auto', 'low', 'medium', 'high', 'ultra'].includes(q)) s.quality = q
        if (s.quality !== 'auto') s.level = s.quality
      },
    },
  ),
)
