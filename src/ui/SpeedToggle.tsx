import { useEffect, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { director } from '../director/Director'

/**
 * Corner controls: ⚙ settings, ×2 playback (also key F) and "Hạ màn" (end the show early, confirmed
 * with a second click). Invisible until the pointer reaches the bottom-right corner (the radio on
 * stage is the main way into settings). While ×2 is on, a faint "×2" stays visible.
 */
export function SpeedToggle() {
  const fast = useSettingsStore((s) => s.fast)
  const phase = useGameStore((s) => s.phase)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  useEffect(() => {
    if (phase === 'EDITING' || phase === 'FINISHED') setEnding(false)
  }, [phase])
  useEffect(() => {
    if (!confirmEnd) return
    const t = setTimeout(() => setConfirmEnd(false), 3000)
    return () => clearTimeout(t)
  }, [confirmEnd])
  const onStage = phase !== 'EDITING' && phase !== 'FINISHED'
  const btn = 'flex h-11 items-center justify-center rounded-full border font-serif text-sm tracking-wider transition-all'
  const quiet = 'border-brass/50 bg-black/50 text-paper/80 opacity-0 hover:border-brass-hi hover:text-brass-hi'
  return (
    <div className="group fixed right-0 bottom-0 z-30 flex h-28 min-w-44 items-end justify-end gap-2 p-4">
      {onStage && (
        <button
          type="button"
          title="Kết thúc buổi quay sớm"
          disabled={ending}
          onClick={() => {
            if (!confirmEnd) return setConfirmEnd(true)
            setConfirmEnd(false)
            setEnding(true)
            director.requestEnd()
          }}
          className={`${btn} px-4 group-hover:opacity-100 focus-visible:opacity-100 ${
            ending ? 'border-brass/40 bg-black/60 text-muted opacity-60' : confirmEnd ? 'border-red-400/80 bg-black/70 text-red-200 opacity-100' : quiet
          }`}
        >
          {ending ? 'Sắp hạ màn…' : confirmEnd ? 'Hạ màn?' : 'Hạ màn'}
        </button>
      )}
      <button
        type="button"
        title="Cài đặt âm thanh & đồ họa"
        aria-label="Cài đặt"
        onClick={() => director.openSettings()}
        className={`${btn} w-11 text-lg ${quiet} group-hover:opacity-100 focus-visible:opacity-100`}
      >
        ⚙
      </button>
      {phase !== 'EDITING' && (
        <button
          type="button"
          aria-pressed={fast}
          title="Tốc độ ×2 (phím F)"
          onClick={() => director.toggleFast()}
          className={`${btn} w-11 group-hover:opacity-100 focus-visible:opacity-100 ${
            fast ? 'border-brass-hi bg-brass/80 text-ink opacity-40 shadow-[0_0_24px_rgba(242,210,138,0.55)]' : quiet
          }`}
        >
          ×2
        </button>
      )}
    </div>
  )
}
