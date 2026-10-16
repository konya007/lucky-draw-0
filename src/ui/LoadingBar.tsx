import { useGameStore } from '../store/useGameStore'

/** Minimal loading indicator: a thin brass line along the top while the stage builds in the background. */
export function LoadingBar() {
  const ready = useGameStore((s) => s.sceneReady)
  const p = useGameStore((s) => s.loadProgress)
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] transition-opacity duration-700 ${ready ? 'opacity-0' : 'opacity-100'}`}>
      <div className="h-full bg-gradient-to-r from-brass/0 via-brass-hi to-brass transition-[width] duration-300" style={{ width: `${Math.max(4, p)}%` }} />
    </div>
  )
}
