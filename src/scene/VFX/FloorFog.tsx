import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { ShaderMaterial } from 'three'
import { lights } from '../../director/channels'

/** Thin layers of low-lying stage haze: noise scrolled slowly, very low alpha. */
export function FloorFog({ layers }: { layers: number }) {
  const mats = useMemo(
    () =>
      Array.from({ length: layers }, (_, i) =>
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uT: { value: 0 }, uSeed: { value: i * 7.3 }, uL: { value: 1 } },
          vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
          fragmentShader: /* glsl */ `
            uniform float uT, uSeed, uL; varying vec2 vUv; varying vec3 vW;
            float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
              return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
            float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
            void main(){
              vec2 p = vW.xz * 0.6 + vec2(uT * 0.03, uT * 0.017) + uSeed;
              float f = fbm(p) * fbm(p * 0.5 - uT * 0.01);
              float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
              float a = f * edge * 0.16 * uL;
              gl_FragColor = vec4(vec3(0.85, 0.78, 0.7) * a, a);
            }`,
        }),
      ),
    [layers],
  )
  useFrame((s) => {
    const lvl = Math.min(1.2, lights.key * 0.6 + lights.follow * 0.4 + 0.1) * lights.master
    for (const m of mats) {
      m.uniforms.uT.value = s.clock.elapsedTime
      m.uniforms.uL.value = lvl
    }
  })
  return (
    <group>
      {mats.map((m, i) => (
        <mesh key={i} material={m} rotation-x={-Math.PI / 2} position={[0, 0.04 + i * 0.09, -0.4]} raycast={() => null} renderOrder={5}>
          <planeGeometry args={[9, 5]} />
        </mesh>
      ))}
    </group>
  )
}
