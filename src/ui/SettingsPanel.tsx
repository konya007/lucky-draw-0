import { useGameStore } from '../store/useGameStore'
import { useRef, useState } from 'react'
import { useMedia, saveMedia, clearMedia, type MediaKind } from '../lib/mediaStore'
import { useSettingsStore, type QualityChoice } from '../store/useSettingsStore'
import { useQuality, type QualityPreset } from '../quality/qualityPresets'
import { director } from '../director/Director'
import { audio } from '../audio/audioManager'

const QUALITY: { k: QualityChoice; label: string }[] = [
  { k: 'auto', label: 'Tự động' },
  { k: 'low', label: 'Thấp' },
  { k: 'medium', label: 'TB' },
  { k: 'high', label: 'Cao' },
  { k: 'ultra', label: 'Ultra' },
]
const LEVEL_LABEL = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', ultra: 'Ultra' } as const

/** Sound + graphics settings. Opened from the ⚙ button or by tapping the radio on stage. */
export function SettingsPanel() {
  const open = useGameStore((s) => s.settingsOpen)
  const st = useSettingsStore()
  if (!open) return null
  const close = () => director.closeSettings()
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end p-4 sm:items-center sm:justify-center" onPointerDown={close}>
      <div
        className="scroll-thin max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-md border border-brass/50 bg-ink/90 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.7)] backdrop-blur-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-[0.15em]">Cài đặt</h2>
          <button className="text-xl leading-none text-muted hover:text-paper" aria-label="Đóng" onClick={close}>
            ×
          </button>
        </div>

        <Section title="Âm thanh">
          <Slider label="Tổng" value={st.master} onChange={(v) => st.set({ master: v })} />
          <Slider label="Nhạc nền" value={st.music} onChange={(v) => st.set({ music: v })} />
          <Slider label="Hiệu ứng" value={st.sfx} onChange={(v) => st.set({ sfx: v })} />
          <Toggle label="Tắt tiếng" on={st.muted} onChange={() => st.set({ muted: !st.muted })} />
        </Section>

        <Section title="Sân khấu & nhạc nền">
          <Upload kind="backstage" label="Ảnh nền" accept="image/*" />
          <Upload kind="music" label="Nhạc nền" accept="audio/*" />
          <div className="text-[11px] leading-relaxed text-muted">Lưu trên trình duyệt này. Tải lên file mới sẽ thay file cũ.</div>
        </Section>

        <Section title="Đồ họa">
          <div className="grid grid-cols-5 gap-1">
            {QUALITY.map((q) => (
              <button
                key={q.k}
                onClick={() => {
                  st.set({ quality: q.k })
                  audio.play('tick', { vol: 0.4 })
                }}
                className={`rounded-sm border px-1 py-2 text-[11px] tracking-wide transition-colors ${
                  st.quality === q.k ? 'border-brass-hi bg-brass/70 text-ink' : 'border-brass/30 text-paper/80 hover:border-brass-hi'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-muted">
            Đang hiển thị: {LEVEL_LABEL[st.level]}
            {st.quality === 'auto' ? ' (tự chỉnh theo máy)' : ''}
          </div>
        </Section>

        <Advanced />

        <Section title="Tốc độ">
          <Toggle label="Chạy nhanh ×2 (phím F)" on={st.fast} onChange={() => director.toggleFast()} />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-[10px] tracking-[0.35em] text-brass uppercase">{title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-paper/85">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1 flex-1 cursor-pointer accent-[#b8893b]"
      />
      <span className="w-8 text-right font-mono text-xs text-muted">{Math.round(value * 100)}</span>
    </label>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} className="flex items-center justify-between text-sm text-paper/85">
      {label}
      <span className={`relative h-5 w-9 rounded-full border transition-colors ${on ? 'border-brass bg-brass/50' : 'border-muted/50'}`}>
        <span className={`absolute top-[2px] h-3.5 w-3.5 rounded-full transition-all ${on ? 'left-[18px] bg-brass-hi' : 'left-[2px] bg-muted'}`} />
      </span>
    </button>
  )
}

/**
 * Per-option overrides on top of the chosen level. Each control shows the value currently in effect;
 * changing it pins that option until "Đặt lại theo mức".
 */
function Advanced() {
  const [open, setOpen] = useState(false)
  const q = useQuality()
  const st = useSettingsStore()
  const custom = st.custom
  const put = <K extends keyof QualityPreset>(k: K, v: QualityPreset[K]) => st.set({ custom: { ...custom, [k]: v } })
  const pinned = Object.keys(custom).length
  return (
    <div className="mb-5">
      <button className="mb-2 flex w-full items-center justify-between text-[10px] tracking-[0.35em] text-brass uppercase" onClick={() => setOpen(!open)}>
        <span>
          Tùy chỉnh chi tiết{pinned ? ` · ${pinned} mục` : ''}
        </span>
        <span className="text-sm">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          <Slider label="Độ phân giải" value={st.renderScale} onChange={(v) => st.set({ renderScale: Math.max(0.5, v) })} />
          <Choice
            label="Bóng đổ"
            value={q.shadowSize === 0 ? 0 : q.shadowSize < 2048 ? 1 : 2}
            options={['Tắt', 'Thấp', 'Cao']}
            onChange={(i) => put('shadowSize', [0, 1024, 2048][i])}
          />
          <Toggle label="Bóng thật của nhân vật" on={q.hostShadow} onChange={() => put('hostShadow', !q.hostShadow)} />
          <Toggle label="Sàn phản chiếu" on={q.reflectorRes > 0} onChange={() => put('reflectorRes', q.reflectorRes > 0 ? 0 : 512)} />
          <Choice label="Luồng sáng đèn" value={['off', 'main', 'all'].indexOf(q.cones)} options={['Tắt', 'Chính', 'Tất cả']} onChange={(i) => put('cones', (['off', 'main', 'all'] as const)[i])} />
          <Toggle label="Bụi trong luồng sáng" on={q.dustInCones} onChange={() => put('dustInCones', !q.dustInCones)} />
          <Choice label="Khói sàn" value={q.fogLayers === 0 ? 0 : q.fogLayers === 1 ? 1 : 2} options={['Tắt', '1 lớp', '3 lớp']} onChange={(i) => put('fogLayers', [0, 1, 3][i])} />
          <Toggle label="Phát sáng (bloom)" on={q.bloom} onChange={() => put('bloom', !q.bloom)} />
          <Toggle label="Lấy nét điện ảnh (DOF)" on={q.dof} onChange={() => put('dof', !q.dof)} />
          <Toggle label="Viền màu khi lia máy" on={q.chroma} onChange={() => put('chroma', !q.chroma)} />
          <Toggle label="Hạt phim" on={q.grain} onChange={() => put('grain', !q.grain)} />
          <Toggle label="Khử răng cưa (SMAA)" on={q.antialias} onChange={() => put('antialias', !q.antialias)} />
          <Toggle label="Nhòe chuyển động lồng" on={q.motionBlur} onChange={() => put('motionBlur', !q.motionBlur)} />
          <Slider label="Pháo giấy" value={q.confetti / 400} onChange={(v) => put('confetti', Math.round(v * 400))} />
          <button
            className="self-start text-[11px] tracking-wide text-muted underline-offset-2 hover:text-paper hover:underline disabled:opacity-40"
            disabled={!pinned && st.renderScale === 1}
            onClick={() => st.set({ custom: {}, renderScale: 1 })}
          >
            Đặt lại theo mức đồ họa
          </button>
        </div>
      )}
    </div>
  )
}

function Choice({ label, value, options, onChange }: { label: string; value: number; options: string[]; onChange: (i: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-paper/85">{label}</span>
      <div className="flex gap-1">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => onChange(i)}
            className={`rounded-sm border px-2 py-1 text-[11px] ${i === value ? 'border-brass-hi bg-brass/70 text-ink' : 'border-brass/30 text-paper/80 hover:border-brass-hi'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Upload slot backed by IndexedDB (one file per kind; a new upload overwrites the old one). */
function Upload({ kind, label, accept }: { kind: MediaKind; label: string; accept: string }) {
  const input = useRef<HTMLInputElement>(null)
  const name = useMedia((s) => (kind === 'backstage' ? s.backstageName : s.musicName))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const onPick = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    if (f.size > 80 * 1024 * 1024) return setErr('File quá lớn (tối đa 80 MB).')
    setBusy(true)
    try {
      await saveMedia(kind, f)
      audio.play('tick', { vol: 0.5 })
    } catch {
      setErr('Không lưu được file.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-paper/85">{label}</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[11px] text-muted" title={name ?? ''}>
            {busy ? 'Đang lưu…' : (name ?? 'Mặc định')}
          </span>
          <button className="shrink-0 rounded-sm border border-brass/40 px-2 py-1 text-[11px] hover:border-brass-hi hover:text-brass-hi" onClick={() => input.current?.click()}>
            Tải lên
          </button>
          {name && (
            <button className="shrink-0 text-[11px] text-muted hover:text-red-300" onClick={() => void clearMedia(kind)} aria-label={`Xóa ${label}`}>
              Xóa
            </button>
          )}
        </div>
        <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
      </div>
      {err && <div className="text-[11px] text-red-300">{err}</div>}
    </div>
  )
}
