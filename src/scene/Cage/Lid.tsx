import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Matrix4, SphereGeometry, Vector3 } from 'three'
import { CAGE } from '../layout'
import { brass } from '../materials'
import { stage } from '../../director/channels'
import { merge, ring } from '../geom'

/**
 * Hinged hatch on top of the drum (drum-local space). Hinge is the back edge; opening swings it up/back.
 * stage.lid is the hinge angle (tweened by the Director, with a 2° anticipation dip before opening).
 */
export function Lid() {
  const pivot = useRef<Group>(null)
  const { geo, hinge } = useMemo(() => {
    const a = CAGE.lidAngle
    const R = CAGE.radius
    const hinge = new Vector3(0, R * Math.cos(a), -R * Math.sin(a))
    const cap = new SphereGeometry(R + 0.004, 20, 4, 0, Math.PI * 2, 0, a)
    const rim = ring(new Vector3(0, R * Math.cos(a), 0), new Vector3(0, 1, 0), R * Math.sin(a), 0.006, 40)
    const knob = ring(new Vector3(0, R + 0.012, 0), new Vector3(0, 0, 1), 0.018, 0.004, 16)
    const g = merge([cap, rim, knob])
    g.applyMatrix4(new Matrix4().makeTranslation(-hinge.x, -hinge.y, -hinge.z))
    return { geo: g, hinge }
  }, [])

  useFrame(() => {
    if (pivot.current) pivot.current.rotation.x = -stage.lid
  })

  return (
    <group ref={pivot} position={hinge}>
      <mesh geometry={geo} material={brass} castShadow />
    </group>
  )
}
