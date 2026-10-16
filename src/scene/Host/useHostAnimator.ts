import { AnimationAction, AnimationClip, AnimationMixer, Bone, Camera, CatmullRomCurve3, Group, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { rotateWorld, setWorldQuaternion, solveTwoBone, translateWorld } from './hostIK'
import { curve } from './hostPaths'
import { clock } from '../../director/channels'
import { audio } from '../../audio/audioManager'
import { useGameStore, type HostState } from '../../store/useGameStore'
import { CAGE, CRANK, PROPS, TRAY } from '../layout'

/** Base bone names (three sanitises spaces to "_" and the export appends "_<index>"). See HostRig.md. */
export const HOST_BONES = {
  hips: 'Hips', spine: 'Spine', chest: 'Chest', neck: 'Neck', head: 'Head',
  lArm: 'Left_arm', lElbow: 'Left_elbow', lWrist: 'Left_wrist',
  rArm: 'Right_arm', rElbow: 'Right_elbow', rWrist: 'Right_wrist',
  lLeg: 'Left_leg', lKnee: 'Left_knee', lAnkle: 'Left_ankle', lToe: 'Left_toe',
  rLeg: 'Right_leg', rKnee: 'Right_knee', rAnkle: 'Right_ankle', rToe: 'Right_toe',
  lMid: 'MiddleFinger1_L', rMid: 'MiddleFinger1_R',
} as const
type BoneKey = keyof typeof HOST_BONES

export const baseName = (n: string) => n.replace(/\s/g, '_').replace(/_\d+$/, '')

export type ArmPose = 'rest' | 'clasp' | 'wave' | 'clap' | 'present' | 'presentTwo' | 'hairTouch' | 'openBall'
type Getter = () => Vector3
type Side = 'L' | 'R'

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt))
const dampAngle = (a: number, b: number, lambda: number, dt: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-lambda * dt))
}
const smooth = (t: number) => t * t * (3 - 2 * t)
const smoothRange = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))))

const X = new Vector3(1, 0, 0)
const Y = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)
const _v = new Vector3()
const _w = new Vector3()
const _u = new Vector3()
const _q = new Quaternion()
const _q2 = new Quaternion()
const _rootQ = new Quaternion()
const _axis = new Vector3()

interface Metrics {
  shoulder: Record<Side, Vector3>
  armLen: number
  hipY: number
  ankleY: number
  footX: number
  headY: number
  chestY: number
}

interface Spring {
  bone: Object3D
  theta: number
  vel: number
  gain: number
}

/**
 * Procedural host animator (the GLB ships without clips).
 * Layers, evaluated each frame on top of the bind pose:
 *  1. root path following (spline, arc-length param, speed eased in/out)
 *  2. gait: feet planted in world during stance (stride = 2·step, phase from distance → no foot sliding)
 *  3. hips height/crouch + spine lean/bow/twist + breathing
 *  4. head look-at (clamped ±60° yaw / ±35° pitch, split neck/head)
 *  5. arms: every pose is an IK target (char-space pose blended with world targets such as the crank knob)
 *  6. secondary springs on hair/skirt/ribbon roots (follow-through)
 * Every action returns a promise resolved on the animator's own clock, so fast-forward stays in sync.
 */
export class HostController {
  root = new Group()
  ready = false
  camera: Camera | null = null
  private bones = {} as Record<BoneKey, Bone>
  private rest = new Map<Object3D, { q: Quaternion; p: Vector3 }>()
  private restRel = {} as { lAnkle: Quaternion; rAnkle: Quaternion; head: Quaternion }
  private m!: Metrics
  private springs: Spring[] = []
  // ---- root motion ----
  pos = new Vector3()
  yaw = 0
  yawTarget = 0
  private path: CatmullRomCurve3 | null = null
  private pathLen = 0
  private pathDist = 0
  private pathSpeed = 1.15
  private pathDone: (() => void) | null = null
  private vel = new Vector3()
  private prevVel = new Vector3()
  // ---- gait ----
  private gait = 0
  private walkBlend = 0
  private stride = 1.0
  private lastPhase = { L: 0, R: 0.5 }
  // ---- body layers ----
  crouch = 0
  crouchT = 0
  lean = 0
  leanT = 0
  bow = 0
  bowT = 0
  twist = 0
  twistT = 0
  sway = 0
  swayT = 0
  private waveAmt = 0
  private clapAmt = 0
  private handVel = { L: new Vector3(), R: new Vector3() }
  private t = 0
  // ---- arms ----
  pose: ArmPose = 'rest'
  private handLocal = { L: new Vector3(), R: new Vector3() }
  private handWorld: Record<Side, Getter | null> = { L: null, R: null }
  private handW = { L: 0, R: 0 }
  private reachPole = { L: 0, R: 0 }
  private tmpL = new Vector3()
  private tmpR = new Vector3()
  /** visual head centre in head-bone space (chibi heads sit far above the head bone) */
  private headLocal = new Vector3(0, 0.1, 0)
  /** how far the visible hand/sleeve reaches past the wrist bone (m) */
  private handExt = { L: 0, R: 0 }
  private wings: { bone: Object3D; side: number }[] = []
  /** skirt strand roots + their rest direction around the waist (character space, xz) */
  private skirt: { bone: Object3D; dir: Vector3 }[] = []
  /** 0..1 happy: head tilt + chest bounce */
  /** brisk mode for grabs: faster body/hand springs */
  quick = false
  smile = 0
  smileT = 0
  surprise = 0
  surpriseT = 0
  private lookPoint = new Vector3(0, 1.4, 3)
  private gazeOwned = false
  private gazeClock = 1.5
  private headAng = { x: 0, y: 0 }
  private headVel = { x: 0, y: 0 }
  // ---- look ----
  private look: Getter | null = null
  private lookW = 0
  /** world position the right palm is at (for attaching the ball) */
  palm = { L: new Vector3(), R: new Vector3() }
  // ---- timers on the animator clock ----
  private timers: { left: number; resolve: () => void }[] = []
  // ---- clips (optional: public/host-animations.glb) ----
  mixer: AnimationMixer | null = null
  private actions = new Map<string, AnimationAction>()
  private clipDriven = false
  private idleClock = 0
  private nextIdle = 8
  idleEnabled = false
  /** throttle skeleton evaluation (low preset): Hz, 0 = every frame */
  skeletonHz = 0
  private skelAcc = 0
  fullIK = true

