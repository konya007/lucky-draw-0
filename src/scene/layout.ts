import { Vector3 } from 'three'

/**
 * Stage blocking (meters). Floor y=0, audience looks toward -Z.
 * Everything that must agree spatially (physics, host paths, camera shots, lights) reads from here.
 */
export const CAGE = {
  center: new Vector3(0, 1.05, 0),
  radius: 0.4,
  /** axis of rotation is world X */
  axisHalf: 0.62,
  /** lid opening at the top (local, before rotation) */
  lidAngle: 0.36,
}
export const BALL_RADIUS = (CAGE.radius * 2) / 12 / 2 // ≈ 0.033

/** Crank sits on +X end of the axle. */
export const CRANK = {
  hub: new Vector3(0.66, CAGE.center.y, 0),
  armLength: 0.17,
  knobOffsetX: 0.09,
}

/** Outlet at the front-bottom of the drum (50° below the front). */
const outletAngle = (50 * Math.PI) / 180
export const OUTLET = {
  point: new Vector3(0, CAGE.center.y - Math.sin(outletAngle) * CAGE.radius, Math.cos(outletAngle) * CAGE.radius),
  angle: outletAngle,
}

/** Chute floor surface from the outlet lip down over the tray's back rim. */
export const CHUTE = {
  start: new Vector3(0, 0.7, 0.3),
  end: new Vector3(0, 0.627, 0.63),
  width: 0.1,
}

export const TABLE = {
  center: new Vector3(0, 0, 0.74),
  top: 0.58,
  width: 0.95,
  depth: 0.34,
}

export const TRAY = {
  center: new Vector3(0, TABLE.top + 0.005, 0.74),
  size: [0.4, 0.26] as [number, number],
  rim: 0.03,
}

export const TICKET_BOX = new Vector3(0.34, TABLE.top, 0.74)

export const PROPS = {
  radio: new Vector3(-2.15, 0, 0.95),
  clipboard: new Vector3(2.15, 0, 0.95),
}

export const STAGE = {
  width: 11,
  depthBack: -3.2,
  front: 2.25,
  curtainZ: 1.95,
  curtainHalfWidth: 3.4,
  curtainHeight: 4.6,
}

/**
 * Host blocking marks. The host's footprint (body + sleeves + wings) is ~0.3 m in radius,
 * so every mark/path keeps that clearance from the cage frame, the crank sweep and the table.
 */
export const HOST_RADIUS = 0.3
export const MARKS = {
  wing: new Vector3(-4.6, 0, -0.7),
  /** right of the crank (crank sweep reaches x≈0.76) */
  crank: new Vector3(1.12, 0, 0.18),
  /** at the right end of the table (edge x≈0.48), reaching to the tray from the side */
  tray: new Vector3(0.84, 0, 0.76),
  bow: new Vector3(1.0, 0, 1.25),
}

export const FLOAT_CLOUD = { center: new Vector3(0, 2.75, 0.4), spread: new Vector3(2.4, 0.5, 0.7) }

export const BALL_COLORS = [
  '#FF3B5C', '#FF8A1F', '#FFD23F', '#3BD16F', '#1FC8C8', '#2F7BFF',
  '#7A4DFF', '#E04DFF', '#FF5FA2', '#FFFFFF', '#1B1B1B', '#C9A24A',
]

export const COLORS = {
  bg: '#07070A',
  bg2: '#0E0E13',
  velvet: '#7A0A12',
  velvetDark: '#2A0306',
  velvetSheen: '#C2283A',
  brass: '#B8893B',
  brassHi: '#F2D28A',
  key: '#FFE3B0',
  fill: '#FFD49A',
  rim: '#8FB4FF',
  follow: '#FFF1D6',
  pin: '#FFE9C2',
  foot: '#FF9A5A',
}
