import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector3 } from 'three'
import { FIXTURES, beamTargets } from '../Lights'
import { cage, lights } from '../../director/channels'
import { CAGE } from '../layout'

const N = 1400

/**
 * Dust drifting in the air, only visible where a beam passes (inside the KEY and FOLLOW cones,
 * evaluated per-vertex in the shader). Dust near the drum swirls with the cage speed.
 */
export function DustMotes() {
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    const p = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - 0.5) * 7
      p[i * 3 + 1] = Math.random() * 5
      p[i * 3 + 2] = -1.8 + Math.random() * 4.2
      seed[i] = Math.random()
    }
    g.setAttribute('position', new BufferAttribute(p, 3))
    g.setAttribute('seed', new BufferAttribute(seed, 1))
    return g
  }, [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uT: { value: 0 },
          uApex: { value: [new Vector3(), new Vector3()] },
          uDir: { value: [new Vector3(), new Vector3()] },
          uCos: { value: [0.9, 0.9] },
          uLvl: { value: [0, 0] },
          uSwirl: { value: 0 },
          uCage: { value: CAGE.center },
        },
        vertexShader: /* glsl */ `
          attribute float seed;
          uniform float uT, uSwirl; uniform vec3 uApex[2]; uniform vec3 uDir[2]; uniform float uCos[2]; uniform float uLvl[2];
          uniform vec3 uCage;
          varying float vA;
          void main() {
            vec3 p = position;
            p += vec3(sin(uT * 0.11 + seed * 40.0), sin(uT * 0.07 + seed * 17.0) * 0.6, cos(uT * 0.09 + seed * 23.0)) * 0.35;
            p.y = mod(p.y + uT * 0.02 * (seed - 0.3), 5.0);
            // swirl around the drum axis (X) proportional to spin speed
            vec3 r = p - uCage; float fall = exp(-dot(r.yz, r.yz) * 2.0) * step(abs(r.x), 0.8);
            float a = uSwirl * fall;
            p.yz = uCage.yz + mat2(cos(a), -sin(a), sin(a), cos(a)) * r.yz;
            float lit = 0.0;
            for (int i = 0; i < 2; i++) {
              vec3 d = p - uApex[i];
              float c = dot(normalize(d), uDir[i]);
              lit += smoothstep(uCos[i], mix(uCos[i], 1.0, 0.4), c) * uLvl[i];
            }
            vA = lit * (0.4 + 0.6 * fract(seed * 13.7));
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (2.0 + seed * 3.0) * 6.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA;
            if (a < 0.003) discard; gl_FragColor = vec4(vec3(1.0, 0.9, 0.75) * a, a); }`,
      }),
    [],
  )
  const swirl = useMemo(() => ({ v: 0 }), [])
  useFrame((s, dt) => {
    const u = mat.uniforms
    u.uT.value = s.clock.elapsedTime
    swirl.v += cage.omega * dt * 0.3
    u.uSwirl.value = swirl.v
    const set = (i: number, from: Vector3, to: Vector3, angle: number, lvl: number) => {
      u.uApex.value[i].copy(from)
      u.uDir.value[i].subVectors(to, from).normalize()
      u.uCos.value[i] = Math.cos(angle)
      u.uLvl.value[i] = lvl
    }
    set(0, FIXTURES.key.pos, beamTargets.key, FIXTURES.key.angle, lights.key * lights.master)
    set(1, FIXTURES.follow.pos, beamTargets.follow, lights.followAngle, lights.follow * lights.master)
  })
  return <points geometry={geo} material={mat} frustumCulled={false} raycast={() => null} />
}
