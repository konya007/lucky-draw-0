import { Color, MeshPhysicalMaterial } from 'three'

/**
 * Candy-glossy ball: clearcoat physical material + a thin gold seam around the local equator
 * (hints that it splits in half). The seam is computed from object-space position so it
 * rotates with each instance.
 */
export function makeBallMaterial(opts: { instanced: boolean }) {
  const m = new MeshPhysicalMaterial({
    color: new Color(1, 1, 1),
    roughness: 0.15,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.1,
  })
  m.onBeforeCompile = (s) => {
    s.uniforms.uSeam = { value: new Color('#F2D28A') }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nattribute float aFlash;\nvarying float vFlash;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvObjPos = position;\n${opts.instanced ? 'vFlash = aFlash;' : 'vFlash = 0.0;'}`,
      )
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying float vFlash;\nuniform vec3 uSeam;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float seamY = abs(vObjPos.y) / length(vObjPos);
        float seam = 1.0 - smoothstep(0.018, 0.04, seamY);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSeam, seam);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vFlash * 2.5 + uSeam * seam * 0.08;`,
      )
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, seam);')
  }
  // distinct program cache key per variant
  m.customProgramCacheKey = () => (opts.instanced ? 'ball-inst' : 'ball-hero')
  return m
}
