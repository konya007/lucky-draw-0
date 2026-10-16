import { lazy, Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, Environment, Html, Lightformer, PerformanceMonitor, useProgress } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { PCFSoftShadowMap } from 'three'
import { Stage } from '../scene/Stage'
import { Lights } from '../scene/Lights'
import { Cage } from '../scene/Cage/Cage'
import { BallPool } from '../scene/Balls/BallPool'
import { HeroBall } from '../scene/Balls/HeroBall'
import { Host } from '../scene/Host/Host'
import { Ticket } from '../scene/Props/Ticket'
import { TicketBox } from '../scene/Props/TicketBox'
import { SettingsRadio } from '../scene/Props/SettingsRadio'
import { ListClipboard } from '../scene/Props/ListClipboard'
import { Effects } from '../scene/Effects'
import { Confetti } from '../scene/VFX/Confetti'
import { BallTrail } from '../scene/VFX/BallTrail'
import { DustMotes } from '../scene/VFX/DustMotes'
import { FloorFog } from '../scene/VFX/FloorFog'
import { CameraDirector } from '../director/CameraDirector'
import { director } from '../director/Director'
import { useGameStore } from '../store/useGameStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { QUALITY } from '../quality/qualityPresets'
import { requestLevel, useAutoQualityFlush } from '../quality/useAutoQuality'
import { CRANK } from '../scene/layout'

const Perf = lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')

/** Per-frame glue: Director tick + camera handle for screen projection. */
function DirectorTicker() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    director.camera = camera
  }, [camera])
  useFrame((s, dt) => director.tick(Math.min(dt, 0.05), s.clock.elapsedTime))
  return null
}

/** Compile every shader once everything is loaded, so the first spin/opening never hitches. */
function Precompile() {
  const { gl, scene, camera } = useThree()
  const { active, progress } = useProgress()
  const done = useRef(false)
  useEffect(() => {
    useGameStore.getState().set({ loadProgress: Math.min(99, progress) })
  }, [progress])
  useEffect(() => {
    if (active || done.current) return
    done.current = true
    // let one frame render first so materials exist, then compile and announce readiness
    requestAnimationFrame(() => {
      try {
        gl.compile(scene, camera)
      } finally {
        useGameStore.getState().set({ sceneReady: true, loadProgress: 100 })
      }
    })
  }, [active, gl, scene, camera])
  return null
}

function CrankHint() {
  const hint = useGameStore((s) => s.hint)
  return (
    <Html position={[CRANK.hub.x - 0.05, CRANK.hub.y + 0.5, 0.15]} center pointerEvents="none" zIndexRange={[5, 0]}>
      <div className={`whitespace-nowrap font-serif text-sm tracking-[0.3em] text-paper/70 italic transition-opacity duration-1000 select-none ${hint ? 'opacity-100' : 'opacity-0'}`}>Kéo cần để quay</div>
    </Html>
  )
}

let lastMiss = 0
let qualityLocked = false

export default function Scene({ paused }: { paused: boolean }) {
  const level = useSettingsStore((s) => s.level)
  const quality = useSettingsStore((s) => s.quality)
  // the editor covers the stage: render the curtain behind it at low resolution
  const editing = useGameStore((s) => s.phase === 'EDITING')
  const q = QUALITY[level]
  useAutoQualityFlush()

  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      dpr={editing ? 0.5 : q.dpr}
      frameloop={paused ? 'never' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ position: [0, 1.85, 4.6], fov: 35 }}
      onPointerMissed={() => {
        const now = performance.now()
        director.skip(now - lastMiss < 320)
        lastMiss = now
      }}
    >
      <color attach="background" args={['#07070A']} />
      <fog attach="fog" args={['#07070A', 10, 24]} />
      {quality === 'auto' && (
        <PerformanceMonitor
          ms={200}
          iterations={10}
          bounds={() => [50, 58]}
          flipflops={3}
          onDecline={() => !qualityLocked && requestLevel(-1)}
          onIncline={() => !qualityLocked && requestLevel(1)}
          onFallback={() => (qualityLocked = true)}
        >
          <AdaptiveDpr />
        </PerformanceMonitor>
      )}
      <Suspense fallback={null}>
        {/* dark studio environment: only so brass and clearcoat have something to reflect */}
        <Environment resolution={64} frames={1} environmentIntensity={0.3}>
          <Lightformer intensity={2} color="#ffd9a0" position={[0, 4, 3]} scale={[4, 1, 1]} />
          <Lightformer intensity={0.6} color="#8fb4ff" position={[-3, 2, -3]} scale={[2, 2, 1]} />
          <Lightformer intensity={0.8} color="#ff9a5a" position={[3, 0.5, 3]} scale={[3, 0.3, 1]} />
        </Environment>
        <Physics timeStep={1 / 60} paused={paused} gravity={[0, -9.81, 0]}>
          <Cage />
        </Physics>
        <BallPool />
        <HeroBall />
        <Stage />
        <Lights />
        <Host />
        <Ticket />
        <TicketBox />
        <SettingsRadio />
        <ListClipboard />
        <Confetti />
        <BallTrail />
        {q.dustInCones && <DustMotes />}
        {q.fogLayers > 0 && <FloorFog layers={q.fogLayers} />}
        <CrankHint />
        <Effects />
        <Precompile />
      </Suspense>
      <CameraDirector />
      <DirectorTicker />
      {debug && (
        <Suspense fallback={null}>
          <Perf position="top-left" />
        </Suspense>
      )}
    </Canvas>
  )
}
