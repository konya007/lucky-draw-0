import { create } from 'zustand'
import { PackRig, type ModelInfo, type PackUrls, type RigHooks } from './PackRig'

/**
 * Model packs shipped with the game: every folder in src/assets/ (except `_template` and other
 * `_`-prefixed folders) that has an info.json. Vite resolves the files to hashed URLs at build time.
 */
const infos = import.meta.glob<ModelInfo>('../../../assets/*/info.json', { eager: true, import: 'default' })
const files = import.meta.glob<string>(['../../../assets/*/*.{glb,gltf,png,webp,jpg,jpeg}', '../../../assets/*/voice/*.{mp3,ogg,wav,m4a}'], { eager: true, query: '?url', import: 'default' })
const hooks = import.meta.glob<RigHooks>('../../../assets/*/rig.ts', { eager: true, import: 'default' })

/** Resolve a pack's info.json file references with a lookup (Vite URLs or blob URLs from a zip). */
export function packUrls(info: ModelInfo, file: (path: string) => string | undefined): PackUrls {
  const model = file(info.files?.model ?? 'host.glb')
  if (!model) throw new Error(`Missing model file "${info.files?.model ?? 'host.glb'}"`)
  const voices: PackUrls['voices'] = {}
  for (const [k, p] of Object.entries(info.voices ?? {})) {
    const u = p ? file(p) : undefined
    if (u) voices[k as keyof PackUrls['voices']] = u
  }
  return {
    model,
    animations: info.files?.animations ? file(info.files.animations) : undefined,
    thumbnail: info.files?.thumbnail ? file(info.files.thumbnail) : undefined,
    voices,
  }
}

function loadBuiltins(): PackRig[] {
  const out: PackRig[] = []
  for (const [path, info] of Object.entries(infos)) {
    const dir = path.slice(0, -'info.json'.length)
    if (/\/_[^/]*\/$/.test(dir)) continue
    try {
      const urls = packUrls(info, (p) => files[dir + p.replace(/^\.?\//, '')])
      out.push(new PackRig(info, urls, 'builtin', hooks[dir + 'rig.ts']))
    } catch (e) {
      console.error(`[models] ${dir}: ${(e as Error).message}`)
    }
  }
  return out
}

const byOrder = (a: PackRig, b: PackRig) => a.order - b.order || a.label.localeCompare(b.label)

interface RigRegistry {
  rigs: PackRig[]
  /** add or replace (same id) a pack */
  add: (rig: PackRig) => void
  remove: (id: string) => void
}

/** Every selectable host character (built-in first, then uploaded packs). */
export const useRigs = create<RigRegistry>((set) => ({
  rigs: loadBuiltins().sort(byOrder),
  add: (rig) => set((s) => ({ rigs: [...s.rigs.filter((r) => r.id !== rig.id), rig].sort(byOrder) })),
  remove: (id) => set((s) => ({ rigs: s.rigs.filter((r) => r.id !== id || r.origin === 'builtin') })),
}))

/** The default host (lowest `order`). */
export const defaultRig = () => useRigs.getState().rigs[0]

export function rigById(id: string | null | undefined): PackRig {
  const rigs = useRigs.getState().rigs
  return rigs.find((r) => r.id === id) ?? rigs[0]
}

/** React: the rig for an id, re-rendering when packs are added/removed. */
export function useRig(id: string | null | undefined): PackRig {
  const rigs = useRigs((s) => s.rigs)
  return rigs.find((r) => r.id === id) ?? rigs[0]
}

export type { HostRig } from './HostRig'
export { PackRig } from './PackRig'
export type { ModelInfo } from './PackRig'
