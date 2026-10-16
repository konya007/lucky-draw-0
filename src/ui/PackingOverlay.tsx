import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGameStore } from '../store/useGameStore'
import { director } from '../director/Director'
import { previewRect } from './EntryModal'

/**
 * PACKING: preview rows peel off as little cards, curl into paper scrolls and dive into
 * the floating balls (positions projected from 3D by the Director). Each arrival "closes" a ball.
 */
export function PackingOverlay() {
  const packing = useGameStore((s) => s.packing)
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!packing || !el) return
    const r = previewRect.current ?? new DOMRect(innerWidth * 0.55, innerHeight * 0.25, innerWidth * 0.35, innerHeight * 0.5)
    const n = packing.cards.length
    const total = 2.1
    const stagger = n > 1 ? Math.min(0.06, (total - 0.9) / n) : 0
    const nodes: HTMLDivElement[] = []
    const tl = gsap.timeline({ onComplete: () => director.packDone() })
    packing.cards.forEach((c, i) => {
      const d = document.createElement('div')
      d.textContent = c.text
      d.className = 'pointer-events-none fixed left-0 top-0 truncate border border-brass/50 bg-[#efe6d2] px-2 py-1 font-sans text-[11px] text-ink shadow-lg'
      d.style.width = '150px'
      d.style.height = '24px'
      d.style.willChange = 'transform'
      el.appendChild(d)
      nodes.push(d)
      const sx = r.left + 16 + Math.random() * Math.max(10, r.width - 180)
      const sy = r.top + Math.min(r.height - 30, (i % 14) * 34 + 6)
      gsap.set(d, { x: sx, y: sy, opacity: 0 })
      const at = i * stagger
      tl.to(d, { opacity: 1, duration: 0.15 }, at)
        // lift off the list (anticipation)
        .to(d, { y: sy - 10, scale: 1.04, duration: 0.18, ease: 'power2.out' }, at)
        // curl into a scroll: narrow, round, take the ball colour
        .to(d, { width: 22, height: 22, borderRadius: 11, color: 'transparent', backgroundColor: c.color, rotation: 360, scale: 0.8, duration: 0.42, ease: 'power2.inOut' }, at + 0.15)
        // dive along an arc into its ball
        .to(d, { x: c.x - 11, duration: 0.55, ease: 'power1.inOut' }, at + 0.45)
        .to(d, { y: c.y - 11, duration: 0.55, ease: 'power2.in' }, at + 0.45)
        .to(d, { scale: 0.2, opacity: 0, duration: 0.12, onComplete: () => director.packArrive(c.ball) }, at + 0.95)
    })
    return () => {
      tl.kill()
      nodes.forEach((d) => d.remove())
    }
  }, [packing])

  return <div ref={root} className="pointer-events-none fixed inset-0 z-30" />
}
