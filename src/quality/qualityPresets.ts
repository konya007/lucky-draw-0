import type { QualityLevel } from '../store/useSettingsStore'

export interface QualityPreset {
  dpr: [number, number]
  /** 0 = static contact shadow only, else shadow map size */
  shadowSize: number
  followShadow: boolean
  softShadows: boolean
  /** 0 = fake env reflection, else MeshReflectorMaterial resolution */
  reflectorRes: number
  cones: 'off' | 'main' | 'all'
  dustInCones: boolean
  bloom: boolean
  dof: boolean
  chroma: boolean
  grain: boolean
  motionBlur: boolean
  dynamicBalls: number
  flyLights: number
  confetti: number
  hostShadow: boolean
  hostRim: boolean
  fullIK: boolean
  /** Skeleton update rate when host is idle/far (Hz, 0 = every frame) */
  skeletonHz: number
  fogLayers: number
  msaa: number
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    dpr: [0.75, 1], shadowSize: 0, followShadow: false, softShadows: false, reflectorRes: 0,
    cones: 'off', dustInCones: false, bloom: false, dof: false, chroma: false, grain: false, motionBlur: false,
    dynamicBalls: 40, flyLights: 0, confetti: 120, hostShadow: false, hostRim: false, fullIK: false, skeletonHz: 30,
    fogLayers: 0, msaa: 0,
  },
  medium: {
    dpr: [1, 1.25], shadowSize: 1024, followShadow: false, softShadows: false, reflectorRes: 0,
    cones: 'main', dustInCones: false, bloom: true, dof: false, chroma: false, grain: false, motionBlur: false,
    dynamicBalls: 80, flyLights: 0, confetti: 200, hostShadow: true, hostRim: false, fullIK: false, skeletonHz: 0,
    fogLayers: 0, msaa: 0,
  },
  high: {
    dpr: [1, 1.5], shadowSize: 1024, followShadow: false, softShadows: false, reflectorRes: 0,
    cones: 'all', dustInCones: false, bloom: true, dof: true, chroma: true, grain: false, motionBlur: false,
    dynamicBalls: 120, flyLights: 0, confetti: 300, hostShadow: true, hostRim: true, fullIK: false, skeletonHz: 0,
    fogLayers: 1, msaa: 0,
  },
  ultra: {
    dpr: [1, 2], shadowSize: 2048, followShadow: true, softShadows: true, reflectorRes: 512,
    cones: 'all', dustInCones: true, bloom: true, dof: true, chroma: true, grain: true, motionBlur: true,
    dynamicBalls: 200, flyLights: 0, confetti: 400, hostShadow: true, hostRim: true, fullIK: true, skeletonHz: 0,
    fogLayers: 3, msaa: 2,
  },
}