  // ================================================================ setup
  bind(model: Object3D) {
    this.root.clear()
    this.springs = []
    this.wings = []
    this.skirt = []
    this.rest.clear()
    this.ready = false
    this.root.add(model)
    this.root.position.set(0, 0, 0)
    this.root.rotation.set(0, 0, 0)
    this.root.updateMatrixWorld(true)
    const found: Partial<Record<BoneKey, Bone>> = {}
    model.traverse((o) => {
      if (!(o as Bone).isBone) return
      const b = baseName(o.name)
      for (const k of Object.keys(HOST_BONES) as BoneKey[]) if (HOST_BONES[k] === b && !found[k]) found[k] = o as Bone
      if (/^(Hair_Side01_[LR]|Hair_Side_Ribon01_[LR]|Hair_Front_00[12]|Tail_02|Front_Ribon_01_[LR])$/.test(b)) {
        this.springs.push({ bone: o, theta: 0, vel: 0, gain: /Skirt/.test(b) ? 0.6 : 1 })
      }
      if (/^Skirt_0_\d+$/.test(b)) this.skirt.push({ bone: o, dir: new Vector3() })
      if (/^Wing02_[LR]$/.test(b)) this.wings.push({ bone: o, side: b.endsWith('L') ? 1 : -1 })
    })
    const missing = (Object.keys(HOST_BONES) as BoneKey[]).filter((k) => !found[k])
    if (missing.length) {
      console.warn('[host] missing bones, procedural animation disabled:', missing)
      return
    }
    this.bones = found as Record<BoneKey, Bone>
    model.traverse((o) => {
      if ((o as Bone).isBone) this.rest.set(o, { q: o.quaternion.clone(), p: o.position.clone() })
    })
    const b = this.bones
    const wp = (o: Object3D) => o.getWorldPosition(new Vector3())
    const wq = (o: Object3D) => o.getWorldQuaternion(new Quaternion())
    const la = wp(b.lArm).distanceTo(wp(b.lElbow)) + wp(b.lElbow).distanceTo(wp(b.lWrist))
    // The mesh, not the skeleton, decides where things visibly are: measure it.
    const vis = measureMesh(model, b)
    this.m = {
      shoulder: { L: wp(b.lArm), R: wp(b.rArm) },
      armLen: la,
      hipY: wp(b.hips).y,
      ankleY: wp(b.lAnkle).y,
      footX: Math.abs(wp(b.lAnkle).x),
      headY: vis.headCenter.y,
      chestY: wp(b.chest).y,
    }
    this.headLocal.copy(b.head.worldToLocal(vis.headCenter.clone()))
    this.handExt = vis.handExt
    this.restRel = { lAnkle: wq(b.lAnkle), rAnkle: wq(b.rAnkle), head: wq(b.head) }
    this.stride = Math.max(0.7, (this.m.hipY - this.m.ankleY) * 1.35)
    // where each skirt strand hangs around the waist (rest, character space)
    const hipsW = wp(b.hips)
    for (const k of this.skirt) {
      k.dir.copy(wp(k.bone)).sub(hipsW).setY(0)
      if (k.dir.lengthSq() < 1e-6) k.dir.set(0, 0, 1)
      k.dir.normalize()
    }
    this.ready = true
    this.setHandsFromPose(0, true)
  }

  setClips(clips: AnimationClip[], model: Object3D) {
    if (!clips.length) return
    this.mixer = new AnimationMixer(model)
    for (const c of clips) this.actions.set(c.name.toLowerCase(), this.mixer.clipAction(c))
    this.clipDriven = this.actions.has('idle') && (this.actions.has('walking') || this.actions.has('walk'))
    if (this.clipDriven) this.actions.get('idle')!.play()
  }

  get metrics() {
    return this.m
  }

  // ================================================================ clock / promises
  wait(sec: number) {
    return new Promise<void>((resolve) => this.timers.push({ left: sec, resolve }))
  }

