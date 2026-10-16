import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Group, HemisphereLight, MeshBasicMaterial, Object3D, SpotLight, Vector3 } from 'three'
import { CAGE, COLORS, TRAY } from './layout'
import { cage, lights } from '../director/channels'
import { host } from './Host/useHostAnimator'
import { LightCone } from './VFX/LightCone'
import { useSettingsStore } from '../store/useSettingsStore'
import { useGameStore } from '../store/useGameStore'
import { QUALITY } from '../quality/qualityPresets'
import { audio } from '../audio/audioManager'


/** Fixture positions (on the truss / front-of-house). Intensities are candela with physical decay 2. */
export const FIXTURES = {
  key: { pos: new Vector3(0.6, 5.0, 2.4), base: 75, angle: 0.36, color: COLORS.key },
  fillL: { pos: new Vector3(-4.0, 3.4, 2.2), base: 26, angle: 0.5, color: COLORS.fill },
  fillR: { pos: new Vector3(4.0, 3.4, 2.2), base: 26, angle: 0.5, color: COLORS.fill },
  rim: { pos: new Vector3(0.3, 4.6, -2.7), base: 45, angle: 0.5, color: COLORS.rim },
  follow: { pos: new Vector3(-0.5, 5.4, 6.5), base: 60, angle: 0.2, color: COLORS.follow },
  pin: { pos: new Vector3(0.1, 4.6, 1.7), base: 80, angle: 0.075, color: COLORS.pin },
}

/** Live beam aim points (read by DustMotes). */
export const beamTargets = { key: CAGE.center.clone().setY(0.8), follow: new Vector3(-4, 0.9, -0.6) }

const warmGold = new Color('#FFC46B')
const fillColor = new Color(COLORS.fill)
const _v = new Vector3()

