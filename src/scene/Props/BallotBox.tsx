import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { COLORS } from '../layout'

/** Outer size of the ballot box (m): width × height × depth. */
export const BALLOT_SIZE = { w: 0.34, h: 0.24, d: 0.24 }

/** Stage ballot box state, driven by the Director (carried by the host, opened, set down). */
export const ballot = {
  visible: false,
  pos: new Vector3(),
  quat: new Quaternion(),
  /** 0 closed → 1 lid fully open */
  lid: 0,
  scale: 1,
  /** warm glow spilling out of the open box */
  glow: 0,
}

const wood = new MeshStandardMaterial({ color: '#4a1f12', roughness: 0.45, metalness: 0.05 })
const brassMat = new MeshStandardMaterial({ color: COLORS.brass, roughness: 0.3, metalness: 1 })
const velvetMat = new MeshStandardMaterial({ color: '#3a0408', roughness: 0.95 })

/**
 * Lacquered wooden ballot box with brass corners and a hinged lid (hinge at the back).
 * Origin = centre of the bottom face. Pass `state` to drive it from shared state, or props for a
 * static preview.
 */
export function BallotBox({ state = ballot, preview = false }: { state?: typeof ballot; preview?: boolean }) {
  const root = useRef<Group>(null)
  const lid = useRef<Group>(null)
  const glowMat = useMemo(() => new MeshStandardMaterial({ color: '#000', emissive: new Color(1, 0.75, 0.4), emissiveIntensity: 0, toneMapped: false }), [])
  const { w, h, d } = BALLOT_SIZE
  const corners = useMemo(() => {
    const out: [number, number, number][] = []
    for (const x of [-1, 1]) for (const z of [-1, 1]) out.push([(x * w) / 2, h / 2, (z * d) / 2])
    return out
  }, [w, h, d])
  const edgeGeo = useMemo(() => new BoxGeometry(0.018, h + 0.004, 0.018), [h])

  useFrame(() => {
    const g = root.current
    if (!g) return
    g.visible = state.visible
    if (!state.visible) return
    if (!preview) {
      g.position.copy(state.pos)
      g.quaternion.copy(state.quat)
    }
    g.scale.setScalar(state.scale)
    if (lid.current) lid.current.rotation.x = -state.lid * 1.9
    glowMat.emissiveIntensity = state.glow * 2.5
  })

  return (
    <group ref={root} visible={false}>
      {/* body: walls + floor (open top so the lid reveals the inside) */}
      <mesh material={wood} position={[0, 0.006, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.012, d]} />
      </mesh>
      <mesh material={wood} position={[0, h / 2, d / 2 - 0.006]} castShadow>
        <boxGeometry args={[w, h, 0.012]} />
      </mesh>
      <mesh material={wood} position={[0, h / 2, -d / 2 + 0.006]} castShadow>
        <boxGeometry args={[w, h, 0.012]} />
      </mesh>
      <mesh material={wood} position={[-w / 2 + 0.006, h / 2, 0]} castShadow>
        <boxGeometry args={[0.012, h, d]} />
      </mesh>
      <mesh material={wood} position={[w / 2 - 0.006, h / 2, 0]} castShadow>
        <boxGeometry args={[0.012, h, d]} />
      </mesh>
      {/* velvet lining + glow of the tickets inside */}
      <mesh material={velvetMat} position={[0, 0.014, 0]}>
        <boxGeometry args={[w - 0.03, 0.004, d - 0.03]} />
      </mesh>
      <mesh material={glowMat} position={[0, 0.02, 0]}>
        <boxGeometry args={[w - 0.05, 0.002, d - 0.05]} />
      </mesh>
      {/* brass corners and a front plaque */}
      {corners.map((c, i) => (
        <mesh key={i} geometry={edgeGeo} material={brassMat} position={c} />
      ))}
      <mesh material={brassMat} position={[0, h * 0.55, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.4, h * 0.22, 0.004]} />
      </mesh>
      {/* lid hinged at the back edge, with a ballot slot */}
      <group ref={lid} position={[0, h, -d / 2]}>
        <mesh material={wood} position={[0, 0.008, d / 2]} castShadow>
          <boxGeometry args={[w + 0.012, 0.016, d + 0.012]} />
        </mesh>
        <mesh material={brassMat} position={[0, 0.017, d / 2]}>
          <boxGeometry args={[w * 0.5, 0.004, 0.03]} />
        </mesh>
      </group>
    </group>
  )
}
