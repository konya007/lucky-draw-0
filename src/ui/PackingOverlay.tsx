import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGameStore } from '../store/useGameStore'
import { director } from '../director/Director'
import { previewRect } from './EntryModal'

/** name cards shown at most; every other entry is just a coloured ball */
const MAX_CARDS = 18
/** total flying elements */
const MAX_ITEMS = 48
/** flight time from the list to the box mouth (s) */
const FLIGHT = 0.75

/**
 * PACKING: a few name cards lift off the list, roll up into coloured balls and drop into the ballot
 * box held by the host; the other balls follow. The box mouth is re-projected from 3D every frame
 * (director.packTarget), so the balls land in it even while the camera settles or the host sways.
 * Each ball flies a curve that rises above the box, then falls in from the top and shrinks into the
 * mouth. Only transform and opacity are animated (no layout), and the element count is capped.
 */
export function PackingOverlay() {
  const packing = useGameStore((s) => s.packing)
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!packing || !el) return
    const r = previewRect.current ?? new DOMRect(innerWidth * 0.1, innerHeight * 0.2, innerWidth * 0.45, innerHeight * 0.5)
    const items = packing.cards.slice(0, MAX_ITEMS)
    const n = items.length
    const stagger = n > 1 ? Math.min(0.07, 1.3 / n) : 0
    const tl = gsap.timeline({ onComplete: () => director.packDone() })
    const frag = document.createDocumentFragment()
    const nodes: HTMLElement[] = []

    // one projection per frame shared by every ball
    let target = director.packTarget()
    const tick = () => void (target = director.packTarget())
    gsap.ticker.add(tick)

    items.forEach((c, i) => {
      const card = i < MAX_CARDS
      const d = document.createElement('div')
      d.className = 'pointer-events-none fixed left-0 top-0'
      d.style.willChange = 'transform, opacity'
      const ball = document.createElement('div')
      ball.className = 'absolute left-[-11px] top-[-11px] h-[22px] w-[22px] rounded-full shadow-[inset_-3px_-4px_6px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.4)]'
      ball.style.background = c.color
      d.appendChild(ball)
      let label: HTMLDivElement | null = null
      if (card) {
        label = document.createElement('div')
        label.textContent = c.text
        label.className = 'absolute left-[-75px] top-[-12px] w-[150px] truncate border border-brass/50 bg-[#efe6d2] px-2 py-1 font-sans text-[11px] text-ink shadow-lg'
        d.appendChild(label)
      }
      frag.appendChild(d)
      nodes.push(d)

      const sx = card ? r.left + 90 + Math.random() * Math.max(10, r.width - 180) : r.left + Math.random() * r.width
      const sy = card ? r.top + Math.min(r.height - 30, (i % 12) * 34 + 18) : r.top + r.height * (0.2 + Math.random() * 0.6)
      gsap.set(d, { x: sx, y: sy, opacity: 0 })
      gsap.set(ball, { scale: card ? 0 : 0.7, opacity: card ? 0 : 1 })
      const at = i * stagger
      tl.to(d, { opacity: 1, duration: 0.15 }, at)
      if (label) {
        tl.to(d, { y: sy - 10, duration: 0.18, ease: 'power2.out' }, at)
          .to(label, { scaleX: 0.1, scaleY: 0.5, opacity: 0, duration: 0.3, ease: 'power2.in' }, at + 0.15)
          .to(ball, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' }, at + 0.3)
      }

      // flight: quadratic curve start → (above the box) → box mouth, evaluated against the live target
      const t0 = at + (card ? 0.45 : 0.1)
      const jitter = (Math.random() - 0.5) * 18
      const lift = 110 + Math.random() * 60
      const p = { t: 0 }
      let x0 = sx
      let y0 = sy
      tl.to(
        p,
        {
          t: 1,
          duration: FLIGHT,
          ease: 'power1.in',
          onStart: () => {
            x0 = gsap.getProperty(d, 'x') as number
            y0 = gsap.getProperty(d, 'y') as number
          },
          onUpdate: () => {
            const tx = target.x + jitter
            const ty = target.y
            const cx = (x0 + tx) / 2
            const cy = Math.min(y0, ty) - lift
            const u = p.t
            const v = 1 - u
            gsap.set(d, { x: v * v * x0 + 2 * v * u * cx + u * u * tx, y: v * v * y0 + 2 * v * u * cy + u * u * ty })
          },
        },
        t0,
      )
        // falls into the mouth: shrinks and disappears inside the box
        .to(ball, { scale: 0.35, duration: 0.18, ease: 'power2.in' }, t0 + FLIGHT - 0.18)
        .to(d, { opacity: 0, duration: 0.08, onComplete: i % 3 === 0 ? () => director.packArrive(c.ball) : undefined }, t0 + FLIGHT - 0.06)
    })
    el.appendChild(frag)
    return () => {
      gsap.ticker.remove(tick)
      tl.kill()
      nodes.forEach((d) => d.remove())
    }
  }, [packing])

  return <div ref={root} className="pointer-events-none fixed inset-0 z-30" />
}