  setState(s: HostState) {
    useGameStore.getState().setHostState(s)
  }

  // ================================================================ actions
  /** Teleport (only used while hidden in the wing). */
  place(p: Vector3, yaw: number) {
    this.pos.copy(p)
    this.yaw = this.yawTarget = yaw
    this.path = null
  }

  walk(points: Vector3[], speed = 1.15): Promise<void> {
    this.path = curve([this.pos.clone(), ...points.slice(1)])
    this.pathLen = this.path.getLength()
    this.pathDist = 0
    this.pathSpeed = speed
    this.pathDone?.()
    return new Promise((r) => (this.pathDone = r))
  }

  /** Short step in a direction (char-space offset), e.g. half a step back while the cage spins. */
  step(localOffset: Vector3) {
    const target = this.toWorldDir(localOffset.clone()).add(this.pos)
    const mid = this.pos.clone().lerp(target, 0.5)
    const keepYaw = this.yaw
    return this.walk([this.pos, mid, target], 0.6).then(() => {
      this.yawTarget = keepYaw
    })
  }

  faceYaw(yaw: number): Promise<void> {
    this.yawTarget = yaw
    return this.waitUntil(() => Math.abs(angleDiff(this.yaw, this.yawTarget)) < 0.05)
  }

  facePoint(p: Vector3) {
    return this.faceYaw(Math.atan2(p.x - this.pos.x, p.z - this.pos.z))
  }

  /** Resolve when `cond` holds (polled at 30Hz on the animator clock) or after `timeout` seconds. */
  waitUntil(cond: () => boolean, timeout = 6): Promise<void> {
    return new Promise((resolve) => {
      let acc = 0
      const poll = () => {
        if (cond() || acc > timeout) return resolve()
        acc += 1 / 30
        this.timers.push({ left: 1 / 30, resolve: poll })
      }
      poll()
    })
  }

  setPose(p: ArmPose) {
    this.pose = p
  }

  /** Attach a hand to a moving world target (crank knob, ball…). null releases with a fade. */
  reach(side: Side, getter: Getter | null) {
    this.handWorld[side] = getter
  }

  lookAt(getter: Getter | null) {
    this.look = getter
    this.gazeOwned = false
  }

  /** Expression through head/body (no face rig): neutral, happy (tilt + bounce) or surprised (small jolt back). */
  express(e: 'neutral' | 'happy' | 'surprised', seconds = 0) {
    this.smileT = e === 'happy' ? 1 : 0
    this.surpriseT = e === 'surprised' ? 1 : 0
    if (seconds > 0) void this.wait(seconds).then(() => this.express('neutral'))
  }

  lookAtCamera() {
    this.gazeOwned = false
    this.look = () => (this.camera ? this.camera.getWorldPosition(_u) : _u.set(0, 1.5, 5))
  }

  async bowOnce(depth = 0.75) {
    this.setState('bowing')
    this.setPose('clasp')
    audio.play('rustle', { vol: 0.5, pos: this.pos })
    this.bowT = depth
    await this.wait(0.8)
    this.bowT = 0
    await this.wait(0.45)
  }

  async waveFor(sec = 1.8) {
    const prev = this.pose
    this.setPose('wave')
    this.lookAtCamera()
    await this.wait(sec)
    this.setPose(prev === 'wave' ? 'rest' : prev)
  }

  async gesture(target: Vector3, sec = 1.4) {
    this.setState('gesturing')
    const tgt = target.clone()
    // point: hand goes 55% of the way toward the target from the shoulder
    this.reach('R', () => {
      const sh = this.bones.rArm ? this.bones.rArm.getWorldPosition(_w) : this.pos
      return _v.copy(tgt).sub(sh).setLength(this.m ? this.m.armLen * 0.95 : 0.5).add(sh)
    })
    this.lookAt(() => tgt)
    await this.wait(sec)
    this.reach('R', null)
  }

  async clapFor(sec = 1.5) {
    const prev = this.pose
    this.setPose('clap')
    await this.wait(sec)
    this.setPose(prev === 'clap' ? 'rest' : prev)
  }

