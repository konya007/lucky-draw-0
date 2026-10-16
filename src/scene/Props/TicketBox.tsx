import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { TICKET_BOX, COLORS } from '../layout'
import { brass, darkWood } from '../materials'
import { useGameStore } from '../../store/useGameStore'
import { director } from '../../director/Director'
import { audio } from '../../audio/audioManager'

const _m = new Matrix4()
const _q = new Quaternion()
const _s = new Vector3(1, 1, 1)
const _p = new Vector3()

/** Little keepsake box beside the tray; collected tickets stack inside. Tap → draw history. */
export function TicketBox() {
  const count = useGameStore((s) => s.history.length)
  const [hover, setHover] = useState(false)
  const lid = useRef<Group>(null)
  const stack = useRef<InstancedMesh>(null)
  const lidMat = useMemo(() => {
    const m = brass.clone()
    m.emissive = new Color(COLORS.brassHi)
    return m
  }, [])
  const paper = useMemo(() => new MeshStandardMaterial({ color: '#efe4cc', roughness: 0.8 }), [])
  const open = useRef(0)
  useFrame((_, dt) => {
    open.current += ((hover ? 1 : 0) - open.current) * Math.min(1, dt * 8)
    if (lid.current) lid.current.rotation.x = -open.current * 0.5
    lidMat.emissiveIntensity = open.current * 0.5
    const st = stack.current
    if (st) {
      const n = Math.min(count, 24)
      st.count = n
      for (let i = 0; i < n; i++) {
        _q.setFromAxisAngle(_p.set(0, 1, 0), ((i * 37) % 11) * 0.03 - 0.15)
        _m.compose(_p.set(0, 0.012 + i * 0.0025, 0), _q, _s)
        st.setMatrixAt(i, _m)
      }
      st.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group
      position={TICKET_BOX}
      rotation-y={-0.3}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
        audio.play('tick', { vol: 0.35 })
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        director.openHistory()
      }}
    >
      <mesh position={[0, 0.03, 0]} material={darkWood} castShadow>
        <boxGeometry args={[0.16, 0.06, 0.11]} />
      </mesh>
      <instancedMesh ref={stack} args={[undefined, undefined, 24]} material={paper} position={[0, 0.03, 0]}>
        <boxGeometry args={[0.13, 0.002, 0.07]} />
      </instancedMesh>
      <group ref={lid} position={[0, 0.06, -0.055]}>
        <mesh position={[0, 0.006, 0.055]} material={lidMat} castShadow>
          <boxGeometry args={[0.165, 0.012, 0.115]} />
        </mesh>
      </group>
    </group>
  )
}
