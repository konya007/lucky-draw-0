import { Vector3 } from 'three'
import { CAGE, CRANK, OUTLET, PROPS, TRAY } from '../scene/layout'
import { host } from '../scene/Host/useHostAnimator'
import { hero } from '../scene/Balls/HeroBall'
import { ticket } from '../scene/Props/Ticket'
import { knobWorld } from '../scene/Cage/Crank'

/**
 * Camera shots as data. Each value may be static or a function evaluated every frame
 * (tracking shots). The CameraDirector springs toward whatever the active shot returns.
 */
export interface Shot {
  pos: Vector3
  target: Vector3
  fov: number
  /** world point kept in focus (DOF rack focus = animate this) */
  focus?: Vector3
  bokeh?: number
  roll?: number
  /** spring smooth time (s) for position/target */
  smooth?: number
  /** handheld noise amount 0..1 */
  handheld?: number
  /** mouse/gyro parallax allowed */
  parallax?: boolean
  letterbox?: number
  /** on narrow screens widen the FOV so this many meters fit horizontally at the target distance */
  fitWidth?: number
}

export type ShotFn = (t: number, p: ShotParams) => Shot

/** Tweened parameters some shots read (orbit angle, push-in progress, focus mix…). */
export const shotParams = {
  orbit: 0,
  push: 0,
  focusMix: 0,
  /** 0..1 progress for the loading tilt (cloud → lid) */
  tilt: 0,
}
export type ShotParams = typeof shotParams

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()