  // ================================================================ frame update
  update(dtRaw: number) {
    const dt = Math.min(0.05, dtRaw) * clock.speed
    this.t += dt
    // timers
    if (this.timers.length) {
      const due: (() => void)[] = []
      this.timers = this.timers.filter((tm) => {
        tm.left -= dt
        if (tm.left <= 0) {
          due.push(tm.resolve)
          return false
        }
        return true
      })
      due.forEach((f) => f())
    }

    this.updateRoot(dt)
    if (!this.ready) return

    // body layers
    // `quick` (grabbing things) tightens the body springs
    const bodyK = this.quick ? 9 : 4
    this.crouch = damp(this.crouch, this.crouchT, bodyK, dt)
    this.lean = damp(this.lean, this.leanT, bodyK, dt)
    this.bow = damp(this.bow, this.bowT, 3.5, dt)
    this.twist = damp(this.twist, this.twistT, 3, dt)
    this.sway = damp(this.sway, this.swayT, 2.5, dt)
    this.waveAmt = damp(this.waveAmt, this.pose === 'wave' ? 1 : 0, 4, dt)
    const clapWas = Math.floor((this.t - dt) * 7.5 / Math.PI)
    this.clapAmt = damp(this.clapAmt, this.pose === 'clap' ? 1 : 0, 5, dt)
    if (this.clapAmt > 0.5 && Math.floor((this.t * 7.5) / Math.PI) !== clapWas) audio.play('clap', { vol: 0.25, pos: this.pos })
    this.smile = damp(this.smile, this.smileT, 4, dt)
    this.surprise = damp(this.surprise, this.surpriseT, 9, dt)
    this.lookW = damp(this.lookW, this.look ? 1 : 0, 3, dt)
    // gaze glides between targets instead of snapping
    if (this.look) this.lookPoint.lerp(this.look(), 1 - Math.exp(-8 * dt))
    for (const s of ['L', 'R'] as Side[]) {
      // IK weight fades in/out in ~0.3s so hands never pop
      this.handW[s] = damp(this.handW[s], this.handWorld[s] ? 1 : 0, this.quick ? 10 : 5, dt)
      this.reachPole[s] = damp(this.reachPole[s], this.handWorld[s] ? 1 : 0, 4, dt)
    }
    this.setHandsFromPose(dt, false)

    this.idleVariations(dt)

    if (this.skeletonHz > 0 && this.walkBlend < 0.05) {
      this.skelAcc += dt
      if (this.skelAcc < 1 / this.skeletonHz) return
      this.skelAcc = 0
    }
    this.mixer?.update(dt)
    this.applySkeleton(dt)
  }

  private updateRoot(dt: number) {
    this.prevVel.copy(this.vel)
    if (this.path) {
      // ease speed in/out along the path
      const remain = this.pathLen - this.pathDist
      const v = this.pathSpeed * Math.min(1, 0.3 + this.pathDist / 0.7, 0.15 + remain / 0.9)
      this.pathDist = Math.min(this.pathLen, this.pathDist + v * dt)
      const u = this.pathLen > 0 ? this.pathDist / this.pathLen : 1
      const p = this.path.getPointAt(u)
      this.vel.subVectors(p, this.pos).divideScalar(Math.max(dt, 1e-4))
      this.pos.copy(p)
      const tan = this.path.getTangentAt(Math.min(0.999, u))
      if (this.pathDist < this.pathLen - 0.05) this.yawTarget = Math.atan2(tan.x, tan.z)
      this.gait += v * dt
      if (this.pathDist >= this.pathLen - 1e-4) {
        this.path = null
        this.vel.set(0, 0, 0)
        const done = this.pathDone
        this.pathDone = null
        done?.()
      }
    } else this.vel.set(0, 0, 0)
    const prevYaw = this.yaw
    this.yaw = dampAngle(this.yaw, this.yawTarget, this.path ? 5 : 3, dt)
    // turning on the spot also advances the gait a little (small shuffling steps)
    const turnRate = Math.abs(angleDiff(prevYaw, this.yaw)) / Math.max(dt, 1e-4)
    if (!this.path) this.gait += Math.min(turnRate, 3) * 0.12 * dt
    const walking = this.path !== null || turnRate > 0.6
    this.walkBlend = damp(this.walkBlend, walking ? 1 : 0, walking ? 8 : 5, dt)
    this.root.position.copy(this.pos)
    this.root.rotation.set(0, this.yaw, 0)
    if (this.clipDriven) this.crossfadeClips(walking)
  }

  private crossfadeClips(walking: boolean) {
    const walk = this.actions.get('walking') ?? this.actions.get('walk')
    const idle = this.actions.get('idle')
    if (!walk || !idle) return
    const want = walking ? walk : idle
    const other = walking ? idle : walk
    if (!want.isRunning() || want.getEffectiveWeight() < 0.99) {
      if (!want.isRunning()) want.reset().play()
      want.crossFadeFrom(other, 0.4, false)
    }
  }

