/** Logical bones the animator drives. Every rig maps these to its own skeleton. */
export type BoneKey =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'lArm' | 'lElbow' | 'lWrist' | 'rArm' | 'rElbow' | 'rWrist'
  | 'lLeg' | 'lKnee' | 'lAnkle' | 'lToe' | 'rLeg' | 'rKnee' | 'rAnkle' | 'rToe'
  | 'lMid' | 'rMid'

export type Side = 'L' | 'R'

/**
 * Everything model-specific about a host character. The animator (useHostAnimator) only talks to
 * the skeleton through this class, so adding a character = one subclass in rigs/ + one entry in
 * rigs/index.ts.
 */
export abstract class HostRig {
  /** stable id (persisted in the player's choice) */
  abstract readonly id: string
  /** name shown in the model picker */
  abstract readonly label: string
  /** compressed GLB in /public (see `npm run compress-host`) */
  abstract readonly url: string
  /** logical bone → base bone name in this skeleton (after `baseName()`) */
  abstract readonly bones: Record<BoneKey, string>
  /** standing height on stage (m); the cage is ~1.45 m tall */
  readonly height: number = 1.6
  /**
   * 'toon': the GLB is unlit (anime export) → convert to a 3-step toon material with rim light.
   * 'lit': keep the GLB's own PBR materials.
   */
  readonly materials: 'toon' | 'lit' = 'lit'
  /** horizontal centring of the model on its root: bounding-box centre, or the hips bone (big tails) */
  readonly centreOn: 'bounds' | 'hips' = 'bounds'
  /** play the GLB's own Idle/Walk clips for body + legs (procedural arms, gaze and lean stay on top) */
  readonly useClips: boolean = false
  /** how high she/he hops on each skipping step (m) */
  readonly hop: number = 0.075
  /**
   * Relaxed arms: hand offset sideways from the shoulder (m), how far down it hangs as a fraction of
   * the arm's reach (1 = straight down), and how far in front of the body (m).
   */
  readonly armRest = { out: 0.1, hang: 0.45, forward: 0.2 }
  /**
   * Fraction of the measured "mesh beyond the wrist" used as the grip point. Mitten sleeves grip at
   * the tip (1); real hands grip at the palm, roughly half way to the fingertips.
   */
  readonly handReach: number = 1
  /** how the hero ball sits in the hand: display scale and lift above the grip point (m) */
  readonly hold = { ballScale: 2, lift: 0.05 }
  /** ticket display scale while held */
  readonly ticketScale: number = 1.6
  /** half the distance between the hands' grip points when the palms meet in a clap (m) */
  readonly clapHalfGap: number = 0.03
  /** body when picking the ball off the tray: forward lean (rad) and knee crouch (m) */
  readonly pickup = { lean: 0.55, crouch: 0.1 }
  /** hand distance from the centre line when carrying the ballot box (box half-width + hand) */
  readonly carryHalfWidth: number = 0.2
  /** how far in front of the body the hands (= the box centre) are when carrying with both hands (m) */
  readonly carryForward: number = 0.36
  /** short characters hop while turning the crank (peak height, m); 0 = stand still */
  readonly crankHop: number = 0
  /** short arms: step this much closer before grabbing the crank knob or the ball on the tray (m) */
  readonly reachStep: number = 0
  /** stand this much further right of the tray mark (big heads would sink into the table) (m) */
  readonly trayStandoff: number = 0
  /** big chibi heads: hold presented things this much lower and wider so they don't touch the face (m) */
  readonly headClear: number = 0
  /** slide the ticket close-up (camera + ticket) sideways/up so the host's head stays out of frame (m) */
  readonly ticketShot = { x: 0, y: 0 }
  /**
   * Knuckle bones that span the palm (index & pinky metacarpals). When given, the animator measures
   * the real palm direction every frame, rolls holding wrists palm-up and places held objects on the
   * palm side. Omit for mitten-like hands (objects just sit on top).
   */
  readonly palmBones: { L: { index: string; pinky: string }; R: { index: string; pinky: string } } | null = null

  /** Raw node name → base name: spaces become "_", the exporter's "_<index>" suffix is dropped. */
  baseName(name: string): string {
    return name.replace(/\s/g, '_').replace(/_\d+$/, '')
  }

  /** Spring gain for secondary-motion bones (hair, ribbons, hood…), 0 = not a spring. */
  springGain(_base: string): number {
    return 0
  }

  /** Wing roots that flap: +1 left, -1 right, 0 = not a wing. */
  wingSide(_base: string): number {
    return 0
  }

  /** Root of a skirt/coat strand pushed by the thighs (so legs never cut through the cloth). */
  isSkirtRoot(_base: string): boolean {
    return false
  }

  /** Which hand a bone belongs to (wrist + fingers), used to measure where the visible hand is. */
  abstract handSide(base: string): Side | null
}
