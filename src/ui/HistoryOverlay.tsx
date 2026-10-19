import { useEffect, useRef, useState } from 'react'
import { useGameStore, useShown, type Win } from '../store/useGameStore'
import { toCSV } from '../lib/parseEntries'

/** Stable pseudo-random tilt per ticket (so cards don't reshuffle on re-render). */
const tilt = (serial: string) => {
  let h = 0
  for (let i = 0; i < serial.length; i++) h = (h * 31 + serial.charCodeAt(i)) | 0
  return ((h % 1000) / 1000) * 7 - 3.5
}

/**
 * The keepsake box opened: the won tickets fly out of it one after another and land spread on
 * the table, each drawn like the real ticket. Small tools on top: export CSV, copy, clear.
 */
export function HistoryOverlay() {
  const open = useGameStore((s) => s.historyOpen)
  const history = useGameStore((s) => s.history)
  const absent = useGameStore((s) => s.absent)
  const restore = useGameStore((s) => s.restoreAbsent)
  const show = useShown()
  const set = useGameStore((s) => s.set)
  const clear = useGameStore((s) => s.clearHistory)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (!open) return null

  const rows = () => {
    const width = Math.max(1, ...history.map((h) => h.entry.cols.length))
    return [
      ['#', 'Serial', 'Time', 'Event', ...Array.from({ length: width }, (_, i) => (i === 0 ? 'Name' : i === 1 ? 'Prize' : `Column ${i + 1}`))],
      ...history.map((h, i) => [String(i + 1), h.serial, new Date(h.at).toLocaleString('en-GB'), h.title, ...h.entry.cols]),
    ]
  }
  const exportCSV = () => {
    const blob = new Blob(['﻿' + toCSV(rows())], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lucky-spin-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(rows().map((r) => r.join('\t')).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const tool = 'border border-brass/40 bg-black/40 px-3 py-1.5 hover:border-brass-hi hover:text-brass-hi disabled:opacity-40'
  const newestFirst = history.slice().reverse()

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/70" onPointerDown={() => set({ historyOpen: false })}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3" onPointerDown={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-4xl tracking-[0.15em]">
          Ticket book <span className="text-2xl text-muted">({history.length})</span>
        </h2>
        <div className="flex gap-2 text-sm tracking-[0.16em] uppercase">
          <button className={tool} onClick={exportCSV} disabled={!history.length}>
            Export CSV
          </button>
          <button className={tool} onClick={copy} disabled={!history.length}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className={confirm ? 'border border-red-400 px-3 py-1.5 text-red-300' : tool}
            onClick={() => {
              if (!confirm) return setConfirm(true)
              clear()
              setConfirm(false)
            }}
            disabled={!history.length && !absent.length}
          >
            {confirm ? 'Really clear?' : 'Clear book'}
          </button>
          <button className="px-2 text-2xl leading-none text-muted hover:text-paper" aria-label="Close" onClick={() => set({ historyOpen: false })}>
            ×
          </button>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-10">
        {absent.length > 0 && (
          <div className="mx-auto mb-2 max-w-7xl border border-red-400/30 bg-red-950/30 px-4 py-3" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm tracking-[0.16em] text-red-200/80 uppercase">Absent, not drawn again ({absent.length})</div>
            <div className="flex flex-wrap gap-2">
              {absent.map((w) => (
                <span key={w.serial} className="flex items-center gap-3 border border-red-300/30 px-3 py-1.5 text-xl">
                  <span className="line-through decoration-red-300/70">{show(w.entry.cols[0] || w.entry.raw)}</span>
                  <button className="text-sm text-brass hover:text-brass-hi" title="Put this person back into the draw" onClick={() => restore(w.serial)}>
                    ↺ Back into the draw
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {history.length === 0 ? (
          <div className="mt-24 text-center font-serif text-3xl text-muted italic">The ticket box is empty.</div>
        ) : (
          <div className="mx-auto grid max-w-7xl grid-cols-[repeat(auto-fill,minmax(28rem,1fr))] gap-x-8 gap-y-10 pt-4">
            {newestFirst.map((w, i) => (
              <TicketCard key={w.serial + w.at} win={w} index={history.length - i} delay={Math.min(i, 24) * 70} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TicketCard({ win, index, delay }: { win: Win; index: number; delay: number }) {
  const show = useShown()
  const removeWin = useGameStore((s) => s.removeWin)
  // delete buttons appear on hover (or tap) and linger 2s after the pointer leaves
  const [tools, setTools] = useState(false)
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showTools = () => {
    clearTimeout(hide.current)
    setTools(true)
  }
  const hideLater = () => {
    clearTimeout(hide.current)
    hide.current = setTimeout(() => setTools(false), 2000)
  }
  useEffect(() => () => clearTimeout(hide.current), [])
  const [name, ...rest] = (win.entry.cols.length ? win.entry.cols : [win.entry.raw]).map(show)
  const r = tilt(win.serial)
  return (
    <div
      className="ticket-fly group relative"
      style={{ animationDelay: `${delay}ms`, ['--r' as string]: `${r}deg` }}
      onPointerDown={(e) => {
        e.stopPropagation()
        showTools()
      }}
      onPointerEnter={showTools}
      onPointerLeave={hideLater}
    >
      <div
        className="relative flex aspect-[2/1] overflow-hidden rounded-[3px] text-[#1e140c] shadow-[0_14px_30px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:rotate-0 group-hover:scale-[1.04]"
        style={{ transform: `rotate(${r}deg)`, background: 'linear-gradient(135deg,#f6eedc,#eadfc6)' }}
      >
        {/* stub with serial */}
        <div className="flex w-[21%] items-center justify-center border-r-2 border-dotted border-[#b8893b]/70">
          <div className="-rotate-90 font-serif text-sm whitespace-nowrap text-[#7a5520]">Nº {win.serial}</div>
        </div>
        {/* body */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-3 text-center">
          <div className="pointer-events-none absolute inset-1.5 border-[3px] border-double border-[#b8893b]/80" />
          <div className="text-xs font-semibold tracking-[0.3em] text-[#6e4a17] uppercase">{win.title || 'Grand Draw'}</div>
          <div className="mt-1 line-clamp-2 font-serif text-4xl leading-tight font-extrabold text-[#0d0703]">{name}</div>
          {rest[0] && <div className="mt-1 truncate text-2xl font-bold tracking-wide text-[#7a1f12]">{rest[0]}</div>}
          {rest.length > 1 && <div className="truncate text-base font-semibold text-[#3d2a12]">{rest.slice(1).join(' · ')}</div>}
          <div className="mt-1 text-xs tracking-widest text-[#6e5232] uppercase">{new Date(win.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
        <div className="absolute top-2 right-3 font-mono text-sm font-bold text-[#8a6423]">#{index}</div>
      </div>
      {/* strike the ticket off: back into the draw, or out for good (winner not present) */}
      <div className={`mt-3 flex justify-center gap-3 text-sm tracking-[0.12em] uppercase transition-opacity duration-300 ${tools ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button
          className="border border-brass/40 bg-black/50 px-4 py-2 text-paper/85 hover:border-brass-hi hover:text-brass-hi"
          title="Remove this ticket and put the person back into the draw"
          onClick={() => removeWin(win.serial, 'return')}
        >
          Remove · back to draw
        </button>
        <button
          className="border border-red-400/40 bg-black/50 px-4 py-2 text-red-200/90 hover:border-red-300 hover:text-red-200"
          title="Winner is absent: remove the ticket and keep the person out of the draw"
          onClick={() => removeWin(win.serial, 'absent')}
        >
          Remove · absent
        </button>
      </div>
    </div>
  )
}
