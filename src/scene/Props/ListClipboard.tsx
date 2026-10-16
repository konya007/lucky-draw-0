import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, Group, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { PROPS, COLORS } from '../layout'
import { brass, darkWood } from '../materials'
import { director } from '../../director/Director'
import { audio } from '../../audio/audioManager'
import { stage } from '../../director/channels'

/** Paper sheet texture with ruled lines and a few handwritten-looking strokes. */
function usePaper() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 360
    const g = c.getContext('2d')!
    g.fillStyle = '#efe6d2'
    g.fillRect(0, 0, 256, 360)
    g.strokeStyle = 'rgba(80,60,40,0.25)'
    for (let y = 60; y < 350; y += 18) {
      g.beginPath()
      g.moveTo(20, y)
      g.lineTo(236, y)
      g.stroke()
    }
    g.strokeStyle = 'rgba(30,20,15,0.75)'
    g.lineWidth = 2
    for (let y = 56; y < 330; y += 18) {
      g.beginPath()
      let x = 26
      g.moveTo(x, y)
      const end = 90 + Math.random() * 130
      while (x < end) {
        x += 6
        g.lineTo(x, y - Math.random() * 6)
      }
      g.stroke()
    }
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
}

/** Clipboard on a little podium (stage right). Tap → back to the list editor. */
export function ListClipboard() {
  const paper = usePaper()
  const board = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const paperMat = useMemo(() => new MeshStandardMaterial({ map: paper, roughness: 0.85, emissive: new Color(COLORS.brassHi), emissiveIntensity: 0 }), [paper])
  const clipMat = useMemo(() => {
    const m = brass.clone()
    m.emissive = new Color(COLORS.brassHi)
    return m
  }, [])
  const lift = useRef(0)
  useFrame((s, dt) => {
    const invite = stage.invited === 'clipboard' ? stage.invite : 0
    lift.current += ((hover ? 1 : 0) - lift.current) * Math.min(1, dt * 10)
    clipMat.emissiveIntensity = lift.current * 0.6 + invite * 0.5
    paperMat.emissiveIntensity = lift.current * 0.05
    if (board.current) {
      board.current.position.y = 1.0 + lift.current * 0.02 + Math.sin(s.clock.elapsedTime * 1.2) * 0.002
      board.current.rotation.z = Math.sin(s.clock.elapsedTime * 7) * 0.02 * lift.current
    }
  })
  return (
    <group position={PROPS.clipboard} rotation-y={-0.4}>
      {/* podium */}
      <mesh position={[0, 0.45, 0]} material={darkWood} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.9, 0.3]} />
      </mesh>
      <mesh position={[0, 0.91, 0]} material={brass}>
        <boxGeometry args={[0.4, 0.02, 0.34]} />
      </mesh>
      <group
        ref={board}
        position={[0, 1.0, 0]}
        rotation-x={-1.15}
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
          audio.play('paper', { vol: 0.6 })
          director.toEditing()
        }}
      >
        <mesh material={darkWood} castShadow>
          <boxGeometry args={[0.24, 0.32, 0.008]} />
        </mesh>
        <mesh position={[0, -0.01, 0.0045]} material={paperMat}>
          <planeGeometry args={[0.21, 0.28]} />
        </mesh>
        <mesh position={[0, 0.14, 0.01]} material={clipMat}>
          <boxGeometry args={[0.1, 0.03, 0.012]} />
        </mesh>
      </group>
    </group>
  )
}
