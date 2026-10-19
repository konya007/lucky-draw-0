import { useGameStore } from '../store/useGameStore'
import { director } from '../director/Director'
import { audio } from '../audio/audioManager'

/** First screen after loading: the closed curtain, the event title and the two main buttons. */
export function HomeScreen() {
  const ready = useGameStore((s) => s.sceneReady)
  const phase = useGameStore((s) => s.phase)
  const editorOpen = useGameStore((s) => s.editorOpen)
  const title = useGameStore((s) => s.title)
  const set = useGameStore((s) => s.set)
  const visible = ready && phase === 'EDITING' && !editorOpen
  return (
    <div className={`fixed inset-0 z-20 flex flex-col items-center justify-center transition-opacity duration-700 ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      <div className="text-[10px] tracking-[0.6em] text-paper/60 uppercase">Gala night · lucky draw</div>
      <h1 className="mt-3 text-center font-serif text-[clamp(2.2rem,7vw,5rem)] tracking-[0.3em] text-paper drop-shadow-[0_0_30px_rgba(255,220,160,0.25)]">{title || 'LUCKY SPIN'}</h1>
      <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            void audio.unlock()
            audio.play('tick', { vol: 0.5 })
            set({ editorOpen: true })
          }}
          className="min-w-[14rem] rounded-sm border border-brass-hi/70 bg-gradient-to-b from-[#d6a955] to-[#8a6223] px-8 py-3.5 font-serif text-lg tracking-[0.3em] text-ink uppercase shadow-[0_0_40px_rgba(184,137,59,0.35)] transition-shadow hover:shadow-[0_0_60px_rgba(242,210,138,0.55)]"
        >
          Start the draw
        </button>
        <button
          type="button"
          onClick={() => director.openSettings()}
          className="min-w-[14rem] rounded-sm border border-brass/60 bg-black/50 px-8 py-3.5 font-serif text-lg tracking-[0.3em] text-paper/90 uppercase transition-colors hover:border-brass-hi hover:text-brass-hi"
        >
          Settings
        </button>
      </div>
    </div>
  )
}
