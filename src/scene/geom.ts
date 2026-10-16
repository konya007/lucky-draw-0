import { BufferGeometry, CylinderGeometry, Matrix4, Quaternion, TorusGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const Y = new Vector3(0, 1, 0)

/** Cylinder whose axis runs from a to b. */
export function rod(a: Vector3, b: Vector3, r: number, seg = 8): BufferGeometry {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const g = new CylinderGeometry(r, r, len, seg, 1, false)
  const q = new Quaternion().setFromUnitVectors(Y, dir.normalize())
  g.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(1, 1, 1)))
  return g
}

/** Ring of radius r around `axis`, centered at c. */
export function ring(c: Vector3, axis: Vector3, r: number, tube: number, seg = 64): BufferGeometry {
  const g = new TorusGeometry(r, tube, 6, seg)
  // torus lies in XY (normal = Z)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis.clone().normalize())
  g.applyMatrix4(new Matrix4().compose(c, q, new Vector3(1, 1, 1)))
  return g
}

/** Merge geometries after stripping attributes that don't match (keeps position/normal/uv). */
export function merge(geos: BufferGeometry[]): BufferGeometry {
  const clean = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k)
    return n
  })
  const m = mergeGeometries(clean, false)
  geos.forEach((g) => g.dispose())
  return m!
}

export function basisMatrix(x: Vector3, y: Vector3, z: Vector3, pos: Vector3) {
  return new Matrix4().makeBasis(x, y, z).setPosition(pos)
}
