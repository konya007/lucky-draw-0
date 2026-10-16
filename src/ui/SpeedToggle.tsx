import { useGameStore } from '../store/useGameStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { director } from '../director/Director'

/** Corner controls: ⚙ settings (always) and ×2 playback (on stage; also key F). */
export function SpeedToggle() {
  const fast = useSettingsStore((s) => s.fast)
  const phase = useGameStore((s) => s.phase)
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border font-serif text-sm tracking-wider transition-all'
  return (
    <div className="fixed right-4 bottom-4 z-30 flex gap-2">
      <button
        type="button"
        title="Cài đặt âm thanh & đồ họa"
        aria-label="Cài đặt"
        onClick={() => director.openSettings()}
        className={`${btn} border-brass/50 bg-black/50 text-lg text-paper/80 hover:border-brass-hi hover:text-brass-hi`}
      >
        ⚙
      </button>
      {phase !== 'EDITING' && (
    <button
      type="button"
      aria-pressed={fast}
      title="Tốc độ ×2 (phím F)"
      onClick={() => director.toggleFast()}
      className={`${btn} ${
        fast ? 'border-brass-hi bg-brass/80 text-ink shadow-[0_0_24px_rgba(242,210,138,0.55)]' : 'border-brass/50 bg-black/50 text-paper/80 hover:border-brass-hi hover:text-brass-hi'
      }`}
    >
      ×2
    </button>
      )}
    </div>
  )
}
