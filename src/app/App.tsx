import { lazy, Suspense, useEffect, useState } from 'react'
import gsap from 'gsap'
import { EntryModal } from '../ui/EntryModal'
import { HomeScreen } from '../ui/HomeScreen'
import { PackingOverlay } from '../ui/PackingOverlay'
import { HistoryOverlay } from '../ui/HistoryOverlay'
import { StageText } from '../ui/StageText'
import { LoadingBar } from '../ui/LoadingBar'
import { SpeedToggle } from '../ui/SpeedToggle'
import { SettingsPanel } from '../ui/SettingsPanel'
import { audio } from '../audio/audioManager'
import { director } from '../director/Director'

// Dev-only handle for automated walkthroughs (screenshots / smoke tests).
if (import.meta.env.DEV) {
  void Promise.all([import('../store/useGameStore'), import('../director/channels'), import('../scene/Host/useHostAnimator'), import('../scene/Balls/ballSystem'), import('../scene/Balls/HeroBall'), import('../scene/Props/Ticket'), import('../director/CameraDirector'), import('../store/useSettingsStore')]).then(
    ([gs, ch, h, bs, hb, tk, cd, ss]) => ((window as unknown as Record<string, unknown>).__gd = { director, store: gs.useGameStore, settings: ss.useSettingsStore, channels: ch, host: h.host, balls: bs.ballSystem, hero: hb.hero, ticket: tk.ticket, cam: cd }),
  )
}

// The 3D stage is code-split so the editor is usable immediately while it streams in.
const Scene = lazy(() => import('./Scene'))

export function App() {
  const [paused, setPaused] = useState(false)

  // Hidden tab or window out of focus → pause render, physics, tweens and audio (saves the machine).
  useEffect(() => {
    let blurred = false
    const apply = () => {
      const p = document.hidden || blurred
      setPaused(p)
      audio.pause(p)
      if (p) gsap.globalTimeline.pause()
      else gsap.globalTimeline.resume()
    }
    const onBlur = () => {
      blurred = true
      apply()
    }
    const onFocus = () => {
      blurred = false
      apply()
    }
    document.addEventListener('visibilitychange', apply)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', apply)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Hidden keyboard shortcuts (ignored while typing in the editor).
  // apply a persisted ×2 at startup
  useEffect(() => director.applySpeed(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return
      if (['Space', 'Enter', 'Escape', 'KeyF'].includes(e.code)) {
        e.preventDefault()
        director.key(e.code)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 bg-ink">
      <Suspense fallback={null}>
        <Scene paused={paused} />
      </Suspense>
      <StageText />
      <SpeedToggle />
      {paused && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="font-serif text-sm tracking-[0.5em] text-paper/70 uppercase">Tạm dừng</div>
        </div>
      )}
      <HomeScreen />
      <EntryModal />
      <PackingOverlay />
      <HistoryOverlay />
      <SettingsPanel />
      <LoadingBar />
    </div>
  )
}
