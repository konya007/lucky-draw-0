import { HostRig, type BoneKey, type Side } from './HostRig'

/** A regex rule on base bone names. */
interface Rule {
  /** RegExp source, tested against the base bone name (see `baseName()`) */
  match: string
}

/**
 * `info.json` of a model pack (src/assets/<folder>/ or an uploaded .zip).
 * The JSON Schema in src/assets/model.schema.json documents every field.
 */
export interface ModelInfo {
  /** stable id, saved as the player's choice (letters, digits, - and _) */
  id: string
  /** name shown in the model picker */
  name: string
  /** sort order in the picker (lower first); the lowest built-in is the default host */
  order?: number
  author?: string
  license?: string
  source?: string
  description?: string
  /** files inside the pack folder */
  files?: {
    /** the character (default "host.glb") */
    model?: string
    /** optional GLB with extra clips (Idle, Walk…) for a model without its own */
    animations?: string
    /** optional preview image for the picker */
    thumbnail?: string
  }
  /** voice lines (file in the pack, e.g. "voice/start.mp3") */
  voices?: { voiceStart?: string; voiceCongrats?: string }
  /** standing height on stage (m); the cage is ~1.45 m tall */
  height?: number
  /** 'toon' for unlit (anime) exports, 'lit' keeps the GLB's PBR materials */
  materials?: 'toon' | 'lit'
  /** centre the model on its bounds or on the hips bone (big tails/capes) */
  centreOn?: 'bounds' | 'hips'
  /** play the GLB's own Idle/Walk clips for body + legs */
  useClips?: boolean
  /** logical bone → base bone name in this skeleton */
  bones: Record<BoneKey, string>
  /** index & pinky knuckle bones per hand (real hands); omit for mittens */
  palmBones?: { L: { index: string; pinky: string }; R: { index: string; pinky: string } } | null
  /** secondary-motion bones (hair, ears, capes…): first matching rule wins */
  springs?: (Rule & { gain: number })[]
  /** wing roots that flap */
  wings?: { left: string; right: string }
  /** roots of skirt/coat strands pushed by the thighs */
  skirtRoots?: string
  /** which bones belong to a hand (wrist + fingers): `match` selects them, `left`/`right` pick the side */
  hands: { match: string; left: string; right: string }
  /** fine-tuning of the shared animation (every field optional, see HostRig for the meaning) */
  motion?: Partial<Pick<HostRig, MotionKey>>
}

export type MotionKey =
  | 'hop' | 'armRest' | 'handReach' | 'hold' | 'ticketScale' | 'clapHalfGap' | 'pickup' | 'carryHalfWidth'
  | 'carryForward' | 'crankHop' | 'reachStep' | 'trayStandoff' | 'headClear' | 'ticketShot'

/** Optional code hooks a built-in pack may export from `rig.ts` (uploaded packs are data-only). */
export type RigHooks = Partial<Pick<HostRig, 'baseName' | 'springGain' | 'wingSide' | 'isSkirtRoot' | 'handSide'>>

/** Resolved file URLs of a pack. */
export interface PackUrls {
  model: string
  animations?: string
  thumbnail?: string
  voices: Partial<Record<'voiceStart' | 'voiceCongrats', string>>
}

const MOTION_KEYS: MotionKey[] = ['hop', 'armRest', 'handReach', 'hold', 'ticketScale', 'clapHalfGap', 'pickup', 'carryHalfWidth', 'carryForward', 'crankHop', 'reachStep', 'trayStandoff', 'headClear', 'ticketShot']
const BONE_KEYS: BoneKey[] = ['hips', 'spine', 'chest', 'neck', 'head', 'lArm', 'lElbow', 'lWrist', 'rArm', 'rElbow', 'rWrist', 'lLeg', 'lKnee', 'lAnkle', 'lToe', 'rLeg', 'rKnee', 'rAnkle', 'rToe', 'lMid', 'rMid']

