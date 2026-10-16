import type { BufferGeometry } from 'three'

/**
 * Replace zero-length (or NaN) vertex normals with a fallback direction.
 * A zero normal makes the shader's normalize() return NaN; one NaN pixel is then smeared by the
 * bloom blur into flickering black squares. This happens e.g. on a paper crease folded 180°
 * (the two faces' normals cancel) or on degenerate vertices in imported models.
 * Returns how many normals were fixed.
 */
export function fixZeroNormals(geo: BufferGeometry, fx = 0, fy = 0, fz = 1): number {
  const n = geo.attributes.normal
  if (!n) return 0
  let fixed = 0
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i)
    const y = n.getY(i)
    const z = n.getZ(i)
    const l = x * x + y * y + z * z
    if (!(l > 1e-12)) {
      // catches 0 and NaN
      n.setXYZ(i, fx, fy, fz)
      fixed++
    }
  }
  if (fixed) n.needsUpdate = true
  return fixed
}