export function Lights() {
  const level = useSettingsStore((s) => s.level)
  const q = QUALITY[level]
  const gl = useThree((s) => s.gl)
  const key = useRef<SpotLight>(null)
  const fillL = useRef<SpotLight>(null)
  const fillR = useRef<SpotLight>(null)
  const rim = useRef<SpotLight>(null)
  const follow = useRef<SpotLight>(null)
  const pin = useRef<SpotLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const followTarget = useMemo(() => new Vector3(-4, 0.9, -0.6), [])
  const targets = useMemo(
    () => ({
      key: new Object3D(),
      fillL: new Object3D(),
      fillR: new Object3D(),
      rim: new Object3D(),
      follow: new Object3D(),
      pin: new Object3D(),
    }),
    [],
  )

  useEffect(() => {
    targets.key.position.copy(CAGE.center).setY(0.8)
    targets.fillL.position.set(0.2, 1, 0)
    targets.fillR.position.set(-0.2, 1, 0)
    targets.rim.position.set(0, 1.2, 0.3)
    targets.pin.position.copy(TRAY.center)
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [targets, gl])

  const shadowAcc = useRef(0)
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const breathe = 1 + Math.sin((t / 6) * Math.PI * 2) * 0.05 * lights.breathe
    const spinK = Math.min(1, Math.abs(cage.omega) / 12)
    const flick = 1 + lights.flicker * spinK * (Math.sin(t * 23) * 0.5 + Math.sin(t * 37 + 1) * 0.5) * 0.25
    const M = lights.master * breathe
    const set = (l: SpotLight | null, base: number, lvl: number) => l && (l.intensity = base * lvl * M)
    set(key.current, FIXTURES.key.base, lights.key)
    set(fillL.current, FIXTURES.fillL.base, lights.fillL * flick)
    set(fillR.current, FIXTURES.fillR.base, lights.fillR * (2 - flick))
    set(rim.current, FIXTURES.rim.base, lights.rim)
    set(follow.current, FIXTURES.follow.base, lights.follow)
    set(pin.current, FIXTURES.pin.base, lights.pin)
    // fill colour drifts to warm gold for the ticket reveal
    fillL.current?.color.copy(fillColor).lerp(warmGold, lights.fillWarm)
    fillR.current?.color.copy(fillColor).lerp(warmGold, lights.fillWarm)
    // follow spot: soft lag on the host's hips
    host.hipsWorld(_v)
    followTarget.lerp(_v, 1 - Math.exp(-4 * dt))
    targets.follow.position.copy(followTarget)
    beamTargets.follow.copy(followTarget)
    if (follow.current) follow.current.angle = lights.followAngle
    // chase: fills sweep across the stage
    const sweep = Math.sin(t * 3.2) * 2.2 * lights.chase
    targets.fillL.position.set(0.2 + sweep, 1, 0)
    targets.fillR.position.set(-0.2 - sweep, 1, 0)
    if (hemi.current) hemi.current.intensity = 0.05 + 0.12 * lights.foot * M

    // shadows re-render only while something moves (cage, host, balls) — 10 Hz otherwise
    const phase = useGameStore.getState().phase
    const busy = Math.abs(cage.omega) > 0.01 || host.isWalking || !['IDLE_READY', 'TICKET_SHOWN', 'EDITING'].includes(phase)
    shadowAcc.current += dt
    // ≤30 Hz while busy, 10 Hz when calm
    if (shadowAcc.current > (busy ? 1 / 30 : 0.1)) {
      gl.shadowMap.needsUpdate = true
      shadowAcc.current = 0
    }
  })

  const cones = q.cones
  const shadow = q.shadowSize
  return (
    <group>
      <ambientLight intensity={0.02} />
      <hemisphereLight ref={hemi} args={['#1c1712', '#3a1a0c', 0.05]} />
      {Object.values(targets).map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      <spotLight
        ref={key}
        position={FIXTURES.key.pos}
        target={targets.key}
        angle={FIXTURES.key.angle}
        penumbra={0.55}
        color={FIXTURES.key.color}
        decay={2}
        intensity={0}
        castShadow={shadow > 0}
        shadow-mapSize={[shadow || 512, shadow || 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={q.softShadows ? 6 : 2}
        shadow-camera-near={1}
        shadow-camera-far={9}
      />
      <spotLight ref={fillL} position={FIXTURES.fillL.pos} target={targets.fillL} angle={FIXTURES.fillL.angle} penumbra={0.7} color={FIXTURES.fillL.color} decay={2} intensity={0} />
      <spotLight ref={fillR} position={FIXTURES.fillR.pos} target={targets.fillR} angle={FIXTURES.fillR.angle} penumbra={0.7} color={FIXTURES.fillR.color} decay={2} intensity={0} />
      <spotLight ref={rim} position={FIXTURES.rim.pos} target={targets.rim} angle={FIXTURES.rim.angle} penumbra={0.6} color={FIXTURES.rim.color} decay={2} intensity={0} />
      <spotLight
        ref={follow}
        position={FIXTURES.follow.pos}
        target={targets.follow}
        angle={FIXTURES.follow.angle}
        penumbra={0.6}
        color={FIXTURES.follow.color}
        decay={2}
        intensity={0}
        castShadow={q.followShadow}
        shadow-mapSize={[shadow || 512, shadow || 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={3}
        shadow-camera-far={12}
      />
      <spotLight ref={pin} position={FIXTURES.pin.pos} target={targets.pin} angle={FIXTURES.pin.angle} penumbra={0.5} color={FIXTURES.pin.color} decay={2} intensity={0} />
      {/* foot light / practicals are faked with emissive + the warm hemisphere ground colour (no extra per-pixel lights) */}

      {cones !== 'off' && (
        <>
          <LightCone from={FIXTURES.key.pos} to={() => targets.key.position} angle={() => FIXTURES.key.angle * 0.85} color={COLORS.key} level={() => lights.key * lights.master} />
          <LightCone from={FIXTURES.follow.pos} to={() => targets.follow.position} angle={() => lights.followAngle * 0.8} color={COLORS.follow} level={() => lights.follow * lights.master} strength={0.05} />
        </>
      )}
      {cones === 'all' && (
        <>
          <LightCone from={FIXTURES.fillL.pos} to={() => targets.fillL.position} angle={() => FIXTURES.fillL.angle * 0.7} color={COLORS.fill} level={() => lights.fillL * lights.master} strength={0.035} />
          <LightCone from={FIXTURES.fillR.pos} to={() => targets.fillR.position} angle={() => FIXTURES.fillR.angle * 0.7} color={COLORS.fill} level={() => lights.fillR * lights.master} strength={0.035} />
          <LightCone from={FIXTURES.rim.pos} to={() => targets.rim.position} angle={() => FIXTURES.rim.angle * 0.7} color={COLORS.rim} level={() => lights.rim * lights.master} strength={0.03} />
          <LightCone from={FIXTURES.pin.pos} to={() => targets.pin.position} angle={() => FIXTURES.pin.angle} color={COLORS.pin} level={() => lights.pin * lights.master} strength={0.12} />
        </>
      )}
      <Fixtures />
    </group>
  )
}

/** Lamp housings on the truss; their lenses glow with the light level. Tap one → it swings. */
function Fixtures() {
  const items = useMemo(
    () =>
      (['key', 'fillL', 'fillR', 'rim', 'pin'] as const).map((k) => ({
        k,
        pos: FIXTURES[k].pos,
        lens: new MeshBasicMaterial({ color: new Color(FIXTURES[k].color), toneMapped: false }),
      })),
    [],
  )
  const groups = useRef<(Group | null)[]>([])
  const swing = useRef(items.map(() => ({ a: 0, v: 0 })))
  useFrame((_, dt) => {
    items.forEach((it, i) => {
      const s = swing.current[i]
      s.v += (-30 * s.a - 1.2 * s.v) * dt
      s.a += s.v * dt
      const g = groups.current[i]
      if (g) {
        g.lookAt(0, 1, 0)
        g.rotateZ(s.a)
      }
      const lvl = (lights as unknown as Record<string, number>)[it.k] * lights.master
      it.lens.color.set(FIXTURES[it.k].color).multiplyScalar(0.2 + lvl * 3)
    })
  })
  return (
    <>
      {items.map((it, i) => (
        <group
          key={it.k}
          position={it.pos}
          ref={(g) => (groups.current[i] = g)}
          onPointerDown={(e) => {
            e.stopPropagation()
            swing.current[i].v += 1.8
            audio.play('hitBrass', { vol: 0.3, pitch: 0.5, pos: it.pos })
          }}
        >
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.11, 0.13, 0.32, 16]} />
            <meshStandardMaterial color="#111" roughness={0.6} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.165]} material={it.lens}>
            <circleGeometry args={[0.1, 20]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
