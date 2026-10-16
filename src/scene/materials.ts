import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { COLORS } from './layout'

/** One brass material shared by every brass part (1 shader, batched state). */
export const brass = new MeshStandardMaterial({
  color: new Color(COLORS.brass),
  metalness: 1,
  roughness: 0.3,
  envMapIntensity: 1,
})

/** Brass variant with an animated emissive used for "touch me" pulses. */
export const brassGlow = brass.clone()
brassGlow.emissive = new Color(COLORS.brassHi)
brassGlow.emissiveIntensity = 0

export const blackWood = new MeshPhysicalMaterial({
  color: '#120c09',
  roughness: 0.35,
  clearcoat: 0.6,
  clearcoatRoughness: 0.3,
})

export const darkWood = new MeshStandardMaterial({ color: '#1a120d', roughness: 0.55, metalness: 0 })

export const velvet = new MeshPhysicalMaterial({
  color: COLORS.velvet,
  roughness: 0.9,
  sheen: 1,
  sheenRoughness: 0.4,
  sheenColor: new Color(COLORS.velvetSheen),
  side: DoubleSide,
})

export const matteBlack = new MeshStandardMaterial({ color: '#0a0a0d', roughness: 0.8 })
