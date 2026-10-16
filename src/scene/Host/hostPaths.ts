import { CatmullRomCurve3, Vector3 } from 'three'
import { MARKS } from '../layout'

/**
 * Host blocking: waypoints are walked along a centripetal Catmull-Rom spline.
 * Routes go behind the cage so the host never crosses the tray/table in front.
 */
const v = (x: number, z: number) => new Vector3(x, 0, z)

export const PATHS = {
  /** wing (stage left, in darkness) → crank mark, passing well behind the cage frame (z ≤ -0.36) */
  enter: [MARKS.wing, v(-2.6, -0.95), v(-1.0, -0.95), v(0.3, -0.92), v(1.1, -0.55), MARKS.crank],
  /** crank → right end of the table (stays right of the crank sweep and the table edge) */
  toTray: [MARKS.crank, v(1.18, 0.5), MARKS.tray],
  /** table → back to the crank */
  toCrank: [MARKS.tray, v(1.18, 0.5), MARKS.crank],
  /** crank → downstage right for the final bow (in front of the table's right end) */
  toBow: [MARKS.crank, v(1.2, 0.7), MARKS.bow],
  /** exit into the stage-left wing: around the right side, behind the cage */
  exit: [MARKS.bow, v(1.25, 0.6), v(1.15, -0.5), v(0.3, -0.92), v(-1.0, -0.95), v(-2.8, -0.9), MARKS.wing],
  exitFromCrank: [MARKS.crank, v(1.1, -0.55), v(0.3, -0.92), v(-1.0, -0.95), v(-2.8, -0.9), MARKS.wing],
  exitFromTray: [MARKS.tray, v(1.18, 0.5), v(1.15, -0.5), v(0.3, -0.92), v(-1.0, -0.95), v(-2.8, -0.9), MARKS.wing],
}

export function curve(points: Vector3[]) {
  return new CatmullRomCurve3(points, false, 'centripetal', 0.5)
}
