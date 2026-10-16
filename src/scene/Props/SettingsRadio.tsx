import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, MeshStandardMaterial } from 'three'
import { PROPS, COLORS } from '../layout'
import { brass, darkWood } from '../materials'
import { director } from '../../director/Director'
import { audio } from '../../audio/audioManager'

const dialMat = new MeshStandardMaterial({ color: '#2a1a08', emissive: new Color('#FFB060'), emissiveIntensity: 0.6, roughness: 0.4 })
const hoverGlow = { v: 0 }

/** Antique radio on a side table. Tap → the settings panel (sound + graphics). */
export function SettingsRadio() {
  const body = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  useFrame((s) => {
    const pulse = 0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 2)
    hoverGlow.v += ((hover ? 1 : 0) - hoverGlow.v) * 0.15
    dialMat.emissiveIntensity = 0.45 + pulse * 0.1 + hoverGlow.v * 0.8
    brassEdge.emissiveIntensity = hoverGlow.v * 0.6
  })
  return (
    <group position={PROPS.radio}>
      {/* little side table */}
      <mesh position={[0, 0.42, 0]} material={darkWood} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 32]} />
      </mesh>
      <mesh position={[0, 0.21, 0]} material={brass} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.42, 12]} />
      </mesh>
      <mesh position={[0, 0.01, 0]} material={brass}>
        <cylinderGeometry args={[0.16, 0.18, 0.02, 24]} />
      </mesh>
      <group
        ref={body}
        position={[0, 0.44, 0]}
        rotation-y={0.35}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
          audio.play('tick', { vol: 0.4 })
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          director.openSettings()
        }}
      >
        {/* cabinet with arched top */}
        <mesh position={[0, 0.16, 0]} material={darkWood} castShadow>
          <boxGeometry args={[0.42, 0.32, 0.2]} />
        </mesh>
        <mesh position={[0, 0.32, 0]} rotation-x={Math.PI / 2} material={darkWood} castShadow>
          <cylinderGeometry args={[0.21, 0.21, 0.2, 24, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
        {/* brass grille + edge */}
        <mesh position={[0, 0.24, 0.101]} material={brassEdge}>
          <torusGeometry args={[0.12, 0.008, 6, 32]} />
        </mesh>
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} position={[-0.09 + i * 0.03, 0.24, 0.102]} material={brass}>
            <boxGeometry args={[0.006, 0.18 - Math.abs(i - 3) * 0.025, 0.004]} />
          </mesh>
        ))}
        {/* glowing tuning dial (practical) */}
        <mesh position={[0, 0.07, 0.102]} material={dialMat}>
          <boxGeometry args={[0.22, 0.05, 0.004]} />
        </mesh>
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} position={[x, 0.07, 0.11]} rotation-x={Math.PI / 2} material={brass}>
            <cylinderGeometry args={[0.022, 0.022, 0.02, 16]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const brassEdge = brass.clone()
brassEdge.emissive = new Color(COLORS.brassHi)
brassEdge.emissiveIntensity = 0
