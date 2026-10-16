import { Color, Quaternion, Vector3 } from 'three'
import type { RapierRigidBody, useRapier } from '@react-three/rapier'
import { BALL_COLORS, BALL_RADIUS, CAGE, CHUTE, OUTLET, TRAY } from '../layout'
import { audio } from '../../audio/audioManager'
import { MAX_BALLS } from '../../lib/parseEntries'

type Rapier = ReturnType<typeof useRapier>['rapier']
type World = ReturnType<typeof useRapier>['world']

/**
 * Lifecycle of a ball:
 *  hidden → float (packed, hovering) → fly (bezier into lid) → cage (dynamic physics)
 *  → exit (kinematic through the outlet) → chute/tray (dynamic) → hero (separate mesh, host holds it)
 *  'static' = parked in the cage without physics (low preset dynamic-body budget).
 */
export type BallMode = 'hidden' | 'float' | 'fly' | 'cage' | 'static' | 'exit' | 'chute' | 'hero'

export interface Ball {
  i: number
  color: Color
  mode: BallMode
  body: RapierRigidBody
  pos: Vector3
  quat: Quaternion
  scale: number
  /** previous linear velocity for impact detection */
  pv: Vector3
  /** angular spin used while floating/flying */
  spin: Vector3
  /** small light pulse when the ball "closes" during packing (0..1) */
  flash: number
}

const _v = new Vector3()
const _q = new Quaternion()

class BallSystem {
  balls: Ball[] = []
  rapier: Rapier | null = null
  world: World | null = null
  cage: RapierRigidBody | null = null
  /** Max simultaneously simulated balls (quality preset). */
  dynamicBudget = 100
  /** Notified when the set of balls/modes changes (for trails etc.). */
  version = 0

  init(rapier: Rapier, world: World) {
    this.rapier = rapier
    this.world = world
    const R = rapier
    this.balls = []
    for (let i = 0; i < MAX_BALLS; i++) {
      const desc = R.RigidBodyDesc.dynamic()
        .setTranslation(0, -10 - i, 0)
        .setCcdEnabled(true)
        .setLinearDamping(0.08)
        .setAngularDamping(0.25)
        .setCanSleep(true)
      const body = world.createRigidBody(desc)
      world.createCollider(
        R.ColliderDesc.ball(BALL_RADIUS).setRestitution(0.35).setFriction(0.4).setDensity(900),
        body,
      )
      body.setEnabled(false)
      this.balls.push({
        i,
        color: new Color(BALL_COLORS[i % BALL_COLORS.length]).convertSRGBToLinear(),
        mode: 'hidden',
        body,
        pos: new Vector3(0, -10, 0),
        quat: new Quaternion(),
        scale: 0,
        pv: new Vector3(),
        spin: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(3),
        flash: 0,
      })
    }
  }

  dispose() {
    const w = this.world
    if (w) {
      for (const b of this.balls) if (w.getRigidBody(b.body.handle)) w.removeRigidBody(b.body)
    }
    this.balls = []
    this.world = null
  }

  setMode(b: Ball, mode: BallMode) {
    const prev = b.mode
    b.mode = mode
    this.version++
    const body = b.body
    const R = this.rapier!
    if (mode === 'cage' || mode === 'chute') {
      body.setBodyType(R.RigidBodyType.Dynamic, true)
      body.setTranslation(b.pos, true)
      body.setRotation(b.quat, true)
      body.setEnabled(true)
      if (prev !== 'cage') {
        body.setLinvel({ x: (Math.random() - 0.5) * 0.3, y: -0.8, z: (Math.random() - 0.5) * 0.3 }, true)
        body.setAngvel({ x: b.spin.x, y: b.spin.y, z: b.spin.z }, true)
      }
      body.wakeUp()
    } else if (mode === 'exit') {
      body.setBodyType(R.RigidBodyType.KinematicPositionBased, true)
      body.setEnabled(true)
    } else {
      body.setEnabled(false)
    }
  }

