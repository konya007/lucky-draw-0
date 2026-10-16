import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Group, Mesh, MeshStandardMaterial, Plane, Raycaster, Vector2, Vector3, CylinderGeometry, SphereGeometry } from 'three'
import { CRANK, COLORS } from '../layout'
import { brassGlow } from '../materials'
import { cage, stage } from '../../director/channels'
import { director } from '../../director/Director'
import { merge, rod } from '../geom'
import { audio } from '../../audio/audioManager'

/** World position of the knob for the current crank angle (used by host IK). */
export function knobWorld(out: Vector3, angle = cage.crank) {
  // arm points along local +Y at angle 0 and rotates about X
  return out.set(
    CRANK.hub.x + CRANK.knobOffsetX,
    CRANK.hub.y + Math.cos(angle) * CRANK.armLength,
    CRANK.hub.z + Math.sin(angle) * CRANK.armLength,
  )
}

const knobMat = new MeshStandardMaterial({ color: '#0d0a08', roughness: 0.35, emissive: COLORS.brassHi, emissiveIntensity: 0 })

/**
 * Z-shaped brass crank with a black wood knob — the main interactive object.
 * Click → host cranks automatically; circular drag → host's hand follows the knob at the user's speed.
 */
export function Crank() {
  const group = useRef<Group>(null)
  const knob = useRef<Mesh>(null)
  const wiggle = useRef(0)
  const { camera, gl, size } = useThree()
  const geo = useMemo(() => {
    const L = CRANK.armLength
    return merge([
      new CylinderGeometry(0.03, 0.03, 0.04, 20).rotateZ(Math.PI / 2),
      rod(new Vector3(0.0, 0, 0), new Vector3(0.0, L, 0), 0.011),
      rod(new Vector3(0.0, L, 0), new Vector3(CRANK.knobOffsetX - 0.035, L, 0), 0.008),
      new SphereGeometry(0.014, 12, 8).translate(0, L, 0),
    ])
  }, [])
  const knobGeo = useMemo(() => new CylinderGeometry(0.017, 0.015, 0.075, 16).rotateZ(Math.PI / 2), [])

  // ---- drag handling (world-space: ray vs the crank's disk plane, fallback to vertical drag) ----
  const drag = useRef({ active: false, last: 0, startT: 0, total: 0, samples: [] as { t: number; a: number }[], py: 0 })
  const tmp = useMemo(() => ({ ray: new Raycaster(), ndc: new Vector2(), hit: new Vector3(), plane: new Plane(new Vector3(1, 0, 0), -CRANK.hub.x) }), [])

  const angleAt = (clientX: number, clientY: number): number | null => {
    const r = gl.domElement.getBoundingClientRect()
    tmp.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    tmp.ray.setFromCamera(tmp.ndc, camera)
    if (Math.abs(tmp.ray.ray.direction.x) < 0.3) return null // plane is edge-on: use vertical drag
    if (!tmp.ray.ray.intersectPlane(tmp.plane, tmp.hit)) return null
    return Math.atan2(tmp.hit.z - CRANK.hub.z, tmp.hit.y - CRANK.hub.y)
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active) return
      let delta: number
      const a = angleAt(e.clientX, e.clientY)
      if (a !== null) {
        delta = a - d.last
        if (delta > Math.PI) delta -= Math.PI * 2
        if (delta < -Math.PI) delta += Math.PI * 2
        d.last = a
      } else {
        delta = ((e.clientY - d.py) / size.height) * 9
        d.last = 0
      }
      d.py = e.clientY
      // only forward rotation drives the drum (ratchet blocks reverse)
      delta = Math.max(0, delta)
      if (delta > 0) {
        cage.crank += delta
        cage.angle = cage.crank
        d.total += delta
      }
      const now = performance.now()
      d.samples.push({ t: now, a: d.total })
      while (d.samples.length && now - d.samples[0].t > 140) d.samples.shift()
    }
    const up = () => {
      const d = drag.current
      if (!d.active) return
      d.active = false
      cage.dragging = false
      const s = d.samples
      const omega = s.length > 1 ? ((s[s.length - 1].a - s[0].a) / Math.max(1, s[s.length - 1].t - s[0].t)) * 1000 : 0
      director.crankRelease({ total: d.total, omega, ms: performance.now() - d.startT })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, size])

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!director.crankPress()) return
    const d = drag.current
    d.active = true
    cage.dragging = true
    d.total = 0
    d.samples = []
    d.startT = performance.now()
    d.py = e.nativeEvent.clientY
    d.last = angleAt(e.nativeEvent.clientX, e.nativeEvent.clientY) ?? 0
  }

  useFrame((_, dt) => {
    wiggle.current = Math.max(0, wiggle.current - dt * 2.2)
    const w = Math.sin(wiggle.current * 18) * wiggle.current * 0.08
    if (group.current) group.current.rotation.x = cage.crank + w
    const invite = stage.invited === 'crank' ? stage.invite : 0
    knobMat.emissiveIntensity = invite * 0.9
    brassGlow.emissiveIntensity = invite * 0.35
  })

  return (
    <group position={CRANK.hub}>
      <group ref={group}>
        <mesh
          geometry={geo}
          material={brassGlow}
          castShadow
          onPointerDown={onDown}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'grab'
            wiggle.current = 1
            audio.play('tick', { vol: 0.3 })
          }}
          onPointerOut={() => (document.body.style.cursor = '')}
        />
        <mesh
          ref={knob}
          geometry={knobGeo}
          material={knobMat}
          position={[CRANK.knobOffsetX, CRANK.armLength, 0]}
          castShadow
          onPointerDown={onDown}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'grab'
          }}
          onPointerOut={() => (document.body.style.cursor = '')}
        />
        {/* generous invisible hit target for touch */}
        <mesh position={[0.04, CRANK.armLength * 0.6, 0]} onPointerDown={onDown}>
          <boxGeometry args={[0.16, 0.3, 0.12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
