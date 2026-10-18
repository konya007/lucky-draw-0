import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei'
import { Group, Quaternion, Vector3 } from 'three'
import { useGameStore } from '../store/useGameStore'
import { rigById, type HostRig } from '../scene/Host/rigs'
import { HostController } from '../scene/Host/useHostAnimator'
import { prepareHostModel } from '../scene/Host/Host'
import { BallotBox, ballot, BALLOT_SIZE } from '../scene/Props/BallotBox'
import { assetUrl } from '../lib/assetUrl'

const _mid = new Vector3()
const _down = new Vector3()

/** The chosen character, idling with the ballot box, gently turning to show off. */
function PreviewHost({ rig }: { rig: HostRig }) {
  const gltf = useGLTF(assetUrl(rig.url), false, true)
  const camera = useThree((s) => s.camera)
  const ctl = useMemo(() => new HostController(), [])
  const model = useMemo(() => prepareHostModel(gltf.scene, rig), [gltf, rig])
  // the preview has its own box state (the stage box is driven by the Director)
  const box = useMemo(() => ({ ...ballot, visible: true, pos: new Vector3(), quat: new Quaternion(), lid: 0, scale: 1, glow: 0 }), [])
  const boxGroup = useRef<Group>(null)

  useEffect(() => {
    ctl.bind(model, rig)
    if (rig.useClips && gltf.animations.length) ctl.setClips(gltf.animations, model)
    ctl.camera = camera
    ctl.place(new Vector3(0, 0, 0), 0)
    ctl.setPose('carryBox')
    ctl.lookAtCamera()
  }, [ctl, model, rig, gltf, camera])

  useFrame((s, dt) => {
    // slow show-off sway
    ctl.yawTarget = Math.sin(s.clock.elapsedTime * 0.35) * 0.35
    ctl.update(dt)
    // box gripped by the middle of its sides (same as on stage), squared to the body
    _mid.copy(ctl.palm.L).add(ctl.palm.R).multiplyScalar(0.5)
    const g = boxGroup.current
    if (g) {
      g.position.copy(_mid).add(_down.set(0, -BALLOT_SIZE.h * 0.55, 0))
      g.quaternion.copy(ctl.root.quaternion)
    }
  })

  // framing: fit the character's height
  useEffect(() => {
    camera.position.set(0.15, rig.height * 0.6, rig.height * 2.1 + 0.3)
    camera.lookAt(0, rig.height * 0.5, 0)
  }, [camera, rig])

  return (
    <>
      <primitive object={ctl.root} />
      <group ref={boxGroup}>
        <BallotBox state={box} preview />
      </group>
    </>
  )
}

function PreviewScene() {
  const rig = rigById(useGameStore((s) => s.hostModel))
  return (
    <>
      <ambientLight intensity={0.25} />
      <spotLight position={[1.5, 3, 2.5]} angle={0.5} penumbra={0.6} intensity={40} color="#ffe3b0" castShadow />
      <spotLight position={[-1.5, 2.5, -2]} angle={0.6} penumbra={0.8} intensity={18} color="#8fb4ff" />
      <Environment resolution={32} frames={1} environmentIntensity={0.35}>
        <Lightformer intensity={2} color="#ffd9a0" position={[0, 3, 3]} scale={[4, 1, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <PreviewHost key={rig.id} rig={rig} />
      </Suspense>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={3} blur={2.5} far={1.5} />
    </>
  )
}

/** Small 3D stage in the list editor: the selected host holding the ballot box. */
export default function CharacterPreview() {
  return (
    <Canvas dpr={[1, 1.5]} shadows camera={{ fov: 30, near: 0.05, far: 20 }} gl={{ antialias: true, alpha: true }}>
      <PreviewScene />
    </Canvas>
  )
}
