import { useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { useRig, useRigs } from '../scene/Host/rigs'
import { downloadTemplate, installPack, removePack } from '../lib/modelPacks'
import { audio } from '../audio/audioManager'

/**
 * Character picker (dropdown) + model-pack tools: upload a .zip, remove an uploaded pack, download
 * the template. Used in Settings and in the first-visit onboarding.
 */
export function ModelPacks({ hint = true }: { hint?: boolean }) {
  const rigs = useRigs((s) => s.rigs)
  const current = useRig(useGameStore((s) => s.hostModel))
  const set = useGameStore((s) => s.set)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const onPick = async (f: File | undefined) => {
    if (!f) return
    setMsg(null)
    setBusy(true)
    try {
      const rig = await installPack(f)
      set({ hostModel: rig.id })
      audio.play('tick', { vol: 0.5 })
      setMsg({ ok: true, text: `Added "${rig.label}".` })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'Could not read the pack.' })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const builtin = rigs.filter((r) => r.origin === 'builtin')
  const uploaded = rigs.filter((r) => r.origin === 'upload')

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        <select
          value={current.id}
          onChange={(e) => {
            set({ hostModel: e.target.value })
            audio.play('tick', { vol: 0.4 })
          }}
          className="min-w-0 flex-1 rounded-sm border border-brass/40 bg-ink px-2 py-1.5 text-sm text-paper outline-none hover:border-brass-hi focus:border-brass-hi"
        >
          <optgroup label="Built-in">
            {builtin.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </optgroup>
          {uploaded.length > 0 && (
            <optgroup label="Uploaded">
              {uploaded.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {current.origin === 'upload' && (
          <button className="shrink-0 text-[11px] text-muted hover:text-red-300" onClick={() => void removePack(current.id)} title="Remove this uploaded pack">
            Remove
          </button>
        )}
      </div>
      {(current.info.author || current.info.description) && (
        <div className="text-[11px] leading-relaxed text-muted">
          {current.info.author && <span className="text-paper/70">{current.info.author}</span>}
          {current.info.author && current.info.description ? ' · ' : ''}
          {current.info.description}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-sm border border-brass/40 px-2 py-1 text-[11px] hover:border-brass-hi hover:text-brass-hi disabled:opacity-50" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Reading…' : 'Upload .zip pack'}
        </button>
        <button className="text-[11px] text-muted underline-offset-2 hover:text-brass-hi hover:underline" onClick={downloadTemplate}>
          Download template
        </button>
        <input ref={input} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
      </div>
      {msg && <div className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</div>}
      {hint && <div className="text-[11px] leading-relaxed text-muted">A pack is info.json + host.glb (+ voice lines, thumbnail). The template includes a guide.</div>}
    </div>
  )
}
