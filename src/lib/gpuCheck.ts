/** What the browser gives the game: hardware WebGL 2 (required) and WebGPU (optional, future renderer). */
export interface GpuReport {
  webgl2: boolean
  /** WebGL runs on a real GPU, not a software rasterizer (SwiftShader, llvmpipe, WARP…) */
  hardware: boolean
  renderer: string
  webgpu: 'yes' | 'fallback' | 'no'
  browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'other'
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|warp|mesa offscreen/i

function detectBrowser(): GpuReport['browser'] {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Chrome\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}

export async function checkGpu(): Promise<GpuReport> {
  let webgl2 = false
  let hardware = false
  let renderer = 'unknown'
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (gl) {
      webgl2 = true
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
      // a context that refuses to start with "major performance caveat" means software rendering
      const strict = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })
      hardware = !!strict && !SOFTWARE.test(renderer)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      strict?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    /* no WebGL */
  }
  let webgpu: GpuReport['webgpu'] = 'no'
  try {
    type Adapter = { info?: { isFallbackAdapter?: boolean }; isFallbackAdapter?: boolean }
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    const adapter = (gpu ? await gpu.requestAdapter() : null) as Adapter | null
    if (adapter) webgpu = adapter.info?.isFallbackAdapter || adapter.isFallbackAdapter ? 'fallback' : 'yes'
  } catch {
    /* no WebGPU */
  }
  return { webgl2, hardware, renderer, webgpu, browser: detectBrowser() }
}
