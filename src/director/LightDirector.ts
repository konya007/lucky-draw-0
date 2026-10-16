import gsap from 'gsap'
import { fx, lights } from './channels'
import { audio } from '../audio/audioManager'
import { FIXTURES } from '../scene/Lights'

type Numeric = { [K in keyof typeof lights]: (typeof lights)[K] extends number ? K : never }[keyof typeof lights]
export type CueValues = Partial<Record<Numeric, number>>
export interface Cue {
  values: CueValues
  dur: number
  ease?: string
  /** stagger per channel in listed order (s) */
  stagger?: number
}

/**
 * Light cues as data (section 7.2). Every change is a tween — nothing pops,
 * except the deliberate incandescent "thunk" of KEY at curtain-up.
 */
export const CUES = {
  editing: { values: { key: 0, fillL: 0, fillR: 0, rim: 0, follow: 0, pin: 0, foot: 0.25, practical: 0, gobo: 1, master: 1, breathe: 0, flicker: 0, chase: 0, fillWarm: 0 }, dur: 1.6 },
  hostEnter: { values: { key: 0.7, follow: 1, followAngle: 0.2 }, dur: 1.2, ease: 'power2.inOut' },
  loading: { values: { key: 0.85, follow: 0.8, rim: 1 }, dur: 1.2 },
  idle: { values: { key: 1, fillL: 1, fillR: 1, rim: 1, follow: 0.75, followAngle: 0.2, pin: 0, foot: 1, practical: 1, breathe: 1, flicker: 0, master: 1, chase: 0, fillWarm: 0 }, dur: 1.4 },
  spinning: { values: { rim: 1.3, flicker: 1, practical: 0, breathe: 0, follow: 0.6 }, dur: 0.8 },
  decel: { values: { fillL: 0.4, fillR: 0.4, rim: 0.4, follow: 0.4, foot: 0.4, flicker: 0.3 }, dur: 3.5, ease: 'sine.inOut' },
  dispensing: { values: { key: 0.15, fillL: 0.15, fillR: 0.15, rim: 0.15, follow: 0.15, foot: 0.15, pin: 1, flicker: 0 }, dur: 0.9, ease: 'power2.inOut' },
  pickup: { values: { key: 0.5, follow: 0.9, followAngle: 0.17, pin: 0.6, fillL: 0.3, fillR: 0.3 }, dur: 1.2 },
  presented: { values: { follow: 1.1, followAngle: 0.1, key: 0.35, pin: 0.3, fillL: 0.25, fillR: 0.25, rim: 0.6 }, dur: 1.5, ease: 'sine.inOut' },
  ticket: { values: { key: 0.9, fillL: 0.9, fillR: 0.9, rim: 0.9, follow: 0.9, followAngle: 0.2, foot: 0.9, pin: 0, fillWarm: 1, chase: 0, breathe: 1 }, dur: 1.6 },
} satisfies Record<string, Cue>

export type CueName = keyof typeof CUES

export const lightDirector = {
  cue(name: CueName, speed = 1) {
    const c = CUES[name] as Cue
    return gsap.to(lights, { ...c.values, duration: c.dur / speed, ease: c.ease ?? 'power2.inOut', overwrite: 'auto' })
  },

  /** Curtain-up: KEY thunks on (0→100% in 80ms) with two filament flickers, fills follow 250ms apart, rim fades 1.5s. */
  curtainUp() {
    const tl = gsap.timeline()
    tl.call(() => audio.play('lightOn', { vol: 0.9, pos: FIXTURES.key.pos }))
    tl.to(lights, { key: 1, duration: 0.08, ease: 'none', gobo: 0 })
    tl.to(lights, { key: 0.35, duration: 0.05, ease: 'none' })
    tl.to(lights, { key: 1, duration: 0.06, ease: 'none' })
    tl.to(lights, { key: 0.6, duration: 0.04, ease: 'none' })
    tl.to(lights, { key: 1, duration: 0.1, ease: 'power1.out' })
    tl.call(() => audio.play('lightOn', { vol: 0.5, pitch: 1.2, pos: FIXTURES.fillL.pos }), [], '+=0.25')
    tl.to(lights, { fillL: 1, duration: 0.12, ease: 'power2.out' }, '<')
    tl.call(() => audio.play('lightOn', { vol: 0.5, pitch: 1.1, pos: FIXTURES.fillR.pos }), [], '+=0.25')
    tl.to(lights, { fillR: 1, duration: 0.12, ease: 'power2.out' }, '<')
    tl.to(lights, { rim: 1, foot: 1, duration: 1.5, ease: 'sine.inOut' }, '+=0.1')
    return tl
  },

  /** FOLLOW "pops" on in the wing. */
  followOn() {
    audio.play('lightOn', { vol: 0.7, pitch: 0.9, pos: FIXTURES.follow.pos })
    return gsap.timeline().to(lights, { follow: 1, duration: 0.09, ease: 'none' }).to(lights, { follow: 0.55, duration: 0.05 }).to(lights, { follow: 1, duration: 0.15 })
  },

  /** The opening: burst from the core, a 60ms warm-white frame, then everything 120% with a 3x chase. */
  burst(color: { r: number; g: number; b: number }) {
    lights.burstColor.set(color.r, color.g, color.b)
    const tl = gsap.timeline()
    tl.to(lights, { burst: 1, duration: 0.08, ease: 'power4.out' })
    tl.to(lights.burstColor, { x: 1, y: 0.85, z: 0.5, duration: 0.3 }, '<')
    tl.to(fx, { flash: 0.85, duration: 0.03 }, '<')
    tl.to(fx, { flash: 0, duration: 0.25, ease: 'power2.out' }, '+=0.03')
    tl.to(fx, { bloom: 2.2, exposure: 1.25, duration: 0.15 }, '<')
    tl.to(lights, { burst: 0, duration: 1.5, ease: 'power2.out' }, 0.3)
    tl.to(lights, { key: 1.2, fillL: 1.2, fillR: 1.2, rim: 1.2, foot: 1.2, follow: 1.1, pin: 0, chase: 1, duration: 0.4 }, 0.15)
    tl.to(fx, { bloom: 0.7, exposure: 1, duration: 1.4, ease: 'power2.out' }, 0.6)
    tl.to(lights, { chase: 0, duration: 0.6 }, 2.2)
    return tl
  },

  /** Finale: lights die from the outside in; KEY last, leaving a sliver on the closing curtain. */
  finale() {
    const tl = gsap.timeline()
    tl.to(lights, { foot: 0, practical: 0, duration: 1.2, ease: 'sine.inOut' })
    tl.to(lights, { fillL: 0, fillR: 0, duration: 1.6, ease: 'sine.inOut' }, '-=0.6')
    tl.to(lights, { rim: 0, follow: 0, breathe: 0, duration: 1.6, ease: 'sine.inOut' }, '-=0.8')
    tl.to(lights, { key: 0.18, gobo: 0.6, duration: 2.2, ease: 'sine.inOut' }, '-=0.6')
    return tl
  },
}
