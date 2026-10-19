import { useEffect, useState } from 'react'
import { checkGpu, type GpuReport } from '../lib/gpuCheck'

const FLAGS: Record<GpuReport['browser'], { intro: string; steps: string[] }> = {
  chrome: {
    intro: 'Chrome',
    steps: [
      'Settings → System → turn on "Use graphics acceleration when available", relaunch.',
      'Open chrome://flags and enable #ignore-gpu-blocklist (Override software rendering list).',
      'Optional: #enable-unsafe-webgpu (WebGPU), #enable-gpu-rasterization. Then press Relaunch.',
      'Laptop with two GPUs (Windows): Settings → System → Display → Graphics → add Chrome → High performance.',
    ],
  },
  edge: {
    intro: 'Edge',
    steps: [
      'Settings → System and performance → turn on "Use graphics acceleration when available", restart.',
      'Open edge://flags and enable #ignore-gpu-blocklist (Override software rendering list).',
      'Optional: #enable-unsafe-webgpu (WebGPU), #enable-gpu-rasterization. Then restart.',
      'Laptop with two GPUs (Windows): Settings → System → Display → Graphics → add Edge → High performance.',
    ],
  },
  firefox: {
    intro: 'Firefox',
    steps: [
      'Settings → General → Performance → untick "Use recommended performance settings" → tick "Use hardware acceleration when available".',
      'Open about:config and set webgl.force-enabled = true and gfx.webrender.all = true.',
      'Optional: dom.webgpu.enabled = true (WebGPU). Restart Firefox.',
      'Laptop with two GPUs (Windows): Settings → System → Display → Graphics → add Firefox → High performance.',
    ],
  },
  safari: {
    intro: 'Safari',
    steps: ['Safari uses the GPU by default. For WebGPU on older versions: Develop → Feature Flags → enable WebGPU.', 'If the game is slow, try Chrome or Edge.'],
  },
  other: {
    intro: 'Your browser',
    steps: ['Turn on hardware / graphics acceleration in the browser settings.', 'Chrome or Edge is recommended (chrome://flags → #ignore-gpu-blocklist).'],
  },
}

/** Shows whether the game gets a real GPU (WebGL 2) and WebGPU, with per-browser steps to enable them. */
export function GpuCheck() {
  const [r, setR] = useState<GpuReport | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    void checkGpu().then((rep) => {
      setR(rep)
      setOpen(!rep.hardware)
    })
  }, [])
  if (!r) return <div className="text-[12px] text-muted">Checking the graphics card…</div>

  const row = (ok: boolean | 'warn', label: string, detail: string) => (
    <div className="flex items-start gap-2 text-[13px]">
      <span className={ok === true ? 'text-emerald-300' : ok === 'warn' ? 'text-amber-300' : 'text-red-300'}>{ok === true ? '✔' : ok === 'warn' ? '!' : '✖'}</span>
      <div className="min-w-0">
        <span className="text-paper">{label}</span> <span className="text-muted">{detail}</span>
      </div>
    </div>
  )
  const guide = FLAGS[r.browser]

  return (
    <div className="flex flex-col gap-2">
      {row(r.webgl2 && r.hardware ? true : false, 'GPU acceleration', r.webgl2 ? (r.hardware ? `· ${r.renderer}` : '· software rendering, the show will be slow') : '· WebGL 2 is not available')}
      {row(r.webgpu === 'yes' ? true : 'warn', 'WebGPU', r.webgpu === 'yes' ? '· available' : r.webgpu === 'fallback' ? '· software fallback only' : '· off (optional, not needed today)')}
      <button className="self-start text-[12px] text-brass underline-offset-2 hover:text-brass-hi hover:underline" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} How to enable it in {guide.intro}
      </button>
      {open && (
        <ol className="ml-5 list-decimal space-y-1 text-[12px] leading-relaxed text-paper/75">
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>Reload this page to check again.</li>
        </ol>
      )}
    </div>
  )
}
