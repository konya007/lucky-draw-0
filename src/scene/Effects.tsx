import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, SMAA, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, Effect, ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect, type DepthOfFieldEffect } from 'postprocessing'
import { Uniform, Vector2, Vector3 } from 'three'
import { fx } from '../director/channels'
import { camState } from '../director/CameraDirector'
import { useSettingsStore } from '../store/useSettingsStore'
import { QUALITY } from '../quality/qualityPresets'

/** Pre-tonemap: exposure (animated, in stops-ish multiplier) + gentle teal/orange split toning. */
class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float uExposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 tint = mix(vec3(0.93, 1.0, 1.05), vec3(1.05, 1.0, 0.93), smoothstep(0.02, 0.5, l));
        outputColor = vec4(c * tint, inputColor.a);
      }`,
      { uniforms: new Map([['uExposure', new Uniform(1)]]) },
    )
  }
}

/** Post-tonemap: vignette, warm white flash, 2.39:1 letterbox bars sliding in/out. */
class FinishEffect extends Effect {
  constructor() {
    super(
      'FinishEffect',
      /* glsl */ `
      uniform float uVig; uniform float uFlash; uniform float uBox;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
        float v = smoothstep(1.05, 0.25, length(d));
        c *= mix(1.0, v, uVig);
        c = mix(c, vec3(1.0, 0.95, 0.86), uFlash);
        float bar = max(0.0, (1.0 - aspect / 2.39) * 0.5) * uBox;
        float edge = 0.0015;
        float m = smoothstep(bar - edge, bar, uv.y) * smoothstep(bar - edge, bar, 1.0 - uv.y);
        outputColor = vec4(c * m, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map([
          ['uVig', new Uniform(0.55)],
          ['uFlash', new Uniform(0)],
          ['uBox', new Uniform(0)],
        ]),
      },
    )
  }
}

const Grade = forwardRef<GradeEffect>(function Grade(_, ref) {
  const e = useMemo(() => new GradeEffect(), [])
  return <primitive ref={ref} object={e} dispose={null} />
})
const Finish = forwardRef<FinishEffect>(function Finish(_, ref) {
  const e = useMemo(() => new FinishEffect(), [])
  return <primitive ref={ref} object={e} dispose={null} />
})

/** One EffectComposer; passes depend on the quality preset, values are animated channels. */
export function Effects() {
  const level = useSettingsStore((s) => s.level)
  const q = QUALITY[level]
  const grade = useRef<GradeEffect>(null)
  const finish = useRef<FinishEffect>(null)
  const bloom = useRef<BloomEffect>(null)
  const chroma = useRef<ChromaticAberrationEffect>(null)
  const dof = useRef<DepthOfFieldEffect>(null)
  const focus = useMemo(() => new Vector3(0, 1, 0), [])
  const caOffset = useMemo(() => new Vector2(), [])

  useFrame(() => {
    if (grade.current) grade.current.uniforms.get('uExposure')!.value = fx.exposure
    const f = finish.current?.uniforms
    if (f) {
      f.get('uVig')!.value = fx.vignette
      f.get('uFlash')!.value = fx.flash
      f.get('uBox')!.value = fx.letterbox
    }
    if (bloom.current) bloom.current.intensity = fx.bloom
    if (chroma.current) chroma.current.offset.set(fx.chroma, fx.chroma * 0.6)
    if (dof.current) {
      focus.copy(camState.focus)
      dof.current.target = focus
      dof.current.bokehScale = camState.bokeh
    }
  })

  return (
    <EffectComposer multisampling={q.msaa} enableNormalPass={false}>
      <>{q.dof && <DepthOfField ref={dof} target={focus} worldFocusRange={0.6} bokehScale={2} />}</>
      <>{q.bloom && <Bloom ref={bloom as never} mipmapBlur levels={5} luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={0.6} radius={0.55} />}</>
      <>{q.chroma && <ChromaticAberration ref={chroma as never} offset={caOffset} radialModulation modulationOffset={0.35} />}</>
      <Grade ref={grade} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Finish ref={finish} />
      <>{q.grain && <Noise premultiply opacity={0.35} />}</>
      {/* cheap edge AA when hardware MSAA is off */}
      <>{q.msaa === 0 && level !== 'low' && <SMAA />}</>
    </EffectComposer>
  )
}
