import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'

const _d = new Vector3()
const _x = new Vector3()
const _y = new Vector3()
const _z = new Vector3()
const _c = new Vector3()
const _mid = new Vector3()
const _m = new Matrix4()

/**
 * Fake volumetric beam as a camera-facing tapered billboard (axis = light direction; it only
 * rotates around that axis to face the lens). A gaussian across the width and a falloff along the
 * length give a soft shaft with no geometry facets; slow noise reads as haze/dust.
 * Intensity follows the fixture's live level so cues fade beams too.
 */
export function LightCone({
  from,
  to,
  angle,
  color,
  level,
  strength = 0.07,
}: {
  from: Vector3
  to: () => Vector3
  angle: () => number
  color: string
  level: () => number
  strength?: number
}) {
  const mesh = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera)
  const inside = useRef(1)
  const geo = useMemo(() => new PlaneGeometry(1, 1, 1, 1), [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uColor: { value: new Color(color) }, uI: { value: 0 }, uT: { value: 0 }, uApex: { value: 0.04 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vP;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vP = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uI; uniform float uT; uniform float uApex;
          varying vec2 vUv; varying vec3 vP;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
          float n3(vec3 p){
            vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
          }
          void main() {
            float along = 1.0 - vUv.y;                // 0 at the lamp → 1 at the target
            float halfW = mix(uApex, 1.0, along);     // cone taper drawn inside the quad
            float x = (vUv.x - 0.5) * 2.0 / halfW;
            float across = exp(-x * x * 2.5);
            float len = pow(1.0 - along, 0.7) * smoothstep(0.0, 0.08, along) + 0.15 * smoothstep(0.85, 1.0, along);
            float haze = 0.7 + 0.3 * n3(vP * 1.8 + vec3(0.0, uT * 0.05, uT * 0.03));
            float near = smoothstep(0.6, 2.2, distance(cameraPosition, vP));
            gl_FragColor = vec4(uColor * across * len * haze * near * uI, 1.0);
          }`,
      }),
    [color],
  )

  useFrame((s) => {
    const m = mesh.current
    if (!m) return
    const target = to()
    _d.subVectors(target, from)
    const len = _d.length()
    _d.normalize()
    const a = angle()
    const r = Math.tan(a) * len
    // face the camera: x ⟂ (beam axis, view direction)
    camera.getWorldPosition(_c)
    _mid.copy(from).addScaledVector(_d, len / 2)
    _z.subVectors(_c, _mid).normalize()
    _x.crossVectors(_d, _z)
    if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0)
    _x.normalize()
    _z.crossVectors(_x, _d).normalize()
    // plane local +Y points at the lamp (uv.y = 1 there)
    _y.copy(_d).multiplyScalar(-len)
    _m.makeBasis(_x.multiplyScalar(r * 2), _y, _z).setPosition(_mid)
    m.matrix.copy(_m)
    m.matrixWorldNeedsUpdate = true
    // camera inside the beam → fade it out (the shaft would wrap the lens)
    _c.sub(from)
    const want = _c.angleTo(_d) < a * 1.2 ? 0 : 1
    inside.current += (want - inside.current) * 0.1
    mat.uniforms.uI.value = level() * strength * 1.5 * inside.current
    mat.uniforms.uT.value = s.clock.elapsedTime
    m.visible = mat.uniforms.uI.value > 0.001
  })

  return <mesh ref={mesh} geometry={geo} material={mat} matrixAutoUpdate={false} renderOrder={10} frustumCulled={false} raycast={() => null} />
}
