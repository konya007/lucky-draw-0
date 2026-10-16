import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, Points, PointsMaterial, Quaternion, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three'
import { BALL_RADIUS } from '../layout'
import { makeBallMaterial } from './ballMaterial'
import { director } from '../../director/Director'
import { lights, stage } from '../../director/channels'

/** State of the single "hero" ball (the drawn one) once it leaves the instanced pool. */
export const hero = {
  visible: false,
  pos: new Vector3(),
  quat: new Quaternion(),
  color: new Color('#ff3b5c'),
  /** 0 closed → 1 shell fully open */
  open: 0,
  /** crack light along the seam while the user holds (0..1) */
  crack: 0,
  /** inner light / rim glow */
  glow: 0,
  /** slow presentational spin (rad/s) */
  spin: 0,
  /** visual scale (squash on landing, pop) */
  scale: 1,
  /** detached halves resting on the tray (after opening) */
  halvesOnTray: false,
  trayPos: new Vector3(),
  /** 0 = top half rides its hinge, 1 = top half is free at topPos/topQuat (split in two hands) */
  split: 0,
  topPos: new Vector3(),
  topQuat: new Quaternion(),
}

const R = BALL_RADIUS * 1.0
const _q = new Quaternion()
const _q2 = new Quaternion()
const _ax = new Vector3(0, 1, 0)
const _p = new Vector3()
const WARM = new Color(1, 0.85, 0.55)

/** Soft radial gradient used by the glow sprite and the sparks. */
let _glowTex: CanvasTexture | null = null
function glowTexture() {
  if (_glowTex) return _glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,240,200,0.6)')
  grd.addColorStop(1, 'rgba(255,200,120,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  _glowTex = new CanvasTexture(c)
  return _glowTex
}

/** Tiny pooled particle system: warm sparks bursting out of the opened ball. */
class Sparks {
  points: Points
  private pos: Float32Array
  private vel: Float32Array
  private life: Float32Array
  constructor(private n: number) {
    const g = new BufferGeometry()
    this.pos = new Float32Array(n * 3).fill(-50)
    this.vel = new Float32Array(n * 3)
    this.life = new Float32Array(n)
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    const m = new PointsMaterial({ size: 0.035, map: glowTexture(), color: new Color(1.4, 1.1, 0.7), transparent: true, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false })
    this.points = new Points(g, m)
    this.points.frustumCulled = false
    this.points.raycast = () => null
  }
  emit(at: Vector3) {
    for (let i = 0; i < this.n; i++) {
      const a = Math.random() * Math.PI * 2
      const up = Math.random() * 0.9 + 0.2
      const sp = 0.6 + Math.random() * 1.4
      this.pos.set([at.x, at.y, at.z], i * 3)
      this.vel.set([Math.cos(a) * sp * 0.6, up * sp, Math.sin(a) * sp * 0.6], i * 3)
      this.life[i] = 0.8 + Math.random() * 0.9
    }
  }
  update(dt: number) {
    let alive = false
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue
      alive = true
      this.life[i] -= dt
      this.vel[i * 3 + 1] -= 2.2 * dt
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -50
    }
    ;(this.points.material as PointsMaterial).opacity = alive ? 1 : 0
    this.points.geometry.attributes.position.needsUpdate = true
  }
}

/**
 * Two hemispheres hinged at the back of the seam. Opening rotates the top half like a clam shell,
 * spilling warm light (inner core + additive god-ray cards + a burst point light).
 */
