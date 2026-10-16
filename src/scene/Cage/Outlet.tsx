import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { BoxGeometry, CylinderGeometry, Group, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { CAGE, CHUTE, OUTLET, TABLE, TRAY } from '../layout'
import { brass, darkWood, velvet } from '../materials'
import { stage } from '../../director/channels'
import { basisMatrix, merge } from '../geom'

const GATE_HALF = 0.12 // angular half-size of the gate door (radians)

/** Outlet gate on the drum (drum-local). Hinge on the upper edge, swings outward. */
export function OutletDoor() {
  const pivot = useRef<Group>(null)
  const { geo, hinge } = useMemo(() => {
    const R = CAGE.radius
    const phi = -OUTLET.angle // below the front
    const dir = new Vector3(0, Math.sin(phi), Math.cos(phi))
    const hinge = new Vector3(0, Math.sin(phi + GATE_HALF), Math.cos(phi + GATE_HALF)).multiplyScalar(R + 0.004)
    const cap = new SphereGeometry(R + 0.006, 12, 3, 0, Math.PI * 2, 0, GATE_HALF)
    cap.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir))
    cap.applyMatrix4(new Matrix4().makeTranslation(-hinge.x, -hinge.y, -hinge.z))
    return { geo: cap, hinge }
  }, [])
  useFrame(() => {
    if (pivot.current) pivot.current.rotation.x = -stage.gate
  })
  return (
    <group ref={pivot} position={hinge}>
      <mesh geometry={geo} material={brass} castShadow />
    </group>
  )
}

/** Chute frame vectors shared by the visual trough and its colliders. */
function chuteFrame() {
  const dir = CHUTE.end.clone().sub(CHUTE.start)
  const len = dir.length()
  dir.normalize()
  const x = new Vector3(-1, 0, 0)
  const up = new Vector3(0, dir.z, -dir.y) // floor normal
  const mid = CHUTE.start.clone().add(CHUTE.end).multiplyScalar(0.5)
  return { dir, len, x, up, mid }
}

/** Brass chute, velvet tray and the dark wood table, plus their static colliders. */
export function ChuteAndTray() {
  const { brassGeo, woodGeo, velvetGeo } = useMemo(() => {
    const { dir, len, x, up, mid } = chuteFrame()
    const w = CHUTE.width
    // half-pipe trough (open top)
    const trough = new CylinderGeometry(w / 2, w / 2, len + 0.04, 16, 1, true, Math.PI / 2, Math.PI)
    trough.applyMatrix4(basisMatrix(x, dir, up, mid.clone().addScaledVector(up, w / 2)))
    // tray rim
    const [sx, sz] = TRAY.size
    const rimH = TRAY.rim
    const ty = TRAY.center.y
    const rims = [
      new BoxGeometry(sx + 0.02, rimH, 0.012).translate(TRAY.center.x, ty + rimH / 2, TRAY.center.z - sz / 2),
      new BoxGeometry(sx + 0.02, rimH, 0.012).translate(TRAY.center.x, ty + rimH / 2, TRAY.center.z + sz / 2),
      new BoxGeometry(0.012, rimH, sz).translate(TRAY.center.x - sx / 2, ty + rimH / 2, TRAY.center.z),
      new BoxGeometry(0.012, rimH, sz).translate(TRAY.center.x + sx / 2, ty + rimH / 2, TRAY.center.z),
    ]
    // table trim + pedestal
    const tt = TABLE.top
    const trim = new BoxGeometry(TABLE.width + 0.02, 0.018, TABLE.depth + 0.02).translate(TABLE.center.x, tt - 0.04, TABLE.center.z)
    const foot = new CylinderGeometry(0.2, 0.24, 0.03, 24).translate(TABLE.center.x, 0.015, TABLE.center.z)
    const brassGeo = merge([trough, ...rims, trim, foot])

    const top = new BoxGeometry(TABLE.width, 0.05, TABLE.depth).translate(TABLE.center.x, tt - 0.025, TABLE.center.z)
    const column = new CylinderGeometry(0.06, 0.09, tt - 0.07, 16).translate(TABLE.center.x, (tt - 0.07) / 2 + 0.02, TABLE.center.z)
    const woodGeo = merge([top, column])

    const velvetGeo = new BoxGeometry(sx, 0.01, sz).translate(TRAY.center.x, ty, TRAY.center.z)
    return { brassGeo, woodGeo, velvetGeo }
  }, [])

  useStaticColliders()

  return (
    <group>
      <mesh geometry={brassGeo} material={brass} castShadow receiveShadow />
      <mesh geometry={woodGeo} material={darkWood} castShadow receiveShadow />
      <mesh geometry={velvetGeo} material={velvet} receiveShadow />
    </group>
  )
}

/** One fixed rigid body with chute floor/walls, tray floor/rims, table top and stage floor. */
function useStaticColliders() {
  const { world, rapier } = useRapier()
  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    const add = (half: Vector3, pos: Vector3, q = new Quaternion(), friction = 0.5, restitution = 0.3) =>
      world.createCollider(
        rapier.ColliderDesc.cuboid(half.x, half.y, half.z)
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(friction)
          .setRestitution(restitution),
        body,
      )
    const { dir, len, x, up, mid } = chuteFrame()
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, dir, up))
    const w = CHUTE.width
    // floor slightly wavy friction → balls roll and spin naturally
    add(new Vector3(w / 2, len / 2 + 0.02, 0.005), mid.clone().addScaledVector(up, -0.005), q, 0.6, 0.25)
    const side = new Vector3(1, 0, 0)
    add(new Vector3(0.004, len / 2 + 0.02, 0.05), mid.clone().addScaledVector(side, w / 2 - 0.01).addScaledVector(up, 0.04), q)
    add(new Vector3(0.004, len / 2 + 0.02, 0.05), mid.clone().addScaledVector(side, -w / 2 + 0.01).addScaledVector(up, 0.04), q)

    // velvet tray: high friction, low bounce
    const [sx, sz] = TRAY.size
    const ty = TRAY.center.y
    const c = TRAY.center
    add(new Vector3(sx / 2, 0.01, sz / 2), new Vector3(c.x, ty - 0.005, c.z), undefined, 0.9, 0.15)
    // back rim is low so the chute can drop balls over it
    add(new Vector3(sx / 2, 0.012, 0.006), new Vector3(c.x, ty + 0.012, c.z - sz / 2))
    add(new Vector3(sx / 2, 0.03, 0.006), new Vector3(c.x, ty + 0.03, c.z + sz / 2))
    add(new Vector3(0.006, 0.03, sz / 2), new Vector3(c.x - sx / 2, ty + 0.03, c.z))
    add(new Vector3(0.006, 0.03, sz / 2), new Vector3(c.x + sx / 2, ty + 0.03, c.z))
    // table and floor (catch strays)
    add(new Vector3(TABLE.width / 2, 0.025, TABLE.depth / 2), new Vector3(TABLE.center.x, TABLE.top - 0.03, TABLE.center.z))
    add(new Vector3(6, 0.05, 4), new Vector3(0, -0.05, 0))
    return () => {
      if (world.getRigidBody(body.handle)) world.removeRigidBody(body)
    }
  }, [world, rapier])
}
