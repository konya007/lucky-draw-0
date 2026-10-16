import { Quaternion, Vector3 } from 'three'
import { CAGE } from '../layout'

export interface BoxSpec {
  pos: Vector3
  quat: Quaternion
  half: Vector3
}

/**
 * The drum is approximated with a shell of thin overlapping cuboid "tiles" (cheap compound
 * primitives instead of a trimesh) plus four radial baffles that scoop balls up as it turns.
 * All positions are in drum-local space (origin = drum center, rotation axis = X).
 */
export function drumColliders(): BoxSpec[] {
  const R = CAGE.radius
  const thick = 0.012
  const out: BoxSpec[] = []
  const up = new Vector3(0, 0, 1)
  const bands = 16
  for (let b = 0; b <= bands; b++) {
    const lat = -Math.PI / 2 + (b / bands) * Math.PI
    const ringR = Math.cos(lat) * R
    const count = Math.max(1, Math.round((2 * Math.PI * ringR) / 0.08))
    const tileH = ((Math.PI * R) / bands) * 0.62 + 0.004
    const tileW = count === 1 ? 0.08 : ((2 * Math.PI * ringR) / count) * 0.62 + 0.004
    for (let k = 0; k < count; k++) {
      const lon = (k / count) * Math.PI * 2
      const n = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
      const pos = n.clone().multiplyScalar(R + thick)
      // orient the tile's local Z along the surface normal
      const quat = new Quaternion().setFromUnitVectors(up, n)
      out.push({ pos, quat, half: new Vector3(tileW, Math.max(tileH, 0.03), thick) })
    }
  }
  return out
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
