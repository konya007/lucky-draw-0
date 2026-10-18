import { HostRig, type BoneKey, type Side } from './HostRig'

/**
 * "3d anime character girl" (Sketchfab, VRoid/Unity-humanoid style skeleton, 185 joints, unlit).
 * Twin tails, ribbons and a tail swing on springs, small bat wings flap, 12 skirt strands follow
 * the thighs. Bone names look like `Left arm_20` → base `Left_arm`.
 */
export class AnimeGirlRig extends HostRig {
  readonly id = 'anime'
  readonly label = 'Cô gái anime'
  readonly url = '/host.glb'
  readonly height = 1.6
  readonly materials = 'toon' as const
  readonly carryHalfWidth = 0.22
  readonly bones: Record<BoneKey, string> = {
    hips: 'Hips', spine: 'Spine', chest: 'Chest', neck: 'Neck', head: 'Head',
    lArm: 'Left_arm', lElbow: 'Left_elbow', lWrist: 'Left_wrist',
    rArm: 'Right_arm', rElbow: 'Right_elbow', rWrist: 'Right_wrist',
    lLeg: 'Left_leg', lKnee: 'Left_knee', lAnkle: 'Left_ankle', lToe: 'Left_toe',
    rLeg: 'Right_leg', rKnee: 'Right_knee', rAnkle: 'Right_ankle', rToe: 'Right_toe',
    lMid: 'MiddleFinger1_L', rMid: 'MiddleFinger1_R',
  }

  springGain(base: string) {
    return /^(Hair_Side01_[LR]|Hair_Side_Ribon01_[LR]|Hair_Front_00[12]|Tail_02|Front_Ribon_01_[LR])$/.test(base) ? 1 : 0
  }

  wingSide(base: string) {
    return /^Wing02_[LR]$/.test(base) ? (base.endsWith('L') ? 1 : -1) : 0
  }

  isSkirtRoot(base: string) {
    return /^Skirt_0_\d+$/.test(base)
  }

  handSide(base: string): Side | null {
    if (!/wrist|Finger|Thumb|Hand_Ribon/.test(base)) return null
    return /(Left|_L)/.test(base) ? 'L' : /(Right|_R)/.test(base) ? 'R' : null
  }
}
