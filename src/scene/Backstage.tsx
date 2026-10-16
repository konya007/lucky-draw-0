import { useEffect, useMemo, useState } from 'react'
import { Color, MeshBasicMaterial, SRGBColorSpace, Texture, TextureLoader } from 'three'
import { useStageConfig } from '../store/useStageConfig'

/**
 * The wall behind the stage. With no image it is a near-black wall; with `backstage.image`
 * (public/stage-config.json) it shows the photo, unlit (MeshBasic = cheapest), dimmed by `brightness`.
 */
export function Backstage() {
  const cfg = useStageConfig((s) => s.backstage)
  const [tex, setTex] = useState<Texture | null>(null)

  useEffect(() => {
    if (!cfg.image) {
      setTex(null)
      return
    }
    let alive = true
    new TextureLoader().load(
      cfg.image,
      (t) => {
        if (!alive) return t.dispose()
        t.colorSpace = SRGBColorSpace
        t.anisotropy = 4
        setTex(t)
      },
      undefined,
      () => console.warn('[backstage] could not load', cfg.image),
    )
    return () => {
      alive = false
    }
  }, [cfg.image])

  useEffect(() => () => tex?.dispose(), [tex])

  const mat = useMemo(() => {
    const m = new MeshBasicMaterial({ color: new Color('#0c0a0b') })
    if (tex) {
      m.map = tex
      m.color = new Color(cfg.tint).multiplyScalar(cfg.brightness)
      // "cover": crop the image to the wall's aspect instead of stretching it
      const img = tex.image as { width: number; height: number } | undefined
      if (cfg.fit === 'cover' && img?.width && img.height) {
        const wallAspect = cfg.width / cfg.height
        const imgAspect = img.width / img.height
        if (imgAspect > wallAspect) {
          tex.repeat.set(wallAspect / imgAspect, 1)
          tex.offset.set((1 - tex.repeat.x) / 2, 0)
        } else {
          tex.repeat.set(1, imgAspect / wallAspect)
          tex.offset.set(0, (1 - tex.repeat.y) / 2)
        }
      }
    }
    return m
  }, [tex, cfg.tint, cfg.brightness, cfg.fit, cfg.width, cfg.height])

  return (
    <mesh position={cfg.position} material={mat} raycast={() => null}>
      <planeGeometry args={[cfg.width, cfg.height]} />
    </mesh>
  )
}