export function HeroBall() {
  const root = useRef<Group>(null)
  const top = useRef<Group>(null)
  const topWorld = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const glow = useRef<Sprite>(null)
  const burstDone = useRef(false)
  const sparks = useMemo(() => new Sparks(70), [])
  const glowMat = useMemo(() => new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }), [])
  const holdT = useRef<number | null>(null)
  const clock = useThree((s) => s.clock)

  const mat = useMemo(() => {
    const m = makeBallMaterial({ instanced: false })
    m.emissive = new Color(0, 0, 0)
    return m
  }, [])
  const { topGeo, botGeo, coreMat } = useMemo(() => {
    const topGeo = new SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    // move so the hinge (back of the equator) is at the group origin
    topGeo.translate(0, 0, R)
    const botGeo = new SphereGeometry(R, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    const coreMat = new MeshBasicMaterial({ color: new Color(3, 2.4, 1.4), toneMapped: false })
    return { topGeo, botGeo, coreMat }
  }, [])

  useFrame((state, dt) => {
    const g = root.current
    if (!g) return
    g.visible = hero.visible
    if (!hero.visible) {
      if (glow.current) glow.current.visible = false
      if (topWorld.current) topWorld.current.visible = false
      sparks.update(dt)
      return
    }
    if (hero.spin) hero.quat.multiply(_q.setFromAxisAngle(_ax, hero.spin * dt))
    g.position.copy(hero.pos)
    g.quaternion.copy(hero.quat)
    g.scale.setScalar(hero.scale)
    mat.color.copy(hero.color)
    // rim glow in the ball's own colour while presented
    mat.emissive.copy(hero.color).multiplyScalar(hero.glow * 0.35)
    if (top.current) top.current.rotation.x = -hero.open * 2.2
    // the top half lives outside the ball group so it can leave in the other hand
    const tw = topWorld.current
    if (tw && top.current) {
      tw.visible = true
      g.updateMatrixWorld(true)
      top.current.getWorldPosition(_p)
      top.current.getWorldQuaternion(_q2)
      tw.position.copy(_p).lerp(hero.topPos, hero.split)
      tw.quaternion.copy(_q2).slerp(hero.topQuat, hero.split)
      tw.scale.setScalar(hero.scale)
    }
    // hold-to-crack: progress shows as light in the seam
    if (holdT.current !== null) {
      hero.crack = Math.min(1, (state.clock.elapsedTime - holdT.current) / 0.8)
      if (hero.crack >= 1) {
        holdT.current = null
        director.ballTap()
      }
    }
    const inner = Math.max(hero.crack * 0.4, hero.open)
    if (core.current) {
      core.current.visible = inner > 0.01
      core.current.scale.setScalar(0.6 + inner * 0.35)
    }
    // 2D light: a camera-facing glow sprite + spark particles (no real light, no extra shading cost)
    const glowAmt = Math.min(1.6, lights.burst * 1.4 + inner * 0.6 + hero.glow * 0.25)
    if (glow.current) {
      glow.current.visible = glowAmt > 0.02
      glowMat.opacity = Math.min(1, glowAmt)
      glowMat.color.copy(hero.color).lerp(WARM, 0.6)
      const gs = R * hero.scale * (3 + glowAmt * 6)
      glow.current.scale.set(gs, gs, 1)
      glow.current.position.copy(hero.pos)
    }
    // sparks: emitted once when the shell opens, then fly out and fall
    if (hero.open > 0.05 && !burstDone.current) {
      burstDone.current = true
      sparks.emit(hero.pos)
    }
    if (hero.open < 0.01) burstDone.current = false
    sparks.update(dt)
    // invite pulse for the ball
    if (stage.invited === 'ball') mat.emissive.addScalar(stage.invite * 0.05)
  })


  return (
    <>
    <sprite ref={glow} material={glowMat} visible={false} renderOrder={12} />
    <primitive object={sparks.points} />
    <group ref={topWorld} visible={false}>
      <mesh geometry={topGeo} material={mat} castShadow />
    </group>
    <group
      ref={root}
      visible={false}
      onPointerDown={(e) => {
        e.stopPropagation()
        holdT.current = director.canOpenBall() ? clock.elapsedTime : null
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        if (holdT.current !== null) {
          holdT.current = null
          director.ballTap()
        }
      }}
      onPointerOver={() => director.canOpenBall() && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={botGeo} material={mat} castShadow />
      {/* hinge reference for the (separately rendered) top half */}
      <group ref={top} position={[0, 0, -R]} />
      <mesh ref={core} visible={false} material={coreMat}>
        <sphereGeometry args={[R * 0.8, 16, 12]} />
      </mesh>
      {/* bigger invisible tap target */}
      <mesh>
        <sphereGeometry args={[R * 2.2, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
    </>
  )
}
