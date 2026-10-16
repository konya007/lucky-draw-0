import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointLight, ShaderMaterial } from 'three'
import { ballSystem } from '../Balls/ballSystem'
import { useSettingsStore } from '../../store/useSettingsStore'
import { QUALITY } from '../../quality/qualityPresets'
import { MAX_BALLS } from '../../lib/parseEntries'

const LEN = 8

/**
 * Short fading ribbon of points behind every flying ball (ring buffer per ball, one Points draw call).
 * On High/Ultra the first N flying balls also carry a small coloured point light that tints the brass.
 */
export function BallTrail() {
  const level = useSettingsStore((s) => s.level)
  const nLights = QUALITY[level].flyLights
  const points = useRef<Points>(null)
  const lightRefs = useRef<(PointLight | null)[]>([])
  const { geo, hist, head } = useMemo(() => {
    const n = MAX_BALLS * LEN
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(n), 1))
    return { geo: g, hist: new Float32Array(n * 3), head: new Uint8Array(MAX_BALLS) }
  }, [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexColors: true,
        vertexShader: /* glsl */ `
          attribute float alpha; varying float vA; varying vec3 vC;
          void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = 26.0 * alpha / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying vec3 vC;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;
            gl_FragColor = vec4(vC * a * 1.4, a); }`,
      }),
    [],
  )

  useFrame(() => {
    const pos = geo.attributes.position as BufferAttribute
    const col = geo.attributes.color as BufferAttribute
    const al = geo.attributes.alpha as BufferAttribute
    let li = 0
    for (const b of ballSystem.balls) {
      const flying = b.mode === 'fly'
      const base = b.i * LEN
      if (flying) {
        head[b.i] = (head[b.i] + 1) % LEN
        const h = (base + head[b.i]) * 3
        hist[h] = b.pos.x
        hist[h + 1] = b.pos.y
        hist[h + 2] = b.pos.z
        if (li < nLights) {
          const l = lightRefs.current[li++]
          if (l) {
            l.position.copy(b.pos)
            l.color.copy(b.color)
            l.intensity = 0.35
          }
        }
      }
      for (let k = 0; k < LEN; k++) {
        const idx = (head[b.i] - k + LEN) % LEN
        const h = (base + idx) * 3
        pos.setXYZ(base + k, hist[h], hist[h + 1], hist[h + 2])
        col.setXYZ(base + k, b.color.r, b.color.g, b.color.b)
        al.setX(base + k, flying ? (1 - k / LEN) * 0.8 * b.scale : 0)
      }
    }
    for (; li < nLights; li++) {
      const l = lightRefs.current[li]
      if (l) l.intensity = 0
    }
    pos.needsUpdate = col.needsUpdate = al.needsUpdate = true
  })

  return (
    <group>
      <points ref={points} geometry={geo} material={mat} frustumCulled={false} raycast={() => null} />
      {Array.from({ length: nLights }).map((_, i) => (
        <pointLight key={i} ref={(l) => (lightRefs.current[i] = l)} intensity={0} distance={0.9} decay={2} />
      ))}
    </group>
  )
}
