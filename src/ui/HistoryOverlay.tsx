import { useState } from 'react'
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
  const set = useGameStore((s) => s.set)
  const clear = useGameStore((s) => s.clearHistory)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (!open) return null

  const rows = () => {
    const width = Math.max(1, ...history.map((h) => h.entry.cols.length))
    return [
      ['#', 'Seri', 'Thời gian', 'Sự kiện', ...Array.from({ length: width }, (_, i) => (i === 0 ? 'Tên' : i === 1 ? 'Giải' : `Cột ${i + 1}`))],
      ...history.map((h, i) => [String(i + 1), h.serial, new Date(h.at).toLocaleString('vi-VN'), h.title, ...h.entry.cols]),
    ]
  }
  const exportCSV = () => {
    const blob = new Blob(['﻿' + toCSV(rows())], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `grand-draw-${new Date().toISOString().slice(0, 10)}.csv`
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
        <h2 className="font-serif text-2xl tracking-[0.15em]">
          Sổ vé <span className="text-base text-muted">({history.length})</span>
        </h2>
        <div className="flex gap-2 text-[11px] tracking-[0.16em] uppercase">
          <button className={tool} onClick={exportCSV} disabled={!history.length}>
            Xuất CSV
          </button>
          <button className={tool} onClick={copy} disabled={!history.length}>
            {copied ? 'Đã chép' : 'Sao chép'}
          </button>
          <button
            className={confirm ? 'border border-red-400 px-3 py-1.5 text-red-300' : tool}
            onClick={() => {
              if (!confirm) return setConfirm(true)
              clear()
              setConfirm(false)
            }}
            disabled={!history.length}
          >
            {confirm ? 'Xóa thật?' : 'Xóa sổ'}
          </button>
          <button className="px-2 text-2xl leading-none text-muted hover:text-paper" aria-label="Đóng" onClick={() => set({ historyOpen: false })}>
            ×
          </button>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-10">
        {history.length === 0 ? (
          <div className="mt-24 text-center font-serif text-lg text-muted italic">Hộp vé còn trống.</div>
        ) : (
          <div className="mx-auto grid max-w-7xl grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-x-6 gap-y-8 pt-4">
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
  const [name, ...rest] = (win.entry.cols.length ? win.entry.cols : [win.entry.raw]).map(show)
  const r = tilt(win.serial)
  return (
    <div
      className="ticket-fly group relative"
      style={{ animationDelay: `${delay}ms`, ['--r' as string]: `${r}deg` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative flex aspect-[2/1] overflow-hidden rounded-[3px] text-[#1e140c] shadow-[0_14px_30px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:rotate-0 group-hover:scale-[1.04]"
        style={{ transform: `rotate(${r}deg)`, background: 'linear-gradient(135deg,#f6eedc,#eadfc6)' }}
      >
        {/* stub with serial */}
        <div className="flex w-[21%] items-center justify-center border-r-2 border-dotted border-[#b8893b]/70">
          <div className="-rotate-90 font-serif text-[11px] whitespace-nowrap text-[#7a5520]">Nº {win.serial}</div>
        </div>
        {/* body */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-3 text-center">
          <div className="pointer-events-none absolute inset-1.5 border-[3px] border-double border-[#b8893b]/80" />
          <div className="text-[9px] tracking-[0.35em] text-[#9a7a46] uppercase">{win.title || 'Grand Draw'}</div>
          <div className="mt-1 line-clamp-2 font-serif text-xl leading-tight font-bold">{name}</div>
          {rest[0] && <div className="mt-0.5 truncate font-serif text-sm text-[#5b3f1c] italic">{rest[0]}</div>}
          {rest.length > 1 && <div className="truncate text-[10px] text-[#7d6440]">{rest.slice(1).join(' · ')}</div>}
          <div className="mt-1 text-[9px] tracking-widest text-[#9a7a46] uppercase">{new Date(win.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
        <div className="absolute top-1.5 right-3 font-mono text-[10px] text-[#b8893b]">#{index}</div>
      </div>
    </div>
  )
}
