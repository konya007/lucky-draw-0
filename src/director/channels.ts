import { Vector3 } from 'three'

/**
 * Animated values shared between the Director (writer, via GSAP) and scene components (readers, in useFrame).
 * Keeping them as plain mutable objects avoids React re-renders on every tween tick.
 */

/** Light levels are multipliers on each fixture's base intensity (1 = 100%). */
export const lights = {
  key: 0,
  fillL: 0,
  fillR: 0,
  rim: 0,
  follow: 0,
  pin: 0,
  foot: 0.25,
  practical: 0,
  burst: 0,
  /** global master on all fixtures (used for "stage holds its breath") */
  master: 1,
  /** ±5% / 6s breathing on/off (0..1) */
  breathe: 0,
  /** spinning flicker strength (0..1), multiplied by cage speed */
  flicker: 0,
  /** chase sweep after the opening (0..1) */
  chase: 0,
  /** follow spot cone angle (radians) */
  followAngle: 0.2,
  /** fill colour shift toward warm gold (0..1) */
  fillWarm: 0,
  /** editing gobo sweep on the curtain (0..1) */
  gobo: 1,
  burstColor: new Vector3(1, 0.85, 0.5),
}

export const stage = {
  /** 0 = closed, 1 = fully open */
  curtainOpen: 0,
  /** ripple amplitude in the velvet (animated, decays) */
  curtainWave: 0.15,
  /** lid hinge angle (radians, + = open) */
  lid: 0,
  /** outlet gate angle */
  gate: 0,
  /** emissive pulse on the current "invited" object (0..1) */
  invite: 0,
  /** which object is invited to be touched */
  invited: 'none' as 'none' | 'crank' | 'ball' | 'ticket' | 'clipboard',
  /** final text overlay opacity */
  finale: 0,
  /** idle cage rock (tiny) */
  cageRock: 0,
}

export const fx = {
  exposure: 1,
  bloom: 0.6,
  chroma: 0,
  flash: 0,
  letterbox: 0,
  vignette: 0.55,
  /** motion blur strength on the cage (0..1) */
  blur: 0,
}

/** Cage rotation state (radians, rad/s). Written by the spin controller. */
export const cage = {
  angle: 0,
  omega: 0,
  /** crank angle, geared 1:1 with the drum */
  crank: 0,
  /** user is dragging the crank */
  dragging: false,
}

/** Global playback speed for "click to fast-forward". */
export const clock = {
  speed: 1,
}
