import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { easing } from 'maath'
import gsap from 'gsap'
import { CatmullRomCurve3, Group, MathUtils, Matrix4, PerspectiveCamera as PCam, Quaternion, Vector2, Vector3 } from 'three'
import { SHOTS, shotParams, type ShotName } from './cameraShots'
import { cage, fx } from './channels'
import { audio } from '../audio/audioManager'

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Shared live camera state (Effects reads focus/bokeh; Director writes shot/trauma). */
export const camState = {
  shot: 'editing' as ShotName,
  focus: new Vector3(0, 1.8, 1.9),
  bokeh: 0,
  trauma: 0,
  kick: 0,
  smoothOverride: null as number | null,
  cutNext: false,
  path: null as null | { pos: CatmullRomCurve3; target: CatmullRomCurve3; t: number },
  pointer: new Vector2(),
  gyro: new Vector2(),
  reduced,
}

export const cameraDirector = {
  /** Change shot. `kick` = FOV punch-in for inserts/macros; `cut` = jump instantly (used sparingly). */
  setShot(name: ShotName, opts: { kick?: boolean; smooth?: number; cut?: boolean } = {}) {
    camState.shot = name
    camState.smoothOverride = opts.smooth ?? null
    if (opts.kick && !reduced) camState.kick = 3
    if (opts.cut) camState.cutNext = true
    if ((opts.kick || opts.cut) && reduced) {
      // reduced motion: short exposure crossfade instead of a snap zoom
      gsap.fromTo(fx, { exposure: 0.4 }, { exposure: 1, duration: 0.35, ease: 'power2.out' })
      camState.cutNext = true
    }
  },
  /** Trauma model: shake = trauma². */
  addTrauma(x: number) {
    if (reduced) return
    camState.trauma = Math.min(1, camState.trauma + x)
  },
  /** Fly along Catmull-Rom curves for long establishing moves. */
  path(posPts: Vector3[], targetPts: Vector3[], duration: number, ease = 'power3.inOut') {
    const p = { pos: new CatmullRomCurve3(posPts, false, 'centripetal'), target: new CatmullRomCurve3(targetPts, false, 'centripetal'), t: 0 }
    camState.path = p
    return new Promise<void>((resolve) =>
      gsap.to(p, {
        t: 1,
        duration: reduced ? duration * 0.5 : duration,
        ease,
        onComplete: () => {
          if (camState.path === p) camState.path = null
          resolve()
        },
      }),
    )
  },
  /** Chromatic aberration pulse for fast moves (0 → 0.002 → 0). */
  whip() {
    if (reduced) return
    gsap.timeline().to(fx, { chroma: 0.0022, duration: 0.12, ease: 'power2.out' }).to(fx, { chroma: 0, duration: 0.4, ease: 'power2.in' })
  },
}

/** Smooth value noise (cheap Perlin stand-in) for handheld and shake. */
function noise1(t: number, seed: number) {
  return Math.sin(t * 1.3 + seed) * 0.5 + Math.sin(t * 2.7 + seed * 1.7) * 0.3 + Math.sin(t * 5.9 + seed * 2.3) * 0.2
}

const _m = new Matrix4()
const _q = new Quaternion()
const _pos = new Vector3()
const _tgt = new Vector3()
const _off = new Vector3()
const UP = new Vector3(0, 1, 0)

/**
 * Three-layer camera rig: Rig (dolly/truck/crane) → Pivot (pan/tilt/roll) → Camera (fov, shake).
 * Every channel is spring-damped, so the camera behaves like an operator with weight.
 */
