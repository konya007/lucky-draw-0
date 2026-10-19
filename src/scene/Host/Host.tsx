import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { Box3, CanvasTexture, Color, DataTexture, Material, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, Object3D, RedFormat, SkinnedMesh, Texture, Vector3 } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { host } from './useHostAnimator'
import { useRig, useRigs, type HostRig, type PackRig } from './rigs'
import { useGameStore } from '../../store/useGameStore'
import { fixZeroNormals } from '../../lib/safeNormals'

import { director } from '../../director/Director'
import { useQuality } from '../../quality/qualityPresets'


/** 3-step toon ramp so the anime shading reacts to stage lights without looking plastic. */
function toonRamp() {
  const t = new DataTexture(new Uint8Array([60, 150, 225]), 3, 1, RedFormat)
  t.minFilter = t.magFilter = NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

/** Shared rim-light uniform (cool #8FB4FF back light), strength driven by preset. */
export const hostRim = { value: 0.0 }

function toToon(src: Material, ramp: Texture): MeshToonMaterial {
  const s = src as Material & { map?: Texture | null; color?: Color }
  const m = new MeshToonMaterial({
    map: s.map ?? null,
    color: s.color ? s.color.clone() : new Color(1, 1, 1),
    gradientMap: ramp,
    side: src.side,
    transparent: src.transparent,
    alphaTest: src.alphaTest,
  })
  m.name = src.name
  // unlit → toon: lift the darkest band so faces never fall to black on a dark stage
  m.emissive = new Color(0.07, 0.06, 0.055)
  m.emissiveMap = s.map ?? null
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = hostRim
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.56, 0.7, 1.0) * fres * uRim;`,
      )
  }
  return m
}

/**
 * Host character: the model picked in the list editor (rigs/). Each model loads in its own Suspense
 * boundary so switching never blanks the rest of the stage.
 */
export function Host() {
  const rig = useRig(useGameStore((s) => s.hostModel))
  // the packs are small (≈0.5 MB each): preload them all so switching in the editor is instant
  const rigs = useRigs((s) => s.rigs)
  useEffect(() => rigs.forEach((r) => useGLTF.preload(r.url, false, true)), [rigs])
  return (
    <>
      {/* host.root is one shared object for every character: mounted once here, never re-keyed.
          (Re-mounting the same object in a new <primitive> made r3f wipe its internal state → crash.) */}
      <primitive
        object={host.root}
        onPointerDown={(e: { stopPropagation: () => void }) => {
          e.stopPropagation()
          director.hostTap()
        }}
      />
      <Suspense fallback={null}>
        <HostModel key={rig.id} rig={rig} />
      </Suspense>
      <HostShadow />
    </>
  )
}

/**
 * Clone a character GLB and make it stage-ready: materials (toon for unlit exports), safe normals,
 * height normalised to the rig, feet on the floor, toes facing +Z, centred. Used by the stage host
 * and the editor preview.
 */
export function prepareHostModel(source: Object3D, rig: HostRig): Object3D {
  const scene = SkeletonUtils.clone(source) as Object3D
  const ramp = toonRamp()
  const cache = new Map<Material, MeshToonMaterial>()
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    if (rig.materials !== 'toon') {
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()
      fixZeroNormals(mesh.geometry, 0, 1, 0)
      return // keep the model's own lit (PBR) materials
    }
    // unlit exports may ship without normals; lit toon shading needs them
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()
    // degenerate vertices can carry zero normals → NaN in the toon/rim shading → black flicker
    fixZeroNormals(mesh.geometry, 0, 1, 0)
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const conv = mats.map((mm) => {
      if (!cache.has(mm)) cache.set(mm, toToon(mm, ramp))
      return cache.get(mm)!
    })
    mesh.material = Array.isArray(mesh.material) ? conv : conv[0]
  })
  // normalize height (skinned bounds) and stand on the floor
  scene.updateMatrixWorld(true)
  // bone matrices are only computed at render time; skinned bounds need them now
  scene.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && (o as SkinnedMesh).skeleton.update())
  const box = new Box3().setFromObject(scene, true)
  const h = box.max.y - box.min.y
  const s = h > 0.01 ? rig.height / h : 1
  const wrap = new Object3D()
  wrap.name = 'HostModel'
  wrap.add(scene)
  wrap.scale.setScalar(s)
  wrap.position.y = -box.min.y * s
  wrap.updateMatrixWorld(true)
  // facing: turn the model so its toes point +Z (exports face +Z, -Z or sideways), then centre it
  let ankle: Object3D | null = null
  let toe: Object3D | null = null
  scene.traverse((o) => {
    const b = rig.baseName(o.name)
    if (b === rig.bones.lAnkle) ankle = o
    if (b === rig.bones.lToe) toe = o
  })
  if (ankle && toe) {
    const a = (ankle as Object3D).getWorldPosition(new Vector3())
    const t = (toe as Object3D).getWorldPosition(new Vector3())
    wrap.rotation.y = -Math.atan2(t.x - a.x, t.z - a.z)
    wrap.updateMatrixWorld(true)
  }
  // centre on the bounds, or on the hips when a big tail/cape would drag the bounds' centre backwards
  let hips: Object3D | null = null
  if (rig.centreOn === 'hips') scene.traverse((o) => void (!hips && rig.baseName(o.name) === rig.bones.hips && (hips = o)))
  const c = hips ? (hips as Object3D).getWorldPosition(new Vector3()) : new Box3().setFromObject(wrap, true).getCenter(new Vector3())
  wrap.position.x -= c.x
  wrap.position.z -= c.z
  wrap.updateMatrixWorld(true)
  return wrap
}

/** Loads one rig's GLB, normalizes scale/facing, adapts its materials and binds the animator. */
function HostModel({ rig }: { rig: PackRig }) {
  const gltf = useGLTF(rig.url, false, true)
  const camera = useThree((s) => s.camera)
  const preset = useQuality()

  const model = useMemo(() => prepareHostModel(gltf.scene, rig), [gltf, rig])

  useEffect(() => {
    host.bind(model, rig)
    // the model's own clips (fox): Idle/Walk drive the body
    if (rig.useClips && gltf.animations.length) host.setClips(gltf.animations, model)
    host.camera = camera
    if (import.meta.env.DEV) logRig(model)
    // optional extra clips shipped in the pack (files.animations in info.json)
    let cancelled = false
    if (rig.urls.animations) {
      const loader = new GLTFLoader()
      loader.setMeshoptDecoder(MeshoptDecoder)
      loader.load(rig.urls.animations, (g) => !cancelled && host.setClips(g.animations, model))
    }
    return () => {
      cancelled = true
    }
  }, [model, camera, rig])

  useEffect(() => {
    model.traverse((o) => {
      const mesh = o as SkinnedMesh
      if (mesh.isMesh) {
        mesh.castShadow = preset.hostShadow
        mesh.receiveShadow = preset.hostShadow
      }
    })
    hostRim.value = preset.hostRim ? 0.2 : 0
    host.skeletonHz = preset.skeletonHz
    host.fullIK = preset.fullIK
  }, [model, preset])

  useFrame((_, dt) => host.update(dt))

  // the model is placed inside host.root by host.bind(); nothing to render here
  return null
}

/** Soft radial gradient (black → transparent) for the contact shadow. */
function blobTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(0,0,0,0.85)')
  grd.addColorStop(0.5, 'rgba(0,0,0,0.45)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

const _hip = new Vector3()

/**
 * Contact shadow under the host (one transparent quad, every preset). The key light's real shadow
 * falls behind her into the dark, so this is what grounds her on the floor; it tightens and fades
 * a little when she hops.
 */
function HostShadow() {
  const mesh = useRef<Mesh>(null)
  const mat = useMemo(() => new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    host.hipsWorld(_hip)
    const lift = Math.max(0, _hip.y - (host.metrics?.hipY ?? _hip.y)) // > 0 while airborne
    m.position.set(_hip.x, 0.004, _hip.z)
    m.rotation.set(-Math.PI / 2, 0, host.yaw)
    const k = 1 - Math.min(0.35, lift * 4)
    m.scale.set(0.62 * k, 0.48 * k, 1)
    mat.opacity = 0.75 * k
  })
  return (
    <mesh ref={mesh} material={mat} raycast={() => null} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

/** Dev helper: print what the rig contains (mirrors HostRig.md). */
function logRig(model: Object3D) {
  const bones: string[] = []
  let tris = 0
  model.traverse((o) => {
    if ((o as { isBone?: boolean }).isBone) bones.push(o.name)
    const m = o as Mesh
    if (m.isMesh) tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3
  })
  console.info(`[host] bones=${bones.length} tris=${Math.round(tris)} (procedural animator, see src/scene/Host/HostRig.md)`)
}