const SHOT_TABLE = {
  editing: (t) => ({ pos: v(Math.sin(t * 0.05) * 0.25, 1.85, 4.6), target: v(Math.sin(t * 0.05) * 0.18, 1.85, 1.9), fov: 35, handheld: 0.6, bokeh: 0, smooth: 1.2 }),
  /** the host on the apron with the open ballot box, the closed curtain behind */
  packing: () => ({ pos: v(0, 1.2, 5.6), target: v(0, 0.78, 2.1), fov: 36, handheld: 0.6, smooth: 0.9, focus: v(0, 0.9, 2.1), bokeh: 0.5 }),
  wide: () => ({ pos: v(0, 2.25, 6.7), target: v(0, 1.25, 0), fov: 40, handheld: 1, smooth: 0.9, bokeh: 0.5 }),
  hostEnter: () => {
    const head = host.headWorld(_a)
    return {
      pos: v(head.x * 0.85 + 0.5, 1.3, Math.max(head.z, -0.2) + 4.1),
      target: v(head.x, head.y - 0.35, head.z),
      fov: 36,
      smooth: 0.8,
      handheld: 1,
      focus: head.clone(),
      bokeh: 1.5,
    }
  },
  hostBow: () => {
    const head = host.headWorld(_a)
    return { pos: v(head.x + 0.35, head.y - 0.25, head.z + 2.5), target: v(head.x, head.y - 0.4, head.z), fov: 34, smooth: 0.9, handheld: 1, focus: head.clone(), bokeh: 2.5 }
  },
  loading: (_t, p) => {
    const tgt = _b.set(0.2, 2.2, 0.3).lerp(_c.set(0, CAGE.center.y + CAGE.radius, 0), p.tilt)
    return { pos: v(2.3, 2.6, 3.4), target: tgt.clone(), fov: 40, smooth: 0.7, handheld: 1, focus: v(0, CAGE.center.y + 0.3, 0), bokeh: 1 }
  },
  idle: () => ({ pos: v(-0.45, 1.25, 4.3), target: v(0.42, 1.05, 0), fov: 40, handheld: 1, parallax: true, smooth: 0.9, focus: CAGE.center.clone(), bokeh: 1 }),
  crankInsert: () => {
    const knob = knobWorld(_a)
    // big chibi heads fill the usual over-the-shoulder angle: look at the knob from the front-left instead
    const chibi = host.rig.headClear > 0
    const pos = chibi ? v(0.15, 1.5, 2.7) : v(1.6, 1.62, 1.5)
    return { pos, target: v(knob.x * 0.4 + CRANK.hub.x * 0.6, CRANK.hub.y, 0.05), fov: chibi ? 36 : 30, smooth: 0.14, handheld: 0.6, focus: knob.clone(), bokeh: 2.5 }
  },
  crankMedium: () => ({ pos: v(1.6, 1.45, 3.0), target: v(0.45, 1.05, 0), fov: 36, smooth: 0.6, handheld: 1, focus: v(0.6, 1.05, 0), bokeh: 1.5 }),
  spin: (_t, p) => {
    // orbit around the drum, 30–40° over the spin
    const a = 0.25 + p.orbit * 0.62
    const r = 2.95
    return {
      pos: v(Math.sin(a) * r, 1.45, Math.cos(a) * r + 0.1),
      target: CAGE.center.clone(),
      fov: 36,
      smooth: 0.8,
      handheld: 1,
      focus: CAGE.center.clone(),
      bokeh: 1.5,
    }
  },
  decel: (_t, p) => {
    const a = _a.set(0.45, 1.25, 2.6).lerp(_b.set(0.2, 0.98, 1.75), p.push)
    return { pos: a.clone(), target: OUTLET.point.clone().lerp(CAGE.center, 0.35), fov: 32 - p.push * 4, smooth: 0.6, handheld: 0.7, focus: OUTLET.point.clone(), bokeh: 2 + p.push * 2 }
  },
  dispense: () => {
    // follow the ball as it rolls down the chute (position written by the Director)
    const ball = shotTargets.ball
    return {
      pos: v(0.32 + ball.x * 0.3, 0.9, 1.38),
      target: _a.copy(OUTLET.point).lerp(ball, 0.75).clone(),
      fov: 26,
      smooth: 0.35,
      handheld: 0.5,
      focus: ball.clone(),
      bokeh: 4.5,
      letterbox: 1,
    }
  },
  pickup: () => {
    const hips = host.hipsWorld(_a)
    // big chibi heads block the over-the-shoulder view: look from the front-left, a little higher
    const pos = host.rig.headClear > 0 ? v(0.15, 1.45, TRAY.center.z + 1.9) : v(hips.x + 0.7, 1.25, hips.z + 2.35)
    return { pos, target: v((hips.x + TRAY.center.x) / 2, 0.85, (hips.z + TRAY.center.z) / 2), fov: 34, smooth: 0.7, handheld: 1, focus: TRAY.center.clone(), bokeh: 2, letterbox: 1 }
  },
  presented: (t, p) => {
    const head = host.headWorld(_a)
    // once the ticket is out, it replaces the ball as the second subject of the two-shot
    const ball = _b.copy(ticket.visible ? ticket.pos : hero.pos)
    // frame face + ball, weighted toward the face (chibi head is large)
    const mid = _c.copy(head).lerp(ball, 0.4)
    const yaw = host.yaw + 0.25 + Math.sin(t * 0.08) * 0.13 // ~15° slow orbit
    const dist = 2.2
    return {
      pos: v(mid.x + Math.sin(yaw) * dist, mid.y + 0.06, mid.z + Math.cos(yaw) * dist),
      target: mid.clone(),
      fov: 32,
      smooth: 0.8,
      handheld: 0.8,
      focus: ball.clone().lerp(head, p.focusMix),
      bokeh: 4,
      letterbox: 1,
    }
  },
  opening: (_t, p) => {
    // hold on where the ball was opened (don't follow the halves down to the tray)
    const ball = _b.copy(shotTargets.openAt)
    const head = host.headWorld(_a)
    const dir = _c.subVectors(head, ball).setY(0).normalize()
    const yaw = host.yaw + 0.2
    const d = 1.9 - p.push * 0.3
    return {
      pos: v(ball.x + Math.sin(yaw) * d, ball.y + 0.18, ball.z + Math.cos(yaw) * d),
      target: ball.clone().addScaledVector(dir, 0.05),
      fov: 26,
      smooth: 0.45,
      handheld: 0.8,
      focus: ball.clone(),
      bokeh: 5,
      letterbox: 1,
    }
  },
  ticket: () => ({
    pos: ticketCam.pos.clone(),
    target: ticketCam.target.clone(),
    fov: 32,
    smooth: 0.9,
    handheld: 0.5,
    parallax: true,
    focus: ticket.pos.clone(),
    bokeh: 6,
    fitWidth: 0.56,
  }),
  finished: () => ({ pos: v(0, 3.3, 8.6), target: v(0, 1.5, 0), fov: 38, smooth: 2.5, handheld: 0.6, bokeh: 0 }),
  settings: () => ({ pos: v(PROPS.radio.x + 0.7, 1.5, PROPS.radio.z + 1.35), target: v(PROPS.radio.x + 0.05, 1.0, PROPS.radio.z + 0.1), fov: 34, smooth: 0.8, handheld: 0.5, focus: PROPS.radio.clone().setY(1), bokeh: 2 }),
} satisfies Record<string, ShotFn>

export type ShotName = keyof typeof SHOT_TABLE
export const SHOTS: Record<ShotName, ShotFn> = SHOT_TABLE

/** Live points some shots track (written by the Director). */
export const shotTargets = {
  ball: TRAY.center.clone(),
  openAt: TRAY.center.clone(),
}

const TICKET_CAM = {
  pos: v(0.3, 1.28, 2.75),
  target: v(0.3, 1.26, 1.7),
  ticketPos: v(0.3, 1.26, 1.86),
}
/** the whole ticket close-up (camera + ticket) slides by the rig's shift, e.g. away from a big chibi head */
const shifted = (p: Vector3) => p.clone().add(_tShift.set(host.rig.ticketShot.x, host.rig.ticketShot.y, 0))
const _tShift = new Vector3()

/** Where the ticket is presented in front of the camera (world). */
export const ticketCam = {
  get pos() {
    return shifted(TICKET_CAM.pos)
  },
  get target() {
    return shifted(TICKET_CAM.target)
  },
  get ticketPos() {
    return shifted(TICKET_CAM.ticketPos)
  },
}