  private setHandsFromPose(dt: number, snap: boolean) {
    const m = this.m
    if (!m) return
    const t = this.t
    // skipping: wide, bouncy arm swing
    const swing = Math.sin((this.gait / this.stride) * Math.PI * 2) * 0.2 * this.walkBlend
    const breath = Math.sin(t * 1.6) * 0.006
    const target: Record<Side, Vector3> = { L: this.tmpL, R: this.tmpR }
    const sh = m.shoulder
    const y0 = sh.L.y
    for (const s of ['L', 'R'] as Side[]) {
      const sx = s === 'L' ? 1 : -1
      const reach = m.armLen + this.handExt[s]
      // relaxed: hands hang a little out and forward, elbows soft
      target[s].set(sh[s].x + sx * 0.1, sh[s].y - reach * 0.45 + breath, 0.2 + swing * (s === 'L' ? -1 : 1))
    }
    switch (this.pose) {
      case 'clasp':
        target.L.set(0.04, y0 - 0.3, 0.24)
        target.R.set(-0.04, y0 - 0.3, 0.24)
        break
      case 'wave':
        target.R.set(sh.R.x - 0.3, y0 + 0.42, 0.12) // the side-to-side wave is layered on after the spring
        break
      case 'clap':
        // hands meet in front of the chest; the clapping motion is layered on after the spring
        target.L.set(0.08, y0 - 0.15, 0.3)
        target.R.set(-0.08, y0 - 0.15, 0.3)
        break
      case 'present':
        // beside the face, not in front of it
        target.R.set(-0.24, y0 + 0.1, 0.4)
        target.L.set(0.15, y0 - 0.38, 0.16)
        break
      case 'openBall':
        // after the split each hand keeps one half: right hand low-centre, left hand out to her left
        target.R.set(-0.12, y0 + 0.05, 0.42)
        target.L.set(0.24, y0 + 0.14, 0.38)
        break
      case 'presentTwo':
        target.L.set(0.13, y0 + 0.22, 0.34)
        target.R.set(-0.13, y0 + 0.22, 0.34)
        break
      case 'hairTouch':
        // tuck hair behind the ear: hand beside the head (outside the face), elbow out to the side
        target.L.set(sh.L.x + 0.06, m.headY - 0.04, 0.01)
        break
      default:
        break
    }
    for (const s of ['L', 'R'] as Side[]) {
      if (snap) this.handLocal[s].copy(target[s])
      else {
        // critically-damped spring: every gesture eases in AND out (no snap at the start)
        const k = this.quick ? 90 : 45
        const c = 2 * Math.sqrt(k)
        const v = this.handVel[s]
        v.x += (k * (target[s].x - this.handLocal[s].x) - c * v.x) * dt
        v.y += (k * (target[s].y - this.handLocal[s].y) - c * v.y) * dt
        v.z += (k * (target[s].z - this.handLocal[s].z) - c * v.z) * dt
        this.handLocal[s].addScaledVector(v, dt)
      }
    }
  }

  // ---------------------------------------------------------------- skeleton
  private applySkeleton(dt: number) {
    const b = this.bones
    // 1) bind pose (unless a clip drives the body)
    for (const [bone, r] of this.rest) {
      if (this.clipDriven && bone !== b.lArm && bone !== b.rArm && bone !== b.lElbow && bone !== b.rElbow && bone !== b.neck && bone !== b.head) continue
      bone.quaternion.copy(r.q)
      bone.position.copy(r.p)
    }
    this.root.updateMatrixWorld(true)
    _rootQ.copy(this.root.quaternion)
    const right = _axis.copy(X).applyQuaternion(_rootQ) // char +X (character's left) — rotation about it bends forward

    if (!this.clipDriven) {
      // 2) hips: height (crouch + walk bob), sway, twist with gait
      const ph = (this.gait / this.stride) * Math.PI * 2
      // skip ("chân sáo"): a hop on every step — the hips rise mid-step (the stance leg reaches full
      // length so that foot leaves the floor too) and dip a little on landing (squash)
      const stepPh = ((((ph / Math.PI) % 1) + 1) % 1)
      const hop = Math.pow(Math.sin(stepPh * Math.PI), 1.5) * 0.075 - Math.exp(-stepPh * 14) * 0.03
      const bob = hop * this.walkBlend + Math.sin(this.t * 1.6) * 0.002
      const lower = this.crouch + 0.012 + this.bow * 0.03
      const back = -this.crouch * 0.35
      translateWorld(b.hips, _v.set(0, bob - lower, 0).add(_w.set(0, 0, back).applyQuaternion(_rootQ)))
      rotateWorld(b.hips, _q.setFromAxisAngle(_u.copy(Y), Math.sin(ph) * 0.07 * this.walkBlend + this.twist * 0.3))
      rotateWorld(b.hips, _q.setFromAxisAngle(right, this.crouch * 1.2 + this.lean * 0.3))

      // 3) legs: planted feet (two-bone IK)
      this.solveLeg('L', ph)
      this.solveLeg('R', ph + Math.PI)

      // 3b) skirt follows the thighs so the legs never poke through the cloth
      this.skirtFollowLegs()

      // 4) spine: counter-rotate the walk twist, lean, bow, breathing
      const breath = Math.sin(this.t * 1.6) * 0.012
      const counter = -Math.sin(ph) * 0.1 * this.walkBlend
      const fwd = this.lean * 0.7 + this.bow - this.crouch * 0.6
      rotateWorld(b.spine, _q.setFromAxisAngle(right, fwd * 0.5 + breath).premultiply(_q2.setFromAxisAngle(_u.copy(Y), counter + this.twist * 0.4)))
      rotateWorld(b.chest, _q.setFromAxisAngle(right, fwd * 0.5 - breath * 0.5).premultiply(_q2.setFromAxisAngle(_u.copy(Y), this.twist * 0.3)))
      if (this.sway) rotateWorld(b.spine, _q.setFromAxisAngle(_u.copy(Z).applyQuaternion(_rootQ), this.sway))
    }

    // 5) head look-at
    this.solveHead(dt)
    // happy: cute head tilt + a little bounce in the chest (the model has no face blendshapes,
    // and its eye bones only move the irises — squashing them would show the whites)
    if (this.smile > 0.01) rotateWorld(b.head, _q.setFromAxisAngle(_u.copy(Z).applyQuaternion(_rootQ), 0.14 * this.smile))
    if (this.smile > 0.01) rotateWorld(b.chest, _q.setFromAxisAngle(_axis, -Math.abs(Math.sin(this.t * 6)) * 0.05 * this.smile))
    if (this.surprise > 0.01) rotateWorld(b.head, _q.setFromAxisAngle(_axis, -0.12 * this.surprise))

    // 6) arms (IK toward blended targets)
    this.solveArm('L')
    this.solveArm('R')

    // 7) feet stay flat
    if (!this.clipDriven) {
      setWorldQuaternion(b.lAnkle, _q.copy(_rootQ).multiply(this.restRel.lAnkle))
      setWorldQuaternion(b.rAnkle, _q.copy(_rootQ).multiply(this.restRel.rAnkle))
    }

    // 8) secondary motion: hair/skirt lag behind root acceleration
    const acc = _v.subVectors(this.vel, this.prevVel).divideScalar(Math.max(dt, 1e-4))
    const accFwd = acc.dot(_w.copy(Z).applyQuaternion(_rootQ))
    const bounce = Math.sin((this.gait / this.stride) * Math.PI * 4) * this.walkBlend
    for (const s of this.springs) {
      const force = -accFwd * 0.02 - this.walkBlend * 0.06 + bounce * 0.02
      s.vel += (-60 * s.theta - 7 * s.vel + force * 60) * dt
      s.theta += s.vel * dt
      s.theta = Math.max(-0.35, Math.min(0.35, s.theta))
      rotateWorld(s.bone, _q.setFromAxisAngle(right, s.theta * s.gain), true)
    }
    // wings: gentle flap, faster while travelling
    if (this.wings.length) {
      const fwdAxis = _w.copy(Z).applyQuaternion(_rootQ)
      const flap = Math.sin(this.t * (5 + 4 * this.walkBlend)) * (0.18 + 0.15 * this.walkBlend)
      for (const w of this.wings) rotateWorld(w.bone, _q.setFromAxisAngle(fwdAxis, flap * w.side))
    }
    // palms (attach points): where the visible hand is, past the wrist along the forearm
    for (const s of ['L', 'R'] as Side[]) {
      const wrist = s === 'L' ? b.lWrist : b.rWrist
      const elbow = s === 'L' ? b.lElbow : b.rElbow
      wrist.getWorldPosition(this.palm[s])
      elbow.getWorldPosition(_w)
      _u.subVectors(this.palm[s], _w).normalize()
      this.palm[s].addScaledVector(_u, this.handExt[s] * 0.85)
    }
  }

