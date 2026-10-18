import { HostRig, type BoneKey, type Side } from './HostRig'

/**
 * "MrBeast" Fortnite outfit (Unreal Engine mannequin skeleton: pelvis / spine_01…05 / upperarm_l…,
 * PBR materials). The hood, cape, megaphone and shoe tabs (`dyn_*`) swing on springs.
 * Bone names look like `upperarm_l_017` → base `upperarm_l`.
 */
export class MrBeastRig extends HostRig {
  readonly id = 'mrbeast'
  readonly label = 'MrBeast'
  readonly url = '/host-mrbeast.glb'
  readonly height = 1.75
  readonly materials = 'lit' as const
  /** a grown-up skips a little lower */
  readonly hop = 0.055
  /** arms hang naturally by the sides (the chibi girl keeps hers forward to show her sleeves) */
  readonly armRest = { out: 0.05, hang: 0.82, forward: 0.06 }
  /** real hands: grip at the palm, not the fingertips */
  readonly handReach = 0.5
  /** a normal-size ball sitting in the palm */
  readonly hold = { ballScale: 1.25, lift: 0.025 }
  readonly ticketScale = 1.05
  /** wider hands → palms meet further apart (otherwise the fingers interlock) */
  readonly clapHalfGap = 0.07
  /** taller: bend further down to reach the tray */
  readonly pickup = { lean: 0.75, crouch: 0.2 }
  readonly palmBones = {
    L: { index: 'index_metacarpal_l', pinky: 'pinky_metacarpal_l' },
    R: { index: 'index_metacarpal_r', pinky: 'pinky_metacarpal_r' },
  }
  readonly carryHalfWidth = 0.21
  readonly bones: Record<BoneKey, string> = {
    hips: 'pelvis', spine: 'spine_02', chest: 'spine_04', neck: 'neck_01', head: 'head',
    lArm: 'upperarm_l', lElbow: 'lowerarm_l', lWrist: 'hand_l',
    rArm: 'upperarm_r', rElbow: 'lowerarm_r', rWrist: 'hand_r',
    lLeg: 'thigh_l', lKnee: 'calf_l', lAnkle: 'foot_l', lToe: 'ball_l',
    rLeg: 'thigh_r', rKnee: 'calf_r', rAnkle: 'foot_r', rToe: 'ball_r',
    lMid: 'middle_01_l', rMid: 'middle_01_r',
  }

  springGain(base: string) {
    if (/^dyn_hood/.test(base)) return 0.8
    if (base === 'cape' || base === 'dyn_megaphone') return 0.7
    if (/^dyn_shoe_back_[lr]$/.test(base)) return 0.4
    return 0
  }

  handSide(base: string): Side | null {
    const m = /^(hand|thumb|index|middle|ring|pinky)_.*?([lr])$/.exec(base) ?? /^hand_([lr])$/.exec(base)
    if (!m) return null
    return m[m.length - 1] === 'l' ? 'L' : 'R'
  }
}
