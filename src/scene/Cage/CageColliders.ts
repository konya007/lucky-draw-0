import { Quaternion, Vector3 } from 'three'
import { CAGE } from '../layout'

export interface BoxSpec {
  pos: Vector3
  quat: Quaternion
  half: Vector3
}

/** Radial paddles inside the drum (also drawn as brass slats). */
export function baffles(): BoxSpec[] {
  const R = CAGE.radius
  const out: BoxSpec[] = []
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const depth = 0.035
    const r = R - depth / 2 - 0.004
    const pos = new Vector3(0, Math.cos(a) * r, Math.sin(a) * r)
    const quat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), a)
    // length along X shortened so it fits inside the sphere
    out.push({ pos, quat, half: new Vector3(0.13, depth / 2, 0.005) })
  }
  return out
}
