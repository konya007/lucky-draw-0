import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, Mesh, MeshPhysicalMaterial, PlaneGeometry } from 'three'

const noRaycast = () => null
import { COLORS, STAGE } from './layout'
import { lights, stage } from '../director/channels'
import { director } from '../director/Director'

const shared = {
  uTime: { value: 0 },
  uOpen: { value: 0 },
  uWave: { value: 0.15 },
  uGobo: { value: 0 },
  uPoke: { value: 0 },
  uPokeX: { value: 0 },
}

/**
 * Velvet curtain panel. Folds are vertex displacement (sin across width + slow noise wave), normals are
 * rebuilt from finite differences, sheen comes from MeshPhysicalMaterial.sheen. Opening gathers each
 * panel toward its outer edge (folds deepen as they bunch). A fake gobo (leaf-pattern light) sweeps
 * across the closed curtain in the EDITING phase.
 */
function makeVelvet(side: -1 | 1 | 0) {
  const m = new MeshPhysicalMaterial({
    color: new Color(COLORS.velvet),
    roughness: 0.82,
    sheen: 1,
    sheenRoughness: 0.35,
    sheenColor: new Color(COLORS.velvetSheen),
    side: DoubleSide,
  })
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared, { uSide: { value: side }, uHalf: { value: STAGE.curtainHalfWidth } })
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime, uOpen, uWave, uSide, uHalf, uPoke, uPokeX;
        varying vec2 vCurtUv;
        varying float vFoldShade;
        // u: 0 outer edge → 1 inner edge (panels); v: 0 bottom → 1 top
        vec3 curtainPos(float u, float v) {
          float H = ${STAGE.curtainHeight.toFixed(2)};
          vec3 p;
          if (uSide == 0.0) {
            // valance: fixed width, scalloped hem
            float x = (u - 0.5) * 2.0 * (uHalf + 0.6);
            float y = H - 0.15 - (1.0 - v) * 0.9;
            float z = sin(u * 90.0) * 0.035 + sin(u * 6.2832 * 5.0) * 0.02;
            float swag = (1.0 - v) * (0.12 * abs(sin(u * 3.14159 * 5.0)));
            return vec3(x, y + swag, z + 0.25);
          }
          float outer = uSide * (uHalf + 0.15);
          float inner = -uSide * 0.08;
          // gather toward the outer edge; the bottom lags slightly (heavy fabric)
          float g = uOpen * (0.84 - 0.05 * (1.0 - v));
          float x = outer + (inner - outer) * u * (1.0 - g);
          float depth = 0.05 + uOpen * 0.11;
          float folds = sin(u * 3.14159 * 2.0 * 13.0) * depth + sin(u * 3.14159 * 2.0 * 5.3 + 1.7) * depth * 0.35;
          float w = uWave * (sin(u * 9.0 - uTime * 1.7 + v * 2.0) * 0.06 + sin(u * 23.0 + uTime * 1.1) * 0.02) * (1.0 - v * 0.6);
          float poke = uPoke * exp(-pow((x - uPokeX) * 2.5, 2.0)) * sin(uTime * 9.0) * 0.06 * (1.0 - v);
          p = vec3(x, v * H, folds + w + poke);
          return p;
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `float cu = uv.x; float cv = uv.y;
        if (uSide > 0.0) cu = 1.0 - uv.x;
        vec3 transformed = curtainPos(cu, cv);
        vCurtUv = vec2(transformed.x, cv);
        vFoldShade = transformed.z;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `float bu = uv.x; float bv = uv.y; if (uSide > 0.0) bu = 1.0 - uv.x;
        vec3 b0 = curtainPos(bu, bv);
        vec3 b1 = curtainPos(bu + 0.002, bv);
        vec3 b2 = curtainPos(bu, bv + 0.002);
        vec3 objectNormal = normalize(cross(b1 - b0, b2 - b0)) * (uSide > 0.0 ? -1.0 : 1.0);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif`,
      )
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime, uGobo;
        varying vec2 vCurtUv;
        varying float vFoldShade;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // deep shadow inside the folds
        diffuseColor.rgb *= 0.55 + 0.45 * smoothstep(-0.12, 0.12, vFoldShade);
        // gobo: a soft spot with a leafy breakup drifting across the curtain
        if (uGobo > 0.001) {
          vec2 c = vec2(sin(uTime * 0.13) * 2.2, 2.3 + sin(uTime * 0.21) * 0.4);
          vec2 d = vec2(vCurtUv.x, vCurtUv.y * 4.6) - c;
          float spot = exp(-dot(d, d) * 0.55);
          float leaf = smoothstep(0.35, 0.7, vnoise(vec2(vCurtUv.x, vCurtUv.y * 4.6) * 2.6 + uTime * 0.05));
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.42) * spot * (0.25 + leaf * 0.75) * uGobo * 0.55;
        }`,
      )
  }
  m.customProgramCacheKey = () => `curtain-${side}`
  return m
}

export function Curtain() {
  const geo = useMemo(() => new PlaneGeometry(1, 1, 220, 28), [])
  const valGeo = useMemo(() => new PlaneGeometry(1, 1, 260, 6), [])
  const left = useMemo(() => makeVelvet(-1), [])
  const right = useMemo(() => makeVelvet(1), [])
  const valance = useMemo(() => makeVelvet(0), [])
  const poke = useRef(0)

  useFrame((state, dt) => {
    shared.uTime.value = state.clock.elapsedTime
    shared.uOpen.value = stage.curtainOpen
    shared.uWave.value = stage.curtainWave
    shared.uGobo.value = lights.gobo
    poke.current = Math.max(0, poke.current - dt * 0.8)
    shared.uPoke.value = poke.current
  })

  const onPoke = (x: number) => {
    shared.uPokeX.value = x
    poke.current = 1
    director.curtainTap()
  }

  return (
    <group position={[0, 0, STAGE.curtainZ]}>
      {/* the plane positions are fully computed in the vertex shader; bounds are huge so disable culling */}
      <mesh geometry={geo} material={left} frustumCulled={false} receiveShadow raycast={noRaycast} />
      <mesh geometry={geo} material={right} frustumCulled={false} receiveShadow raycast={noRaycast} />
      <mesh geometry={valGeo} material={valance} frustumCulled={false} raycast={noRaycast} />
      {/* raycast proxies (the displaced vertices are GPU-only) */}
      <CurtainHitProxies onPoke={onPoke} />
    </group>
  )
}

/** Invisible boxes covering the gathered curtain areas so taps reach them. */
function CurtainHitProxies({ onPoke }: { onPoke: (x: number) => void }) {
  const l = useRef<Mesh>(null)
  const r = useRef<Mesh>(null)
  useFrame(() => {
    const H = STAGE.curtainHalfWidth
    const w = (H + 0.2) * (1 - stage.curtainOpen * 0.84)
    for (const [m, s] of [
      [l.current, -1],
      [r.current, 1],
    ] as const) {
      if (!m) continue
      m.scale.set(w, STAGE.curtainHeight, 1)
      m.position.set(s * (H + 0.15 - w / 2), STAGE.curtainHeight / 2, 0.02)
    }
  })
  return (
    <>
      {[l, r].map((ref, i) => (
        <mesh key={i} ref={ref} onPointerDown={(e) => (e.stopPropagation(), onPoke(e.point.x))}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      ))}
    </>
  )
}
