import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, MeshBasicMaterial, Vector3 } from 'three'
import { useStageConfig } from '../../store/useStageConfig'
import { lights } from '../../director/channels'
import { LightCone } from './LightCone'

let poolTex: CanvasTexture | null = null
function poolTexture() {
  if (poolTex) return poolTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.45)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  poolTex = new CanvasTexture(c)
  return poolTex
}

/**
 * Cheap "light from the rig above" on the props (stage-config.json → propLights):
 * a soft billboard beam + an additive light pool on the floor. No real light sources, so it
 * costs a couple of transparent quads per prop and nothing per pixel elsewhere.
 */
export function PropLights() {
  const cfg = useStageConfig((s) => s.propLights)
  const mat = useMemo(
    () => new MeshBasicMaterial({ map: poolTexture(), color: new Color(cfg.color), transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [cfg.color],
  )
  const items = useMemo(() => cfg.items.map((it) => ({ ...it, from: new Vector3(...it.from), target: new Vector3(...it.target) })), [cfg.items])

  useFrame(() => {
    // follows the stage master level so the pools fade with every cue
    mat.opacity = cfg.poolStrength * Math.min(1, lights.key * 0.6 + lights.fillL * 0.4) * lights.master
  })

  if (!cfg.enabled) return null
  return (
    <group>
      {items.map((it) => (
        <group key={it.name}>
          <LightCone
            from={it.from}
            to={() => it.target}
            angle={() => Math.atan(it.radius / it.from.distanceTo(it.target))}
            color={cfg.color}
            level={() => Math.min(1, lights.key * 0.6 + lights.fillL * 0.4) * lights.master}
            strength={cfg.beamStrength}
          />
          <mesh material={mat} position={[it.target.x, 0.006, it.target.z]} rotation-x={-Math.PI / 2} raycast={() => null} renderOrder={6}>
            <planeGeometry args={[it.radius * 2, it.radius * 2]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
