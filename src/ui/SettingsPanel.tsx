import { useGameStore } from '../store/useGameStore'
import { useSettingsStore, type QualityChoice } from '../store/useSettingsStore'
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
        className="w-full max-w-sm rounded-md border border-brass/50 bg-ink/90 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.7)] backdrop-blur-sm"
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