export function CameraDirector() {
  const rig = useRef<Group>(null)
  const pivot = useRef<Group>(null)
  const cam = useRef<PCam>(null)
  const look = useRef(new Vector3(0, 1.85, 1.9))
  const fov = useRef({ v: 35 })
  const roll = useRef({ v: 0 })
  const par = useRef(new Vector2())
  const size = useThree((s) => s.size)

  useEffect(() => {
    const move = (e: PointerEvent) => camState.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    const orient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      camState.gyro.set(MathUtils.clamp(e.gamma / 30, -1, 1), MathUtils.clamp((e.beta - 45) / 30, -1, 1))
    }
    // iOS needs an explicit permission request from a gesture
    const ask = () => {
      const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (D.requestPermission) D.requestPermission().then((r) => r === 'granted' && window.addEventListener('deviceorientation', orient)).catch(() => {})
      else window.addEventListener('deviceorientation', orient)
      window.removeEventListener('touchend', ask)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('touchend', ask)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('touchend', ask)
      window.removeEventListener('deviceorientation', orient)
    }
  }, [])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const r = rig.current
    const p = pivot.current
    const c = cam.current
    if (!r || !p || !c) return
    const shot = SHOTS[camState.shot](t, shotParams)
    _pos.copy(shot.pos)
    _tgt.copy(shot.target)
    if (camState.path) {
      camState.path.pos.getPointAt(camState.path.t, _pos)
      camState.path.target.getPointAt(camState.path.t, _tgt)
    }
    // parallax: orbit slightly around the target following mouse / gyro
    const wantPar = shot.parallax && !reduced ? (camState.gyro.lengthSq() > 0 ? camState.gyro : camState.pointer) : null
    easing.damp2(par.current, wantPar ?? new Vector2(), 0.6, dt)
    if (par.current.lengthSq() > 1e-6) {
      _off.subVectors(_pos, _tgt)
      _off.applyAxisAngle(UP, -par.current.x * MathUtils.degToRad(6))
      const right = new Vector3().crossVectors(UP, _off).normalize()
      _off.applyAxisAngle(right, -par.current.y * MathUtils.degToRad(3))
      _pos.copy(_tgt).add(_off)
    }
    // smoothing: user dragging the crank → camera yields (slower, no cuts)
    let smooth = camState.smoothOverride ?? shot.smooth ?? 0.6
    if (cage.dragging) smooth = Math.max(smooth, 0.9)
    if (reduced) smooth = Math.min(smooth, 0.5)
    if (camState.cutNext) {
      r.position.copy(_pos)
      look.current.copy(_tgt)
      camState.cutNext = false
    } else if (!camState.path) {
      easing.damp3(r.position, _pos, smooth, dt)
      easing.damp3(look.current, _tgt, smooth * 0.8, dt)
    } else {
      r.position.lerp(_pos, 1 - Math.exp(-20 * dt))
      look.current.lerp(_tgt, 1 - Math.exp(-20 * dt))
    }
    // pivot: look at the (damped) target, then roll
    _m.lookAt(r.position, look.current, UP)
    p.quaternion.setFromRotationMatrix(_m)
    easing.damp(roll.current, 'v', shot.roll ?? 0, 0.5, dt)
    // fov (+ kick that relaxes in ~0.4s) and fit-to-width on narrow screens
    camState.kick = Math.max(0, camState.kick - dt * 7.5)
    let wantFov = shot.fov
    if (shot.fitWidth) {
      const d = r.position.distanceTo(look.current)
      const need = MathUtils.radToDeg(2 * Math.atan(shot.fitWidth / 2 / d / (size.width / size.height)))
      wantFov = Math.max(wantFov, need)
    } else if (size.width < size.height) wantFov = Math.min(70, wantFov * 1.35)
    easing.damp(fov.current, 'v', wantFov - camState.kick, 0.4, dt)
    c.fov = fov.current.v
    c.updateProjectionMatrix()

    // layer 3: handheld + trauma shake (camera-local)
    camState.trauma = Math.max(0, camState.trauma - dt * 0.9)
    // continuous micro-trauma while the drum spins fast
    const spinShake = Math.min(1, Math.abs(cage.omega) / 14) * 0.1
    const shake = reduced ? 0 : Math.min(1, camState.trauma + spinShake) ** 2
    const hh = reduced ? 0 : (shot.handheld ?? 1)
    const posAmp = 0.005 * hh + 0.035 * shake
    const rotAmp = MathUtils.degToRad(0.15) * hh + MathUtils.degToRad(1.4) * shake
    const ts = t * (1 + shake * 6)
    c.position.set(noise1(ts, 1) * posAmp, noise1(ts, 7) * posAmp, 0)
    c.rotation.set(noise1(ts * 0.9, 3) * rotAmp, noise1(ts * 0.9, 11) * rotAmp, roll.current.v + noise1(ts * 0.7, 5) * rotAmp * 0.6)

    // focus / bokeh / letterbox channels
    if (shot.focus) easing.damp3(camState.focus, shot.focus, 0.35, dt)
    else easing.damp3(camState.focus, look.current, 0.35, dt)
    easing.damp(camState, 'bokeh', shot.bokeh ?? 1, 0.5, dt)
    easing.damp(fx, 'letterbox', shot.letterbox ?? 0, 0.6, dt)

    // keep the audio listener on the camera
    c.getWorldPosition(_pos)
    c.getWorldQuaternion(_q)
    const f = new Vector3(0, 0, -1).applyQuaternion(_q)
    const u = new Vector3(0, 1, 0).applyQuaternion(_q)
    audio.setListener(_pos, f, u)
  })

  return (
    <group ref={rig} position={[0, 1.85, 4.6]}>
      <group ref={pivot}>
        <PerspectiveCamera ref={cam} makeDefault fov={35} near={0.03} far={60} />
      </group>
    </group>
  )
}
