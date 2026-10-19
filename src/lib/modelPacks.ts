import { strToU8, unzipSync, zipSync } from 'fflate'
import { tx } from './mediaStore'
import { packUrls, PackRig, useRigs } from '../scene/Host/rigs'
import { validateInfo, type ModelInfo } from '../scene/Host/rigs/PackRig'
import templateInfo from '../assets/_template/info.json'
import templateReadme from '../assets/_template/README.md?raw'
import packsGuide from '../assets/README.md?raw'

/**
 * Model packs uploaded as .zip (same layout as a folder in src/assets: info.json + host.glb +
 * optional voice/…). Kept in IndexedDB under `pack:<id>` and registered at startup. Uploaded packs
 * are data only: a rig.ts inside a zip is ignored (no code runs from uploads).
 */
interface PackRecord {
  zip: Blob
  name: string
  at: number
}

const KEY = (id: string) => `pack:${id}`
const MIME: Record<string, string> = { glb: 'model/gltf-binary', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' }
/** blob: URLs per uploaded pack, revoked when it is replaced or removed */
const urlsOf = new Map<string, string[]>()

/** Unzip a pack and build its rig. The pack root is the folder that holds info.json. */
function rigFromZip(bytes: Uint8Array): PackRig {
  const entries = unzipSync(bytes)
  const infoPath = Object.keys(entries)
    .filter((p) => /(^|\/)info\.json$/.test(p) && !p.startsWith('__MACOSX'))
    .sort((a, b) => a.length - b.length)[0]
  if (!infoPath) throw new Error('The zip has no info.json')
  const root = infoPath.slice(0, -'info.json'.length)
  let info: ModelInfo
  try {
    info = JSON.parse(new TextDecoder().decode(entries[infoPath]))
  } catch {
    throw new Error('info.json could not be read (invalid JSON)')
  }
  validateInfo(info)
  const made: string[] = []
  const urls = packUrls(info, (p) => {
    const data = entries[root + p.replace(/^\.?\//, '')]
    if (!data) return undefined
    const ext = p.split('.').pop()!.toLowerCase()
    const u = URL.createObjectURL(new Blob([data], { type: MIME[ext] ?? 'application/octet-stream' }))
    made.push(u)
    return u
  })
  const rig = new PackRig(info, urls, 'upload')
  for (const u of urlsOf.get(info.id) ?? []) URL.revokeObjectURL(u)
  urlsOf.set(info.id, made)
  return rig
}

/** Validate, save and register an uploaded pack. Returns its rig (throws a readable error). */
export async function installPack(file: File): Promise<PackRig> {
  const rig = rigFromZip(new Uint8Array(await file.arrayBuffer()))
  if (useRigs.getState().rigs.some((r) => r.id === rig.id && r.origin === 'builtin')) {
    throw new Error(`Id "${rig.id}" is taken by a built-in character; change "id" in info.json`)
  }
  await tx('readwrite', (s) => s.put({ zip: file, name: file.name, at: Date.now() } satisfies PackRecord, KEY(rig.id)))
  useRigs.getState().add(rig)
  return rig
}

export async function removePack(id: string) {
  await tx('readwrite', (s) => s.delete(KEY(id)))
  for (const u of urlsOf.get(id) ?? []) URL.revokeObjectURL(u)
  urlsOf.delete(id)
  useRigs.getState().remove(id)
}

/** Register every saved pack (call once at startup). */
export async function loadPacks() {
  try {
    const keys = (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).filter((k) => typeof k === 'string' && k.startsWith('pack:')) as string[]
    for (const k of keys) {
      const rec = await tx<PackRecord | undefined>('readonly', (s) => s.get(k))
      if (!rec) continue
      try {
        useRigs.getState().add(rigFromZip(new Uint8Array(await rec.zip.arrayBuffer())))
      } catch (e) {
        console.warn(`[models] ${rec.name}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    console.warn('[models] IndexedDB unavailable', e)
  }
}

/** A starter zip: template info.json + README (the user adds host.glb). */
export function downloadTemplate() {
  const zip = zipSync({
    'my-model/info.json': strToU8(JSON.stringify(templateInfo, null, 2)),
    'my-model/README.md': strToU8(templateReadme),
    'my-model/HUONG-DAN.md': strToU8(packsGuide),
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  a.download = 'grand-draw-model-template.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