  get active() {
    return this.balls.filter((b) => b.mode !== 'hidden')
  }
  get inCage() {
    return this.balls.filter((b) => b.mode === 'cage' || b.mode === 'static')
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

  /** Put a ball into the cage: dynamic if under budget, else parked statically. */
  admitToCage(b: Ball) {
    const dyn = this.balls.filter((x) => x.mode === 'cage').length
    if (dyn < this.dynamicBudget) this.setMode(b, 'cage')
    else {
      // park on the drum floor in a little heap
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * (CAGE.radius * 0.55)
      b.pos.set(CAGE.center.x + Math.cos(a) * r, 0, CAGE.center.z + Math.sin(a) * r * 0.6)
      b.pos.y = CAGE.center.y - Math.sqrt(Math.max(0, (CAGE.radius - BALL_RADIUS) ** 2 - (b.pos.x - CAGE.center.x) ** 2 - (b.pos.z - CAGE.center.z) ** 2))
      this.setMode(b, 'static')
    }
  }

  /** Ball closest to the outlet (the "sensor" region is the lower front quadrant). */
  nearestToOutlet(): Ball | undefined {
    let best: Ball | undefined
    let bd = Infinity
    for (const b of this.inCage) {
      const d = b.pos.distanceToSquared(OUTLET.point)
      if (d < bd) {
        bd = d
        best = b
      }
    }
    return best
  }

  /** Push tween-driven kinematic balls into the physics world. Call before each physics step. */
  beforeStep() {
    for (const b of this.balls) if (b.mode === 'exit') b.body.setNextKinematicTranslation(b.pos)
  }

  /** Pull physics transforms into ball state + impact sounds. Call after each physics step. */
  sync(dt: number) {
    let sounds = 0
    for (const b of this.balls) {
      b.flash = Math.max(0, b.flash - dt * 2.5)
      if (b.mode === 'exit') {
        _q.setFromAxisAngle(_v.copy(b.spin).normalize(), b.spin.length() * dt)
        b.quat.premultiply(_q)
      } else if (b.mode === 'cage' || b.mode === 'chute') {
        const t = b.body.translation()
        const r = b.body.rotation()
        b.pos.set(t.x, t.y, t.z)
        b.quat.set(r.x, r.y, r.z, r.w)
        // keep runaway spins in check (prevents jitter at high cage speed)
        const av = b.body.angvel()
        const am = Math.hypot(av.x, av.y, av.z)
        if (am > 45) b.body.setAngvel({ x: (av.x / am) * 45, y: (av.y / am) * 45, z: (av.z / am) * 45 }, true)
        // safety net: if a ball tunnels out of the drum, put it back
        if (b.mode === 'cage' && b.pos.distanceTo(CAGE.center) > CAGE.radius + 0.05) {
          b.body.setTranslation({ x: CAGE.center.x, y: CAGE.center.y, z: CAGE.center.z }, true)
          b.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
        const lv = b.body.linvel()
        _v.set(lv.x, lv.y, lv.z)
        const dv = _v.distanceTo(b.pv)
        b.pv.copy(_v)
        // every real impact plays immediately (velocity jump = contact); capped per frame
        if (dv > 0.45 && sounds < 6 && !b.body.isSleeping()) {
          sounds++
          const nearWall = b.pos.distanceTo(CAGE.center) > CAGE.radius - BALL_RADIUS * 2.2
          const vol = Math.min(1, 0.15 + dv / 3.5)
          audio.play(b.mode === 'chute' ? 'hitBall' : nearWall ? 'hitBrass' : 'hitBall', { vol: vol * 0.7, pos: b.pos })
        }
      } else if (b.mode === 'float' || b.mode === 'fly' || b.mode === 'static') {
        if (b.mode === 'static') continue
        _q.setFromAxisAngle(_v.copy(b.spin).normalize(), b.spin.length() * dt)
        b.quat.premultiply(_q)
      }
    }
  }

  /** Is the ball resting inside the tray footprint? */
  inTray(b: Ball) {
    return (
      Math.abs(b.pos.x - TRAY.center.x) < TRAY.size[0] / 2 - BALL_RADIUS &&
      Math.abs(b.pos.z - TRAY.center.z) < TRAY.size[1] / 2 - BALL_RADIUS
    )
  }

  /** Chute start in world space (just outside the outlet). */
  get chuteStart() {
    return CHUTE.start
  }
}

export const ballSystem = new BallSystem()
