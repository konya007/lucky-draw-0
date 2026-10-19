import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { stage } from '../director/channels'

/**
 * The only text on stage: the event title at curtain-up, and the closing words.
 * Large serif, wide tracking, soft fades. No HUD.
 */
export function StageText() {
  const phase = useGameStore((s) => s.phase)
  const title = useGameStore((s) => s.title)
  const [showTitle, setShowTitle] = useState(false)
  const finale = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase === 'HOST_ENTER') {
      setShowTitle(true)
      const t = setTimeout(() => setShowTitle(false), 3200)
      return () => clearTimeout(t)
    }
    if (phase === 'EDITING') setShowTitle(false)
  }, [phase])

  // finale opacity follows the animated channel
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (finale.current) finale.current.style.opacity = String(stage.finale)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <div className={`pointer-events-none fixed inset-x-0 top-[12vh] z-10 text-center transition-opacity duration-[1500ms] ${showTitle ? 'opacity-100' : 'opacity-0'}`}>
        <div className="font-serif text-[clamp(1.8rem,5vw,4.5rem)] tracking-[0.35em] text-paper/90 drop-shadow-[0_0_30px_rgba(255,220,160,0.25)]">{title || 'GRAND DRAW'}</div>
      </div>
      <div ref={finale} className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center text-center" style={{ opacity: 0 }}>
        <div className="text-[11px] tracking-[0.6em] text-muted uppercase">{title}</div>
        <div className="mt-4 font-serif text-[clamp(2rem,6vw,5rem)] tracking-[0.25em] text-paper">Thank you</div>
        <div className="mt-3 font-serif text-lg tracking-[0.2em] text-brass-hi/80 italic">See you next time</div>
      </div>
    </>
  )
}
