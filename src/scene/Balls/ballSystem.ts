import { Color, Quaternion, Vector3 } from 'three'
import type { RapierRigidBody, useRapier } from '@react-three/rapier'
import { BALL_COLORS, BALL_RADIUS, CAGE, OUTLET, TRAY } from '../layout'
import { baffles } from '../Cage/CageColliders'
import { audio } from '../../audio/audioManager'
import { cage, clock } from '../../director/channels'
import { MAX_BALLS } from '../../lib/parseEntries'

type Rapier = ReturnType<typeof useRapier>['rapier']
type World = ReturnType<typeof useRapier>['world']

/**
 * Lifecycle of a ball:
 *  hidden → float (packed, hovering) → fly (bezier into lid) → cage (drum solver)
 *  → exit (tweened through the outlet) → chute (Rapier, rolls onto the tray) → hero (held by the host)
 */
export type BallMode = 'hidden' | 'float' | 'fly' | 'cage' | 'exit' | 'chute' | 'hero'

export interface Ball {
  i: number
  color: Color
  mode: BallMode
  pos: Vector3
  quat: Quaternion
  scale: number
  /** velocity (drum solver) */
  vel: Vector3
  /** last contact normal (for rolling) */
  n: Vector3
  /** angular spin used while floating/flying */
  spin: Vector3
  /** small light pulse when the ball "closes" during packing (0..1) */
  flash: number
}

const G = 9.81
const R_IN = CAGE.radius - BALL_RADIUS // centre of a ball touching the wall
const D2 = (2 * BALL_RADIUS) ** 2
const WALL_E = 0.35 // restitution against brass
const BALL_E = 0.3 // restitution ball ↔ ball
const WALL_FRICTION = 0.06 // tangential slip lost per contact substep (wall drags balls along)
const SUBSTEP = 1 / 180
const CELL = 2 * BALL_RADIUS
const PADDLES = baffles().map((b) => ({ angle: Math.atan2(b.pos.z, b.pos.y), half: b.half }))
const PADDLE_IN = CAGE.radius - PADDLES[0].half.y * 2 // inner edge of the paddles

const _v = new Vector3()
const _w = new Vector3()
const _d = new Vector3()
const _q = new Quaternion()
const HASH_SIZE = 4096
const hash = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & (HASH_SIZE - 1)
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2

/**
 * Ball physics in the drum is a purpose-built solver (no general physics engine, no 300-tile
 * collider shell): each substep integrates gravity, keeps every ball inside the sphere with one
 * distance test (the rotating wall drags balls along through friction), lets the four rotating
 * paddles scoop them, and resolves ball ↔ ball contacts with a spatial hash. ~200 balls cost well
 * under a millisecond. Rapier is used for exactly one body: the drawn ball rolling down the chute.
 */
class BallSystem {
  balls: Ball[] = []
  private rapier: Rapier | null = null
  private world: World | null = null
  /** the single dynamic Rapier body, used by whichever ball is on the chute */
  private chuteBody: RapierRigidBody | null = null
  private chuteBall: Ball | null = null
  private lastAngle = 0
  /** settled: drum still and every ball at rest → skip the solver until something moves */
  private calm = 0
  private caged: Ball[] = []
  private impacts = { wall: 0, ball: 0, wallPos: new Vector3(), ballPos: new Vector3() }
  private soundClock = 0

