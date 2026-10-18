import { HostRig, type BoneKey, type Side } from './HostRig'

/**
 * "Fox" mascot v2 (chibi, 36-bone Blender-style rig: upper_arm.L / forearm.L / hand.L, index/pinky
 * knuckles + thumb per paw, toe bones, PBR). It ships with its own clips (Idle, Walk, Wave, Jump,
 * TailWag): Idle/Walk drive the body and legs, the procedural layer adds arms (IK), gaze, lean and
 * bow on top. v2 re-weighted the skin so the head, glasses and torso no longer stretch with the arms.
 * three.js strips the dots from node names: `hand.L` → `handL`, `f_index.01.L` → `f_index01L`.
 */
export class FoxRig extends HostRig {
  readonly id = 'fox'
  readonly label = 'Cáo Kính'
  readonly url = '/host-fox.glb'
  /** chibi: big head, short body */
  readonly height = 1.3
  readonly materials = 'lit' as const
  readonly useClips = true
  /** the huge tail would pull the bounds' centre back and push the body ~19 cm in front of the root */
  readonly centreOn = 'hips' as const
  readonly hop = 0.05
  readonly armRest = { out: 0.08, hang: 0.7, forward: 0.08 }
  /** short paws: grip at the paw tip */
  readonly handReach = 1
  readonly hold = { ballScale: 1.6, lift: 0.02 }
  readonly ticketScale = 1.2
  readonly clapHalfGap = 0.05
  readonly pickup = { lean: 0.45, crouch: 0.05 }
  /** chubby paws: a little wider than the box so they show on both sides, and clear of the round belly */
  readonly carryHalfWidth = 0.23
  readonly carryForward = 0.4
  /** the knob is above its reach: jumps up to grab it on every pull */
  readonly crankHop = 0.3
  /** short paws: steps right up to the knob */
  readonly reachStep = 0.2
  /** the wide head would push into the table: stands well clear of its end */
  readonly trayStandoff = 0.4
  /** the snout sticks out over the chest: the ball is shown lower and to the side */
  readonly headClear = 0.14
  /** the big head would fill the bottom-right of the ticket close-up: slide the shot left and up */
  readonly ticketShot = { x: -0.62, y: 0.24 }
  readonly palmBones = {
    L: { index: 'f_index01L', pinky: 'f_pinky01L' },
    R: { index: 'f_index01R', pinky: 'f_pinky01R' },
  }
  readonly bones: Record<BoneKey, string> = {
    hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
    lArm: 'upper_armL', lElbow: 'forearmL', lWrist: 'handL',
    rArm: 'upper_armR', rElbow: 'forearmR', rWrist: 'handR',
    lLeg: 'thighL', lKnee: 'shinL', lAnkle: 'footL', lToe: 'toeL',
    rLeg: 'thighR', rKnee: 'shinR', rAnkle: 'footR', rToe: 'toeR',
    lMid: 'handL', rMid: 'handR',
  }

  springGain(base: string) {
    // the ears flop a little when the fox moves (the tail is animated by the clips)
    return /^ear[LR]0[12]$/.test(base) ? 0.7 : 0
  }

  handSide(base: string): Side | null {
    if (!/^(hand|f_index01|f_pinky01|thumb01)[LR]$/.test(base)) return null
    return base.endsWith('L') ? 'L' : 'R'
  }
}
