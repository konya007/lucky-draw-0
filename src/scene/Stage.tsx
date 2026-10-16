import { useMemo } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import { STAGE } from './layout'
import { brass, matteBlack } from './materials'
import { merge, rod } from './geom'
import { useSettingsStore } from '../store/useSettingsStore'
import { QUALITY } from '../quality/qualityPresets'
import { Curtain } from './Curtain'
import { Backstage } from './Backstage'
import { PropLights } from './VFX/PropLights'

/** Procedural dark plank texture (color + roughness in one canvas pass). */
function usePlanks() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 1024
    const g = c.getContext('2d')!
    const rows = 16
    for (let r = 0; r < rows; r++) {
      const y = (r / rows) * 1024
      let x = -Math.random() * 400
      while (x < 1024) {
        const len = 300 + Math.random() * 500
        const l = 14 + Math.random() * 8
        g.fillStyle = `hsl(${18 + Math.random() * 8}, ${30 + Math.random() * 15}%, ${l}%)`
        g.fillRect(x, y, len, 1024 / rows)
        // grain streaks
        for (let k = 0; k < 18; k++) {
          g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`
          g.fillRect(x, y + Math.random() * (1024 / rows), len, 1 + Math.random() * 2)
        }
        g.fillStyle = 'rgba(0,0,0,0.6)'
        g.fillRect(x, y, 2, 1024 / rows)
        x += len
      }
      g.fillStyle = 'rgba(0,0,0,0.7)'
      g.fillRect(0, y, 1024, 2)
    }
    const t = new CanvasTexture(c)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(3, 3)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
}

export function Stage() {
  const level = useSettingsStore((s) => s.level)
  const q = QUALITY[level]
  const planks = usePlanks()
  const width = STAGE.width
  const depth = STAGE.front - STAGE.depthBack
  const trussGeo = useMemo(() => {
    const parts = []
    for (const z of [-1.4, 0.6, 1.6]) {
      parts.push(rod(new Vector3(-4.5, 5.0, z), new Vector3(4.5, 5.0, z), 0.03))
      parts.push(rod(new Vector3(-4.5, 5.25, z), new Vector3(4.5, 5.25, z), 0.03))
      for (let x = -4.5; x <= 4.5; x += 0.5) parts.push(rod(new Vector3(x, 5.0, z), new Vector3(x + 0.5, 5.25, z), 0.012))
    }
    return merge(parts)
  }, [])

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (STAGE.front + STAGE.depthBack) / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        {q.reflectorRes > 0 ? (
          <MeshReflectorMaterial
            map={planks}
            resolution={q.reflectorRes}
            blur={[500, 120]}
            mixBlur={1}
            mixStrength={0.55}
            mixContrast={1}
            roughness={0.75}
            depthScale={0.6}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.2}
            metalness={0.25}
            color={new Color('#6e5a50')}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial map={planks} color="#6e5a50" roughness={0.45} metalness={0.2} envMapIntensity={0.6} />
        )}
      </mesh>
      {/* stage lip: brass trim + black apron + pit */}
      <mesh geometry={useMemo(() => rod(new Vector3(-width / 2, -0.01, STAGE.front), new Vector3(width / 2, -0.01, STAGE.front), 0.025, 12), [width])} material={brass} />
      <mesh position={[0, -0.6, STAGE.front + 0.01]} material={matteBlack}>
        <planeGeometry args={[width, 1.2]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.2, STAGE.front + 3]} material={matteBlack}>
        <planeGeometry args={[30, 6]} />
      </mesh>
      {/* back wall / backstage image (public/stage-config.json) */}
      <Backstage />
      <PropLights />
      {/* wings (black velvet legs) hide the host's entrance */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {[-1.6, 0.2].map((z, i) => (
            <mesh key={z} position={[s * (4.1 + i * 0.25), 2.4, z]} material={matteBlack} castShadow>
              <boxGeometry args={[1.0, 4.8, 0.04]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* proscenium: black header + pillars around the curtain */}
      <mesh position={[0, STAGE.curtainHeight + 0.6, STAGE.curtainZ + 0.3]} material={matteBlack}>
        <boxGeometry args={[12, 1.4, 0.2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (STAGE.curtainHalfWidth + 0.95), 2.6, STAGE.curtainZ + 0.3]} material={matteBlack}>
          <boxGeometry args={[1.5, 6, 0.2]} />
        </mesh>
      ))}
      {/* truss, barely visible in the dark */}
      <group>
        <mesh geometry={trussGeo} material={brass} />
      </group>
      <Curtain />
    </group>
  )
}