  init(rapier: Rapier, world: World) {
    this.rapier = rapier
    this.world = world
    const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, -10, 0).setCcdEnabled(true).setLinearDamping(0.1).setAngularDamping(0.3))
    world.createCollider(rapier.ColliderDesc.ball(BALL_RADIUS).setRestitution(0.35).setFriction(0.5).setDensity(900), body)
    body.setEnabled(false)
    this.chuteBody = body as unknown as RapierRigidBody
    if (!this.balls.length) {
      for (let i = 0; i < MAX_BALLS; i++) {
        this.balls.push({
          i,
          color: new Color(BALL_COLORS[i % BALL_COLORS.length]).convertSRGBToLinear(),
          mode: 'hidden',
          pos: new Vector3(0, -10, 0),
          quat: new Quaternion(),
          scale: 0,
          vel: new Vector3(),
          n: new Vector3(0, -1, 0),
          spin: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(3),
          flash: 0,
        })
      }
    }
    this.lastAngle = cage.angle
  }

  dispose() {
    const w = this.world
    const b = this.chuteBody
    if (w && b && w.getRigidBody(b.handle)) w.removeRigidBody(b)
    this.chuteBody = null
    this.chuteBall = null
    this.world = null
  }

  setMode(b: Ball, mode: BallMode) {
    if (this.chuteBall === b && mode !== 'chute') {
      this.chuteBody?.setEnabled(false)
      this.chuteBall = null
    }
    if (mode === 'cage' && b.mode !== 'cage') {
      b.vel.set((Math.random() - 0.5) * 0.3, -0.8, (Math.random() - 0.5) * 0.3)
    }
    b.mode = mode
  }

  get inCage() {
    return this.balls.filter((b) => b.mode === 'cage')
  }
  freeBall(): Ball | undefined {
    return this.balls.find((b) => b.mode === 'hidden')
  }

  reset() {
    for (const b of this.balls) {
      this.setMode(b, 'hidden')
      b.scale = 0
      b.pos.set(0, -10, 0)
    }
  }

  admitToCage(b: Ball) {
    this.setMode(b, 'cage')
    this.calm = 0
  }

  /** Ball closest to the outlet. */
  nearestToOutlet(): Ball | undefined {
    let best: Ball | undefined
    let bd = Infinity
    for (const b of this.balls) {
      if (b.mode !== 'cage') continue
      const d = b.pos.distanceToSquared(OUTLET.point)
      if (d < bd) {
        bd = d
        best = b
      }
    }
    return best
  }

  /** Hand a ball (at its current position) to Rapier for the roll down the chute. */
  launchChute(b: Ball, lin: { x: number; y: number; z: number }, ang: { x: number; y: number; z: number }) {
    const body = this.chuteBody
    this.setMode(b, 'chute')
    if (!body || !this.rapier) return
    this.chuteBall = b
    body.setTranslation(b.pos, true)
    body.setRotation(b.quat, true)
    body.setEnabled(true)
    body.setLinvel(lin, true)
    body.setAngvel(ang, true)
    body.wakeUp()
  }

  /** Current speed of the chute ball (m/s). */
  chuteSpeed() {
    const v = this.chuteBody?.linvel()
    return v ? Math.hypot(v.x, v.y, v.z) : 0
  }

  /** Rapier → chute ball transform (after each physics step). */
  syncChute() {
    const b = this.chuteBall
    const body = this.chuteBody
    if (!b || !body || b.mode !== 'chute') return
    const t = body.translation()
    const r = body.rotation()
    const lv = body.linvel()
    _v.set(lv.x, lv.y, lv.z)
    if (_v.distanceTo(b.vel) > 0.4) audio.play('hitBall', { vol: Math.min(0.8, 0.2 + _v.distanceTo(b.vel) / 4), pos: b.pos })
    b.vel.copy(_v)
    b.pos.set(t.x, t.y, t.z)
    b.quat.set(r.x, r.y, r.z, r.w)
  }

  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 1 / 30) * clock.speed
    // drum angular speed from its actual motion (covers spins, taps and rocking alike)
    const omega = dt > 0 ? (cage.angle - this.lastAngle) / dt : 0
    this.lastAngle = cage.angle
    this.impacts.wall = 0
    this.impacts.ball = 0

    for (const b of this.balls) {
      b.flash = Math.max(0, b.flash - dtRaw * 2.5)
      if (b.mode === 'float' || b.mode === 'fly' || b.mode === 'exit') {
        _q.setFromAxisAngle(_v.copy(b.spin).normalize(), b.spin.length() * dtRaw)
        b.quat.premultiply(_q)
      }
    }

    const caged = this.caged
    caged.length = 0
    let fastest = 0
    for (const b of this.balls) if (b.mode === 'cage') {
      caged.push(b)
      fastest = Math.max(fastest, b.vel.lengthSq())
    }
    // sleep once the drum is still and every ball has settled (wakes on any drum motion / new ball)
    if (Math.abs(omega) > 1e-3 || fastest > 0.03) this.calm = 0
    else this.calm += dtRaw
    if (caged.length && this.calm < 0.6) {
      const steps = Math.min(8, Math.max(1, Math.ceil(dt / SUBSTEP)))
      const h = dt / steps
      const angleStart = cage.angle - omega * dt
      for (let s = 0; s < steps; s++) this.substep(caged, h, omega, angleStart + omega * h * (s + 1))
      // rolling: spin about the axis perpendicular to the contact normal and the motion
      for (const b of caged) {
        const sp = b.vel.length()
        if (sp < 0.01) continue
        _w.crossVectors(b.n, b.vel).normalize().negate()
        if (_w.lengthSq() < 0.5) continue
        _q.setFromAxisAngle(_w, (sp * dt) / BALL_RADIUS)
        b.quat.premultiply(_q)
      }
    }
    this.playImpacts(dtRaw)
  }

  private substep(balls: Ball[], h: number, omega: number, angle: number) {
    const C = CAGE.center
    // 1) integrate
    for (const b of balls) {
      b.vel.y -= G * h
      b.vel.multiplyScalar(1 - 0.12 * h)
      b.pos.addScaledVector(b.vel, h)
    }
    // 2) ball ↔ ball (spatial hash, two relaxation passes)
    for (let pass = 0; pass < 2; pass++) this.collidePairs(balls)
    // 3) drum wall + paddles (rotating about the world X axis through C)
    for (const b of balls) {
      _d.subVectors(b.pos, C)
      const L = _d.length()
      if (L > R_IN) {
        const n = _d.multiplyScalar(1 / L)
        b.pos.copy(C).addScaledVector(n, R_IN)
        // wall velocity at the contact: ω × r, ω = (omega, 0, 0)
        const ry = b.pos.y - C.y
        const rz = b.pos.z - C.z
        _w.set(0, -omega * rz, omega * ry)
        _v.subVectors(b.vel, _w)
        const vn = _v.dot(n)
        if (vn > 0) {
          if (vn > 0.35) this.impact('wall', vn, b.pos)
          _v.addScaledVector(n, -vn) // tangential part
          _v.multiplyScalar(1 - WALL_FRICTION)
          _v.addScaledVector(n, -vn * WALL_E)
          b.vel.copy(_w).add(_v)
        }
        b.n.copy(n)
      }
      // paddles: radial plates near the wall that scoop balls as the drum turns
      const dx = b.pos.x - C.x
      const dy = b.pos.y - C.y
      const dz = b.pos.z - C.z
      const rho = Math.hypot(dy, dz)
      if (rho > PADDLE_IN - BALL_RADIUS && Math.abs(dx) < PADDLES[0].half.x + BALL_RADIUS) {
        const phi = Math.atan2(dz, dy)
        for (const p of PADDLES) {
          const pa = p.angle + angle
          const delta = wrap(phi - pa)
          const gap = BALL_RADIUS + p.half.z
          if (Math.abs(delta * rho) >= gap) continue
          // push the ball to the side of the plate it is on, matching the plate's speed
          const side = delta >= 0 ? 1 : -1
          const np = pa + (side * gap) / rho
          b.pos.y = C.y + Math.cos(np) * rho
          b.pos.z = C.z + Math.sin(np) * rho
          const ty = -Math.sin(np)
          const tz = Math.cos(np)
          const vt = b.vel.y * ty + b.vel.z * tz
          const plate = omega * rho
          const rel = vt - plate
          if (rel * side < 0) {
            if (Math.abs(rel) > 0.35) this.impact('wall', Math.abs(rel), b.pos)
            const nvt = plate - rel * WALL_E
            b.vel.y += (nvt - vt) * ty
            b.vel.z += (nvt - vt) * tz
          }
        }
      }
    }
  }

  /** Spatial hash as linked lists in typed arrays: no allocation per pass. */
  private head = new Int32Array(HASH_SIZE)
  private next = new Int32Array(MAX_BALLS)
  private cellOf = new Int32Array(MAX_BALLS * 3)

  private collidePairs(balls: Ball[]) {
    const head = this.head
    const next = this.next
    const cellOf = this.cellOf
    head.fill(-1)
    for (let i = 0; i < balls.length; i++) {
      const p = balls[i].pos
      const cx = Math.floor(p.x / CELL)
      const cy = Math.floor(p.y / CELL)
      const cz = Math.floor(p.z / CELL)
      cellOf[i * 3] = cx
      cellOf[i * 3 + 1] = cy
      cellOf[i * 3 + 2] = cz
      const h = hash(cx, cy, cz)
      next[i] = head[h]
      head[h] = i
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]
      const cx = cellOf[i * 3]
      const cy = cellOf[i * 3 + 1]
      const cz = cellOf[i * 3 + 2]
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++)
          for (let oz = -1; oz <= 1; oz++) {
            for (let j = head[hash(cx + ox, cy + oy, cz + oz)]; j !== -1; j = next[j]) {
              if (j <= i) continue
              const b = balls[j]
              const dx = b.pos.x - a.pos.x
              const dy = b.pos.y - a.pos.y
              const dz = b.pos.z - a.pos.z
              const d2 = dx * dx + dy * dy + dz * dz
              if (d2 >= D2 || d2 < 1e-12) continue
              const d = Math.sqrt(d2)
              const nx = dx / d
              const ny = dy / d
              const nz = dz / d
              // separate (equal masses → half each)
              const push = (2 * BALL_RADIUS - d) * 0.5
              a.pos.x -= nx * push
              a.pos.y -= ny * push
              a.pos.z -= nz * push
              b.pos.x += nx * push
              b.pos.y += ny * push
              b.pos.z += nz * push
              // bounce along the contact normal
              const vn = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny + (b.vel.z - a.vel.z) * nz
              if (vn < 0) {
                if (vn < -0.35) this.impact('ball', -vn, a.pos)
                const j2 = (-(1 + BALL_E) * vn) / 2
                a.vel.x -= nx * j2
                a.vel.y -= ny * j2
                a.vel.z -= nz * j2
                b.vel.x += nx * j2
                b.vel.y += ny * j2
                b.vel.z += nz * j2
              }
            }
          }
    }
  }

  private impact(kind: 'wall' | 'ball', speed: number, at: Vector3) {
    const im = this.impacts
    if (kind === 'wall' && speed > im.wall) {
      im.wall = speed
      im.wallPos.copy(at)
    } else if (kind === 'ball' && speed > im.ball) {
      im.ball = speed
      im.ballPos.copy(at)
    }
  }

  /** At most ~25 impact sounds per second, each from the strongest real contact of its frame. */
  private playImpacts(dt: number) {
    this.soundClock -= dt
    if (this.soundClock > 0) return
    const im = this.impacts
    let played = false
    if (im.wall > 0) {
      audio.play('hitBrass', { vol: Math.min(0.9, 0.15 + im.wall / 3), pos: im.wallPos })
      played = true
    }
    if (im.ball > 0) {
      audio.play('hitBall', { vol: Math.min(0.9, 0.15 + im.ball / 3), pos: im.ballPos })
      played = true
    }
    if (played) this.soundClock = 0.04
  }

  /** Is the ball resting inside the tray footprint? */
  inTray(b: Ball) {
    return Math.abs(b.pos.x - TRAY.center.x) < TRAY.size[0] / 2 - BALL_RADIUS && Math.abs(b.pos.z - TRAY.center.z) < TRAY.size[1] / 2 - BALL_RADIUS
  }
}

export const ballSystem = new BallSystem()
