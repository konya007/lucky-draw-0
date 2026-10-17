import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, Group, Sprite, SpriteMaterial } from 'three'
import { lights } from '../../director/channels'

/** Soft, lumpy smoke puff drawn once into a canvas (a few overlapping radial blobs). */
function puffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  for (let i = 0; i < 14; i++) {
    const x = 64 + (Math.random() - 0.5) * 50
    const y = 64 + (Math.random() - 0.5) * 50
    const r = 22 + Math.random() * 30
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(255,255,255,0.22)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  }
  // fade the square edges so no sprite border can ever show
  const edge = g.createRadialGradient(64, 64, 30, 64, 64, 64)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(0,0,0,1)')
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = edge
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

interface Puff {
  sprite: Sprite
  mat: SpriteMaterial
  x: number
  y: number
  z: number
  size: number
  phase: number
  life: number
  speed: number
  spin: number
}

/**
 * Stage haze: big soft smoke puffs hanging in the air above the boards. They rise and drift
 * slowly, fade in and out over a ~20 s cycle, and pick up the stage light level. Count comes from
 * the quality preset (0 = off).
 */
export function StageSmoke({ count }: { count: number }) {
  const group = useRef<Group>(null)
  const puffs = useMemo<Puff[]>(() => {
    const tex = puffTexture()
    return Array.from({ length: count }, (_, i) => {
      const mat = new SpriteMaterial({ map: tex, color: new Color('#d8cfc2'), transparent: true, depthWrite: false, opacity: 0 })
      const sprite = new Sprite(mat)
      sprite.raycast = () => null
      sprite.renderOrder = 4
      return {
        sprite,
        mat,
        x: -3.4 + Math.random() * 6.8,
        y: 0.35 + Math.random() * 2.0,
        z: -2.2 + Math.random() * 3.6,
        size: 1.6 + Math.random() * 1.8,
        phase: (i / count) * Math.PI * 2 + Math.random(),
        life: 16 + Math.random() * 10,
        speed: 0.04 + Math.random() * 0.05,
        spin: (Math.random() - 0.5) * 0.06,
      }
    })
  }, [count])

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    // haze shows more when the stage is lit
    const lit = Math.min(1.2, 0.25 + lights.key * 0.5 + lights.follow * 0.25 + lights.fillL * 0.2) * lights.master
    for (const p of puffs) {
      p.x += p.speed * dt
      p.y += p.speed * 0.3 * dt
      if (p.x > 3.8) p.x = -3.8
      if (p.y > 2.6) p.y = 0.35
      // breathe in and out so the haze keeps changing shape
      const cycle = 0.5 - 0.5 * Math.cos((t / p.life) * Math.PI * 2 + p.phase)
      p.mat.opacity = 0.16 * cycle * lit
      p.mat.rotation += p.spin * dt
      const sz = p.size * (0.85 + 0.3 * cycle)
      p.sprite.position.set(p.x, p.y + Math.sin(t * 0.2 + p.phase) * 0.08, p.z)
      p.sprite.scale.set(sz, sz, 1)
      p.sprite.visible = p.mat.opacity > 0.004
    }
  })

  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <primitive key={i} object={p.sprite} />
      ))}
    </group>
  )
}
