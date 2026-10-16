import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAfterPhysicsStep, useRapier } from '@react-three/rapier'
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { CAGE, CRANK } from '../layout'
import { brass } from '../materials'
import { baffles } from './CageColliders'
import { Lid } from './Lid'
import { OutletDoor, ChuteAndTray } from './Outlet'
import { Crank } from './Crank'
import { cage, fx, stage } from '../../director/channels'
import { spin } from '../../director/spin'
import { director } from '../../director/Director'
import { ballSystem } from '../Balls/ballSystem'
import { merge, ring, rod } from '../geom'
import { useQuality } from '../../quality/qualityPresets'

/** Drum bars (meridians + latitudes + baffles + axle), in drum-local space, merged into one geometry. */
function useDrumGeometry() {
  return useMemo(() => {
    const R = CAGE.radius
    const parts = []
    const X = new Vector3(1, 0, 0)
    // meridians: rings whose plane contains the X axis
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI
      parts.push(ring(new Vector3(), new Vector3(0, -Math.sin(a), Math.cos(a)), R, 0.0055, 72))
    }
    // latitudes: rings around X
    for (const x of [-0.34, -0.24, -0.12, 0, 0.12, 0.24, 0.34]) {
      parts.push(ring(new Vector3(x, 0, 0), X, Math.sqrt(R * R - x * x), x === 0 ? 0.009 : 0.005, 72))
    }
    // baffles
    for (const b of baffles()) {
      const g = new BoxGeometry(b.half.x * 2, b.half.y * 2, b.half.z * 2)
      g.applyQuaternion(b.quat)
      g.translate(b.pos.x, b.pos.y, b.pos.z)
      parts.push(g)
    }
    // hubs on both ends of the drum
    parts.push(new CylinderGeometry(0.05, 0.05, 0.03, 24).rotateZ(Math.PI / 2).translate(R, 0, 0))
    parts.push(new CylinderGeometry(0.05, 0.05, 0.03, 24).rotateZ(Math.PI / 2).translate(-R, 0, 0))
    return merge(parts)
  }, [])
}

/** Static A-frame stands + axle, world space. */
function useFrameGeometry() {
  return useMemo(() => {
    const c = CAGE.center
    const parts = []
    for (const sx of [-1, 1]) {
      const x = sx * (CAGE.radius + 0.1)
      const top = new Vector3(x, c.y, 0)
      const fl = new Vector3(x, 0.02, 0.36)
      const bl = new Vector3(x, 0.02, -0.36)
      parts.push(rod(fl, top, 0.016), rod(bl, top, 0.016))
      parts.push(rod(new Vector3(x, 0.32, 0.25), new Vector3(x, 0.32, -0.25), 0.01))
      parts.push(rod(fl.clone().setY(0.015), bl.clone().setY(0.015), 0.012))
      parts.push(ring(top, new Vector3(1, 0, 0), 0.04, 0.012, 24)) // bearing
    }
    // base rails
    for (const sz of [-0.36, 0.36]) parts.push(rod(new Vector3(-0.5, 0.015, sz), new Vector3(0.5, 0.015, sz), 0.012))
    // axle through the bearings to the crank
    parts.push(rod(new Vector3(-0.56, c.y, 0), new Vector3(CRANK.hub.x, c.y, 0), 0.012))
    return merge(parts)
  }, [])
}

export function Cage() {
  const drum = useRef<Group>(null)
  const ghostA = useRef<Mesh>(null)
  const ghostB = useRef<Mesh>(null)
  const drumGeo = useDrumGeometry()
  const frameGeo = useFrameGeometry()
  const motionBlur = useQuality().motionBlur
  const ghostMat = useMemo(() => {
    const m = brass.clone() as MeshStandardMaterial
    m.transparent = true
    m.opacity = 0
    m.depthWrite = false
    return m
  }, [])

  useFrame((state, dt) => {
    spin.update(Math.min(dt, 0.05))
    const rock = Math.sin(state.clock.elapsedTime * 1.3) * 0.004 * stage.cageRock
    if (drum.current) drum.current.rotation.x = cage.angle + rock
    // cheap motion blur: two trailing translucent copies (Ultra)
    const blur = motionBlur ? Math.min(1, Math.abs(cage.omega) / 10) : 0
    fx.blur = blur
    ghostMat.opacity = blur * 0.22
    if (ghostA.current) {
      ghostA.current.visible = blur > 0.05
      ghostA.current.rotation.x = cage.angle - cage.omega * 0.012
    }
    if (ghostB.current) {
      ghostB.current.visible = blur > 0.05
      ghostB.current.rotation.x = cage.angle - cage.omega * 0.024
    }
  })

  return (
    <group>
      <mesh geometry={frameGeo} material={brass} castShadow receiveShadow />
      <group position={CAGE.center}>
        <group
          ref={drum}
          onPointerDown={(e) => {
            e.stopPropagation()
            director.cageTap()
          }}
        >
          <mesh geometry={drumGeo} material={brass} castShadow />
          <Lid />
          <OutletDoor />
          {/* invisible shell so the open bars are easy to tap */}
          <mesh>
            <sphereGeometry args={[CAGE.radius, 16, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
        <mesh ref={ghostA} geometry={drumGeo} material={ghostMat} visible={false} />
        <mesh ref={ghostB} geometry={drumGeo} material={ghostMat} visible={false} />
      </group>
      <Crank />
      <ChuteAndTray />
      <CagePhysics />
    </group>
  )
}

/** Ball solver tick (drum) + the single Rapier body used for the chute roll. */
function CagePhysics() {
  const { world, rapier } = useRapier()
  useEffect(() => {
    ballSystem.init(rapier, world)
    return () => ballSystem.dispose()
  }, [world, rapier])
  useFrame((_, dt) => ballSystem.update(dt))
  useAfterPhysicsStep(() => ballSystem.syncChute())
  return null
}
