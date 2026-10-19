import { useEffect, useState } from 'react'
import { useGameStore } from '../store/useGameStore'

/** Full-screen loading screen while the stage, model and shaders load; fades out when ready. */
export function LoadingBar() {
  const ready = useGameStore((s) => s.sceneReady)
  const p = useGameStore((s) => s.loadProgress)
  const title = useGameStore((s) => s.title)
  const [mounted, setMounted] = useState(true)
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setMounted(false), 1100)
    return () => clearTimeout(t)
  }, [ready])
  if (!mounted) return null
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink transition-opacity duration-1000 ${ready ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <div className="text-[10px] tracking-[0.6em] text-muted uppercase">Gala night · lucky draw</div>
      <div className="mt-3 font-serif text-[clamp(2rem,6vw,4rem)] tracking-[0.3em] text-paper">{title || 'LUCKY SPIN'}</div>
      <div className="mt-10 h-px w-[min(22rem,70vw)] overflow-hidden bg-brass/20">
        <div className="h-full bg-gradient-to-r from-brass to-brass-hi transition-[width] duration-300" style={{ width: `${Math.max(3, p)}%` }} />
      </div>
      <div className="mt-3 font-mono text-[11px] tracking-widest text-muted">Setting the stage… {Math.round(p)}%</div>
    </div>
  )
}
