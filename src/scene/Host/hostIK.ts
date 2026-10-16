import { Bone, Object3D, Quaternion, Vector3 } from 'three'

const _p = new Vector3()
const _a = new Vector3()
const _b = new Vector3()
const _q = new Quaternion()
const _pq = new Quaternion()
const _pqi = new Quaternion()

/**
 * Apply a WORLD-space rotation to a bone, keeping its world position.
 * local' = parentWorld⁻¹ · qWorld · parentWorld · local
 */
export function rotateWorld(bone: Object3D, qWorld: Quaternion, update = true) {
  const parent = bone.parent!
  parent.getWorldQuaternion(_pq)
  _pqi.copy(_pq).invert()
  bone.quaternion.premultiply(_pq).premultiply(qWorld).premultiply(_pqi)
  if (update) bone.updateMatrixWorld(true)
}

/** Set a bone's WORLD orientation directly. */
export function setWorldQuaternion(bone: Object3D, qWorld: Quaternion) {
  bone.parent!.getWorldQuaternion(_pq)
  bone.quaternion.copy(_pq.invert().multiply(qWorld))
  bone.updateMatrixWorld(true)
}

/** Move a bone by a WORLD-space offset (converted into its parent's space). */
export function translateWorld(bone: Object3D, delta: Vector3) {
  bone.getWorldPosition(_p).add(delta)
  bone.parent!.worldToLocal(_p)
  bone.position.copy(_p)
  bone.updateMatrixWorld(true)
}

/** Rotate `bone` so the direction toward `fromW` now points toward `toW` (minimal rotation). */
export function aim(bone: Object3D, fromW: Vector3, toW: Vector3, weight = 1) {
  bone.getWorldPosition(_p)
  _a.subVectors(fromW, _p)
  _b.subVectors(toW, _p)
  if (_a.lengthSq() < 1e-10 || _b.lengthSq() < 1e-10) return
  _q.setFromUnitVectors(_a.normalize(), _b.normalize())
  if (weight < 1) _q.slerp(IDENTITY, 1 - weight)
  rotateWorld(bone, _q)
}
const IDENTITY = new Quaternion()

const A = new Vector3()
const B = new Vector3()
const C = new Vector3()
const T = new Vector3()
const dir = new Vector3()
const perp = new Vector3()
const Bn = new Vector3()

/**
 * Analytic two-bone IK (shoulder→elbow→wrist or hip→knee→ankle).
 * Law of cosines gives the mid-joint position in the plane defined by the pole point,
 * then each bone is aimed in turn. Works for any rest axis convention since it only aims.
 * Returns how far the chain fell short of the target (0 = reached).
 */
export function solveTwoBone(upper: Bone, mid: Bone, end: Bone, target: Vector3, pole: Vector3, weight = 1, extend = 0): number {
  upper.getWorldPosition(A)
  mid.getWorldPosition(B)
  end.getWorldPosition(C)
  const la = A.distanceTo(B)
  // `extend`: the visible effector sits this far past `end` along the lower bone (long sleeves, tools…)
  const lb = B.distanceTo(C) + extend
  if (extend > 0) C.sub(B).setLength(lb).add(B)
  T.copy(C).lerp(target, weight)
  dir.subVectors(T, A)
  const want = dir.length()
  const dist = Math.min(Math.max(want, Math.abs(la - lb) + 1e-3), (la + lb) * 0.9995)
  dir.normalize()
  T.copy(A).addScaledVector(dir, dist)
  const cosA = Math.min(1, Math.max(-1, (la * la + dist * dist - lb * lb) / (2 * la * dist)))
  const sinA = Math.sqrt(1 - cosA * cosA)
  // bend direction: pole projected onto the plane perpendicular to A→T
  perp.subVectors(pole, A)
  perp.addScaledVector(dir, -perp.dot(dir))
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dir, -dir.z)
  perp.normalize()
  Bn.copy(A).addScaledVector(dir, la * cosA).addScaledVector(perp, la * sinA)
  aim(upper, B, Bn)
  end.getWorldPosition(C)
  aim(mid, C, T)
  return Math.max(0, want - dist)
}
