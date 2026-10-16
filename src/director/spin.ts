import { cage, clock } from './channels'
import { randRange } from '../lib/random'

const TAU = Math.PI * 2
/** angle relative to the nearest rest position (lid on top), in (-π, π] */
const wrap = (a: number) => a - Math.round(a / TAU) * TAU

type SpinPhase = 'idle' | 'drive' | 'coast' | 'settle'

/**
 * Drum dynamics (integrated every frame, no scripted curve):
 *   θ'' = drive − c·θ' − μ·sign(θ') − G·sin(θ)
 * - drive: the host/user cranking (short torque pulse up to the target speed)
 * - c·θ' viscous bearing drag, μ dry friction
 * - G·sin(θ): the brass outlet hatch is heavy, so the drum is an off-centre pendulum whose stable
 *   rest has the lid on top / outlet at the front. When it runs out of speed it swings back
 *   ("rocks the wrong way") a few times and settles there, like a real cage.
 * Random friction per spin gives ~4.5–6.5 s total, 1–2 turns, then 1–2 swings back before resting.
 */
class SpinController {
  phase: SpinPhase = 'idle'
  private t = 0
  private target = 10
  private driveTime = 0.6
  private c = 0.15
  private mu = 0.8
  private readonly G = 5
  private peak = 0
  private decelFired = false
  private settleFrom = 0
  private resolve: (() => void) | null = null
  onDecelerate: (() => void) | null = null

  /** Spin to a peak angular velocity (rad/s); force already includes user power. */
  start(peakOmega: number, fromDrag: boolean): Promise<void> {
    // user force × random factor 0.85–1.25
    this.target = Math.min(16, Math.max(5, peakOmega)) * randRange(0.85, 1.25)
    this.driveTime = fromDrag ? 0.15 : 0.6
    // friction picked so a typical spin lasts 5–9 s
    this.c = 0.05
    this.mu = randRange(2.3, 3.1)
    this.peak = 0
    this.decelFired = false
    this.t = 0
    this.phase = 'drive'
    return new Promise((r) => (this.resolve = r))
  }

  update(dtRaw: number) {
    if (this.phase === 'idle') return
    const dt = Math.min(dtRaw, 0.05) * clock.speed
    this.t += dt
    if (this.phase === 'settle') {
      // final tiny ease into rest (only the last few millimetres)
      const k = Math.min(1, this.t / 0.35)
      cage.angle = this.settleFrom + (Math.round(this.settleFrom / TAU) * TAU - this.settleFrom) * (k * k * (3 - 2 * k))
      cage.omega = 0
      cage.crank = cage.angle
      if (k >= 1) {
        this.phase = 'idle'
        const r = this.resolve
        this.resolve = null
        r?.()
      }
      return
    }
    // integrate in small steps for stability
    const steps = Math.ceil(dt / (1 / 240))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      let acc = 0
      if (this.phase === 'drive') {
        // crank torque until the target speed is reached
        acc += Math.max(0, (this.target - cage.omega) / Math.max(0.05, this.driveTime)) * 1.4
        if (this.t >= this.driveTime || cage.omega >= this.target * 0.98) this.phase = 'coast'
      }
      // bearing drag, plus extra damping at low speed so it rocks back only 2–3 times
      const low = 1 - Math.min(1, Math.abs(cage.omega) / 3)
      acc -= (this.c + 1.6 * low) * cage.omega
      // dry friction fades out at low speed, so the final pendulum swings can centre on the rest angle
      acc -= this.mu * Math.sign(cage.omega) * Math.min(1, Math.abs(cage.omega) / 1.5)
      acc -= this.G * Math.sin(wrap(cage.angle))
      cage.omega += acc * h
      cage.angle += cage.omega * h
    }
    cage.crank = cage.angle
    this.peak = Math.max(this.peak, Math.abs(cage.omega))
    if (this.phase === 'coast' && !this.decelFired && this.peak > 1 && Math.abs(cage.omega) < this.peak * 0.55) {
      this.decelFired = true
      this.onDecelerate?.()
    }
    // settled: nearly still and close to the rest angle (or a safety timeout)
    if (this.phase === 'coast' && ((Math.abs(cage.omega) < 0.08 && Math.abs(wrap(cage.angle)) < 0.04) || this.t > 16)) {
      if (!this.decelFired) {
        this.decelFired = true
        this.onDecelerate?.()
      }
      this.phase = 'settle'
      this.settleFrom = cage.angle
      this.t = 0
    }
  }

  /** Normalize the angle after a stop so it never grows unbounded. */
  normalize() {
    cage.angle = ((cage.angle % TAU) + TAU) % TAU
    if (cage.angle > TAU - 1e-4) cage.angle = 0
    cage.crank = cage.angle
  }
}

export const spin = new SpinController()