/** Throws a readable error when an info.json is unusable. */
export function validateInfo(info: unknown): asserts info is ModelInfo {
  const i = info as Partial<ModelInfo> | null
  if (!i || typeof i !== 'object') throw new Error('info.json is not a JSON object')
  if (!i.id || !/^[\w-]+$/.test(i.id)) throw new Error('info.json: "id" is required (letters, digits, - and _ only)')
  if (!i.name) throw new Error('info.json: missing "name"')
  if (!i.bones) throw new Error('info.json: missing "bones"')
  const missing = BONE_KEYS.filter((k) => !i.bones![k])
  if (missing.length) throw new Error(`info.json: "bones" is missing ${missing.join(', ')}`)
  if (!i.hands?.match || !i.hands.left || !i.hands.right) throw new Error('info.json: "hands" needs match, left and right')
  for (const r of [i.hands.match, i.hands.left, i.hands.right, i.skirtRoots, i.wings?.left, i.wings?.right, ...(i.springs ?? []).map((s) => s.match)]) {
    if (r === undefined) continue
    try {
      new RegExp(r)
    } catch {
      throw new Error(`info.json: invalid regex: ${r}`)
    }
  }
}

/**
 * A host character described by data (info.json) instead of a hand-written subclass.
 * Every model pack, built-in or uploaded, becomes one of these.
 */
export class PackRig extends HostRig {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly bones: Record<BoneKey, string>
  /** where the pack came from: shipped in src/assets or uploaded by the user */
  readonly origin: 'builtin' | 'upload'
  readonly order: number
  readonly info: ModelInfo
  readonly urls: PackUrls
  private readonly springRules: { re: RegExp; gain: number }[]
  private readonly handRe: { match: RegExp; left: RegExp; right: RegExp }
  private readonly wingRe: { left: RegExp; right: RegExp } | null
  private readonly skirtRe: RegExp | null

  constructor(info: ModelInfo, urls: PackUrls, origin: 'builtin' | 'upload', hooks?: RigHooks) {
    super()
    validateInfo(info)
    this.info = info
    this.urls = urls
    this.origin = origin
    this.id = info.id
    this.label = info.name
    this.url = urls.model
    this.bones = info.bones
    this.order = info.order ?? (origin === 'builtin' ? 50 : 100)
    // data fields override the HostRig defaults (they are plain class fields, assigned after super())
    const w = this as unknown as Record<string, unknown>
    if (info.height !== undefined) w.height = info.height
    if (info.materials) w.materials = info.materials
    if (info.centreOn) w.centreOn = info.centreOn
    if (info.useClips !== undefined) w.useClips = info.useClips
    if (info.palmBones !== undefined) w.palmBones = info.palmBones
    for (const k of MOTION_KEYS) if (info.motion?.[k] !== undefined) w[k] = info.motion[k]
    this.springRules = (info.springs ?? []).map((s) => ({ re: new RegExp(s.match), gain: s.gain }))
    this.handRe = { match: new RegExp(info.hands.match), left: new RegExp(info.hands.left), right: new RegExp(info.hands.right) }
    this.wingRe = info.wings ? { left: new RegExp(info.wings.left), right: new RegExp(info.wings.right) } : null
    this.skirtRe = info.skirtRoots ? new RegExp(info.skirtRoots) : null
    if (hooks) Object.assign(this, hooks)
  }

  springGain(base: string) {
    return this.springRules.find((r) => r.re.test(base))?.gain ?? 0
  }

  wingSide(base: string) {
    if (!this.wingRe) return 0
    return this.wingRe.left.test(base) ? 1 : this.wingRe.right.test(base) ? -1 : 0
  }

  isSkirtRoot(base: string) {
    return this.skirtRe?.test(base) ?? false
  }

  handSide(base: string): Side | null {
    if (!this.handRe.match.test(base)) return null
    return this.handRe.left.test(base) ? 'L' : this.handRe.right.test(base) ? 'R' : null
  }
}