  /**
   * Each skirt strand is pushed by the thigh it sits in front of/behind: the strand rotates about the
   * same horizontal axis as the thigh's swing, weighted by how much the strand faces that thigh's swing.
   */
  private skirtFollowLegs() {
    const b = this.bones
    const invRoot = _q2.copy(_rootQ).invert()
    const legs = [
      { hip: b.lLeg, knee: b.lKnee, side: 1 },
      { hip: b.rLeg, knee: b.rKnee, side: -1 },
    ]
    const swing = legs.map((l) => {
      // thigh direction in character space; its horizontal part is the swing
      const d = l.knee.getWorldPosition(new Vector3()).sub(l.hip.getWorldPosition(new Vector3())).applyQuaternion(invRoot)
      const horiz = new Vector3(d.x, 0, d.z)
      const ang = Math.atan2(horiz.length(), -d.y)
      return { side: l.side, horiz: horiz.lengthSq() > 1e-8 ? horiz.normalize() : horiz, ang }
    })
    for (const k of this.skirt) {
      let best = 0
      const axis = new Vector3()
      for (const sw of swing) {
        if (sw.ang < 0.05) continue
        // strands on this leg's side and in the direction the knee moves get pushed
        const sideW = Math.max(0, 0.35 + 0.65 * Math.sign(k.dir.x || sw.side) * sw.side)
        const facing = Math.max(0, k.dir.dot(sw.horiz))
        const a = sw.ang * facing * sideW * 1.15
        if (a > best) {
          best = a
          axis.crossVectors(new Vector3(0, -1, 0), sw.horiz).normalize().applyQuaternion(_rootQ)
        }
      }
      if (best > 0.01) rotateWorld(k.bone, _q.setFromAxisAngle(axis, Math.min(best, 1.1)))
    }
  }

  private solveLeg(s: Side, ph: number) {
    const b = this.bones
    const m = this.m
    const sx = s === 'L' ? 1 : -1
    // phase in [0,1): stance [0,.5) foot moves back at exactly root speed; swing [.5,1) lifts and returns
    const p = (((ph / (Math.PI * 2)) % 1) + 1) % 1
    const S = this.stride
    let z: number
    let lift = 0
    if (p < 0.5) z = S / 4 - (p / 0.5) * (S / 2)
    else {
      const u = smooth((p - 0.5) / 0.5)
      z = -S / 4 + u * (S / 2)
      // high, springy knee on the swing leg
      lift = Math.sin(u * Math.PI) * 0.12
    }
    // heel strike → footstep sound
    if (this.walkBlend > 0.4 && this.lastPhase[s] > 0.85 && p < 0.15) audio.play('footstep', { vol: 0.35 * this.walkBlend, pos: this.pos })
    this.lastPhase[s] = p
    const local = _v.set(sx * (m.footX * 0.85), m.ankleY + lift * this.walkBlend, z * this.walkBlend - this.crouch * 0.1)
    const target = this.toWorld(local)
    const leg = s === 'L' ? b.lLeg : b.rLeg
    const knee = s === 'L' ? b.lKnee : b.rKnee
    const ankle = s === 'L' ? b.lAnkle : b.rAnkle
    const pole = this.toWorld(_w.set(sx * 0.12, m.hipY * 0.5, 1.2))
    solveTwoBone(leg, knee, ankle, target.clone(), pole)
  }

