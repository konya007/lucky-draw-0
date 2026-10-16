import { useGameStore } from '../store/useGameStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { director } from '../director/Director'

/**
 * Corner controls: ⚙ settings and ×2 playback (also key F). Invisible until the pointer reaches the
 * bottom-right corner (the radio on stage is the main way into settings). While ×2 is on, a small
 * "×2" stays faintly visible so the speed-up is never a mystery.
 */
export function SpeedToggle() {
  const fast = useSettingsStore((s) => s.fast)
  const phase = useGameStore((s) => s.phase)
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border font-serif text-sm tracking-wider transition-all'
  return (
    <div className="group fixed right-0 bottom-0 z-30 flex h-28 w-44 items-end justify-end gap-2 p-4">
      <button
        type="button"
        title="Cài đặt âm thanh & đồ họa"
        aria-label="Cài đặt"
        onClick={() => director.openSettings()}
        className={`${btn} border-brass/50 bg-black/50 text-lg text-paper/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:border-brass-hi hover:text-brass-hi`}
      >
        ⚙
      </button>
      {phase !== 'EDITING' && (
        <button
          type="button"
          aria-pressed={fast}
          title="Tốc độ ×2 (phím F)"
          onClick={() => director.toggleFast()}
          className={`${btn} group-hover:opacity-100 focus-visible:opacity-100 ${
            fast
              ? 'border-brass-hi bg-brass/80 text-ink opacity-40 shadow-[0_0_24px_rgba(242,210,138,0.55)]'
              : 'border-brass/50 bg-black/50 text-paper/80 opacity-0 hover:border-brass-hi hover:text-brass-hi'
          }`}
        >
          ×2
        </button>
      )}
    </div>
  )
}
