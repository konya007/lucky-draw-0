import { AnimeGirlRig } from './AnimeGirlRig'
import { MrBeastRig } from './MrBeastRig'
import { FoxRig } from './FoxRig'
import type { HostRig } from './HostRig'

/** All selectable host characters (first = default). Add new models here. */
export const RIGS: HostRig[] = [new FoxRig(), new AnimeGirlRig(), new MrBeastRig()]

export function rigById(id: string | null | undefined): HostRig {
  return RIGS.find((r) => r.id === id) ?? RIGS[0]
}

export type { HostRig } from './HostRig'