  private solveArm(s: Side) {
    const b = this.bones
    const m = this.m
    const sx = s === 'L' ? 1 : -1
    _v.copy(this.handLocal[s])
    // gesture oscillations ride on top of the eased pose and fade in/out with it
    if (s === 'R' && this.waveAmt > 0.001) _v.x += Math.sin(this.t * 9) * 0.08 * this.waveAmt
    if (this.clapAmt > 0.001) _v.x += (s === 'L' ? 1 : -1) * (Math.abs(Math.sin(this.t * 7.5)) * 0.07 - 0.05) * this.clapAmt
    const local = this.toWorld(_v).clone()
    const g = this.handWorld[s]
    if (g && this.handW[s] > 0.001) local.lerp(g(), this.handW[s])
    // elbows hang back/out at rest, point out/down when reaching forward
    const sh = m.shoulder[s]
    const rp = this.reachPole[s]
    // raised hands (hair tuck, wave, holding things up) swing the elbow out to the side instead of
    // back, so the forearm never folds backwards; blended by hand height for a smooth change
    const raise = smoothRange(sh.y - 0.2, sh.y + 0.1, _v.y)
    _w.set(sh.x + sx * (0.25 + rp * 0.25), sh.y - 0.25 - rp * 0.1, -0.45 + rp * 0.3)
    _w.lerp(_u.set(sh.x + sx * 0.6, sh.y - 0.1, -0.05), raise)
    const pole = this.toWorld(_w)
    const upper = s === 'L' ? b.lArm : b.rArm
    const lower = s === 'L' ? b.lElbow : b.rElbow
    const wrist = s === 'L' ? b.lWrist : b.rWrist
    solveTwoBone(upper, lower, wrist, local, pole.clone(), 1, this.handExt[s])
  }

