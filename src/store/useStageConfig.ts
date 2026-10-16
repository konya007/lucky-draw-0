import { create } from 'zustand'
import { assetUrl } from '../lib/assetUrl'

type V3 = [number, number, number]

export interface StageConfig {
  backstage: {
    image: string | null
    width: number
    height: number
    position: V3
    brightness: number
    tint: string
    fit: 'cover' | 'stretch'
  }
  propLights: {
    enabled: boolean
    color: string
    beamStrength: number
    poolStrength: number
    items: { name: string; target: V3; from: V3; radius: number }[]
  }
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  backstage: { image: null, width: 12, height: 6.5, position: [0, 3, -3.15], brightness: 0.35, tint: '#ffffff', fit: 'cover' },
  propLights: { enabled: true, color: '#FFE3B0', beamStrength: 0.05, poolStrength: 0.35, items: [] },
}

/** public/stage-config.json, merged over defaults (missing keys fall back). */
export const useStageConfig = create<StageConfig>(() => DEFAULT_STAGE_CONFIG)

export async function loadStageConfig() {
  try {
    const res = await fetch(assetUrl('stage-config.json'), { cache: 'no-cache' })
    const j = (await res.json()) as Partial<StageConfig>
    useStageConfig.setState({
      backstage: { ...DEFAULT_STAGE_CONFIG.backstage, ...(j.backstage ?? {}) },
      propLights: { ...DEFAULT_STAGE_CONFIG.propLights, ...(j.propLights ?? {}) },
    })
  } catch {
    /* keep defaults */
  }
}