  /**
   * Head look-at with transitions: the target yaw/pitch (character space, clamped ±60° / -35°..+30°)
   * is eased with a critically-damped spring, and eases back to neutral when nothing is watched,
   * so turns always start and stop softly. 40% goes to the neck, the rest to the head.
   */
  private solveHead(dt: number) {
    const b = this.bones
    let wantYaw = 0
    let wantPitch = 0
    if (this.look) {
      const headPos = b.head.getWorldPosition(_v)
      const d = _u.subVectors(this.lookPoint, headPos).applyQuaternion(_q2.copy(_rootQ).invert())
      wantYaw = clamp(Math.atan2(d.x, d.z), -1.05, 1.05)
      wantPitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.5)
    }
    // spring (ζ = 1): smooth acceleration and deceleration, no overshoot
    const k = 28
    const c = 2 * Math.sqrt(k)
    this.headVel.x += (k * (wantYaw - this.headAng.x) - c * this.headVel.x) * dt
    this.headVel.y += (k * (wantPitch - this.headAng.y) - c * this.headVel.y) * dt
    this.headAng.x += this.headVel.x * dt
    this.headAng.y += this.headVel.y * dt
    if (Math.abs(this.headAng.x) < 1e-4 && Math.abs(this.headAng.y) < 1e-4) return
    // rotate about world up (yaw) and the character's lateral axis (pitch, + = look up)
    const lateral = _w.copy(X).applyQuaternion(_rootQ)
    const qYaw = _q.setFromAxisAngle(Y, this.headAng.x)
    const qPitch = new Quaternion().setFromAxisAngle(lateral, -this.headAng.y)
    const q = qYaw.clone().multiply(qPitch)
    const id = new Quaternion()
    rotateWorld(b.neck, id.clone().slerp(q, 0.4))
    rotateWorld(b.head, id.clone().slerp(q, this.fullIK ? 0.6 : 0.5))
  }


  // ---------------------------------------------------------------- idle life
  private idleVariations(dt: number) {
    if (!this.idleEnabled || this.path) {
      this.idleClock = 0
      if (this.gazeOwned) {
        this.look = null
        this.gazeOwned = false
        this.twistT = 0
      }
      return
    }
    this.idleGaze(dt)
    this.idleClock += dt
    if (this.idleClock < this.nextIdle) return
    this.idleClock = 0
    this.nextIdle = 6 + Math.random() * 6
    const r = Math.random()
    if (r < 0.55) {
      // tilt head / shift weight
      this.swayT = (Math.random() - 0.5) * 0.08
      void this.wait(2.5).then(() => (this.swayT = 0))
    } else if (r < 0.8) {
      // fix hair
      if (this.pose === 'rest') {
        this.setPose('hairTouch')
        void this.wait(1.4).then(() => this.pose === 'hairTouch' && this.setPose('rest'))
      }
    } else {
      this.twistT = (Math.random() - 0.5) * 0.3
      void this.wait(2).then(() => (this.twistT = 0))
    }
  }

  /**
   * Idle gaze: when nothing else directs her eyes, she looks around the stage every 2–4.5 s
   * (cage, crank, tray, props, the audience, the rig, the camera). Big head turns pull the upper
   * body along a little. Any explicit lookAt() from the show takes over immediately.
   */
  private idleGaze(dt: number) {
    if (this.look && !this.gazeOwned) return
    this.gazeClock -= dt
    if (this.gazeClock > 0) return
    this.gazeClock = 2 + Math.random() * 2.5
    const r = Math.random()
    if (r < 0.2) {
      this.lookAtCamera()
      this.gazeOwned = true
      this.twistT = 0
      return
    }
    if (r < 0.32) {
      // eyes front for a moment
      this.look = null
      this.gazeOwned = true
      this.twistT = 0
      return
    }
    const p = GAZE_POINTS[Math.floor(Math.random() * GAZE_POINTS.length)].clone()
    p.x += (Math.random() - 0.5) * 0.3
    p.y += (Math.random() - 0.5) * 0.15
    this.look = () => p
    this.gazeOwned = true
    // turn the chest a bit toward far-away targets (in character space)
    const d = _v.subVectors(p, this.pos).applyAxisAngle(Y, -this.yaw)
    this.twistT = clamp(Math.atan2(d.x, d.z) * 0.25, -0.3, 0.3)
  }

  // ---------------------------------------------------------------- helpers
  toWorld(local: Vector3) {
    return local.applyQuaternion(this.root.quaternion).add(this.pos)
  }
  toWorldDir(local: Vector3) {
    return local.applyAxisAngle(Y, this.yaw)
  }
  /** World position of the head (for camera framing). */
  headWorld(out: Vector3) {
    if (this.ready) return this.bones.head.localToWorld(out.copy(this.headLocal))
    return out.copy(this.pos).setY(1.5)
  }
  hipsWorld(out: Vector3) {
    if (this.ready) return this.bones.hips.getWorldPosition(out)
    return out.copy(this.pos).setY(0.85)
  }
  get isWalking() {
    return this.path !== null
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Things worth a glance on stage while idle. */
const GAZE_POINTS = [
  CAGE.center.clone(),
  CRANK.hub.clone(),
  TRAY.center.clone(),
  PROPS.clipboard.clone().setY(1.0),
  PROPS.radio.clone().setY(0.9),
  new Vector3(-2.6, 1.4, 4.5), // audience, left
  new Vector3(2.6, 1.4, 4.5), // audience, right
  new Vector3(0, 1.5, 6), // audience, centre
  new Vector3(0.6, 4.8, 2.0), // the lighting rig
]

const HAND_BONE = /wrist|Finger|Thumb|Hand_Ribon/

/**
 * Look at the skinned vertices to find where the rig *visibly* is: the head centre and how far each
 * sleeve/hand extends past the wrist bone.
 */
function measureMesh(model: Object3D, b: Record<BoneKey, Bone>) {
  const head = new Vector3()
  let headN = 0
  const ext = { L: 0, R: 0 }
  const extN = { L: 0, R: 0 }
  const v = new Vector3()
  const wristW = { L: b.lWrist.getWorldPosition(new Vector3()), R: b.rWrist.getWorldPosition(new Vector3()) }
  const axis = {
    L: wristW.L.clone().sub(b.lElbow.getWorldPosition(new Vector3())).normalize(),
    R: wristW.R.clone().sub(b.rElbow.getWorldPosition(new Vector3())).normalize(),
  }
  model.traverse((o) => {
    const mesh = o as SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    mesh.skeleton.update()
    const si = mesh.geometry.attributes.skinIndex
    const sw = mesh.geometry.attributes.skinWeight
    const bones = mesh.skeleton.bones
    for (let i = 0; i < si.count; i += 2) {
      let best = 0
      let bw = 0
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k)
        if (w > bw) {
          bw = w
          best = si.getComponent(i, k)
        }
      }
      const name = baseName(bones[best].name)
      const isHead = name === 'Head'
      const side: Side | null = HAND_BONE.test(name) ? (/(Left|_L)/.test(name) ? 'L' : /(Right|_R)/.test(name) ? 'R' : null) : null
      if (!isHead && !side) continue
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
      if (isHead) {
        head.add(v)
        headN++
      } else if (side) {
        const d = v.sub(wristW[side]).dot(axis[side])
        if (d > 0) {
          ext[side] += d
          extN[side]++
        }
      }
    }
  })
  // mean forward offset ≈ middle of the hand; ×1.2 lands near the cuff/fingers
  const e = (s: Side) => (extN[s] ? Math.min(0.3, (ext[s] / extN[s]) * 1.2) : 0.05)
  return {
    headCenter: headN ? head.divideScalar(headN) : b.head.getWorldPosition(new Vector3()),
    handExt: { L: e('L'), R: e('R') },
  }
}
export const angleDiff = (a: number, b: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export const host = new HostController()
