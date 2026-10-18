import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useGameStore, useShown } from '../store/useGameStore'
import { sampleEntries } from '../lib/sampleData'
import { RIGS } from '../scene/Host/rigs'
import { parseEntries, tools, MAX_BALLS } from '../lib/parseEntries'
import { shuffle } from '../lib/shuffle'
import { director } from '../director/Director'

/** Shared with the packing overlay: where the preview list sits on screen (cards fly out from here). */
export const previewRect = { current: null as DOMRect | null }

const ROW = 34

// 3D preview is code-split (it pulls in three.js only when the editor opens)
const CharacterPreview = lazy(() => import('./CharacterPreview'))

/**
 * The single 2D screen: paste/edit the list over the closed curtain.
 * Left: big mono textarea. Right: parsed preview (virtualized) + stats. Toolbar of list tools.
 */
export function EntryModal() {
  const phase = useGameStore((s) => s.phase)
  const text = useGameStore((s) => s.text)
  const title = useGameStore((s) => s.title)
  const removeWinners = useGameStore((s) => s.removeWinners)
  const historyCount = useGameStore((s) => s.history.length)
  const ready = useGameStore((s) => s.sceneReady)
  const progress = useGameStore((s) => s.loadProgress)
  const set = useGameStore((s) => s.set)
  const [confirmClear, setConfirmClear] = useState(false)
  const [scroll, setScroll] = useState(0)
  const [listH, setListH] = useState(400)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const editorOpen = useGameStore((s) => s.editorOpen)
  const maskOn = useGameStore((s) => s.maskIds)
  const winnerLimit = useGameStore((s) => s.winnerLimit)
  const hostModel = useGameStore((s) => s.hostModel)
  const show = useShown()
  const [tab, setTab] = useState<'input' | 'preview'>('input')
  const rigLabel = RIGS.find((r) => r.id === hostModel)?.label ?? ''
  const visible = phase === 'EDITING' && editorOpen
  const [mounted, setMounted] = useState(visible)

  useEffect(() => {
    if (visible) setMounted(true)
    else {
      const t = setTimeout(() => setMounted(false), 1400)
      return () => clearTimeout(t)
    }
  }, [visible])

  const { entries, stats } = useMemo(() => parseEntries(text), [text])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setListH(el.clientHeight)
      previewRect.current = el.getBoundingClientRect()
    })
    ro.observe(el)
    previewRect.current = el.getBoundingClientRect()
    return () => ro.disconnect()
  }, [mounted])

  if (!mounted) return null

  const apply = (f: (t: string) => string) => set({ text: f(text) })
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const content = await f.text()
    set({ text: (text.trim() ? text.trimEnd() + '\n' : '') + content.replace(/^﻿/, '') })
    e.target.value = ''
  }
  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    set({ text: '' })
    setConfirmClear(false)
  }

  // virtual list window
  const first = Math.max(0, Math.floor(scroll / ROW) - 5)
  const last = Math.min(entries.length, Math.ceil((scroll + listH) / ROW) + 5)
  const canStart = ready && entries.length > 0

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center p-3 transition-opacity duration-[1200ms] sm:p-6 ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="flex h-[92vh] w-full max-w-[88rem] flex-col overflow-hidden rounded-md border border-brass/60 bg-black/[0.82] shadow-[0_30px_120px_rgba(0,0,0,0.8)] sm:h-[80vh]">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brass/25 px-5 pt-5 pb-4 sm:px-8">
          <div>
            <div className="text-[10px] tracking-[0.45em] text-muted uppercase">Đêm gala · bốc thăm</div>
            <h1 className="mt-1 font-serif text-3xl tracking-[0.12em] text-paper sm:text-4xl">Grand Draw</h1>
          </div>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 sm:max-w-md">
            <span className="text-[10px] tracking-[0.3em] text-muted uppercase">Tiêu đề sự kiện</span>
            <input
              value={title}
              onChange={(e) => set({ title: e.target.value })}
              maxLength={80}
              className="border-b border-brass/40 bg-transparent py-1 font-serif text-lg tracking-wide text-paper outline-none placeholder:text-muted/50 focus:border-brass-hi"
              placeholder="Year End Party 2026"
            />
          </label>
        </div>

        {/* toolbar: one dropdown for the list tools + the draw options */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-brass/15 px-5 py-3 sm:px-8">
          <ListMenu
            items={[
              { label: 'Thêm dữ liệu mẫu', onClick: () => apply((t) => (t.trim() ? t.trimEnd() + '\n' : '') + sampleEntries(30)) },
              { label: 'Nhập file .txt / .csv', onClick: () => fileRef.current?.click() },
              { sep: true },
              { label: 'Xáo trộn', onClick: () => apply((t) => shuffle(t.split(/\r?\n/).filter((l) => l.trim())).join('\n')) },
              { label: 'Sắp xếp A → Z', onClick: () => apply(tools.sortAZ) },
              { label: 'Đảo ngược', onClick: () => apply(tools.reverse) },
              { label: 'Xóa dòng trùng', onClick: () => apply(tools.dedupe) },
              { label: 'Xóa dòng trống', onClick: () => apply(tools.removeEmpty) },
              { sep: true },
              { label: confirmClear ? 'Bấm lần nữa để xóa hết' : 'Xóa hết danh sách', danger: true, keepOpen: !confirmClear, onClick: clearAll },
            ]}
          />
          <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={onFile} />
          <label className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-paper/80 uppercase">
            Nhân vật
            <select
              value={hostModel}
              onChange={(e) => set({ hostModel: e.target.value })}
              className="rounded-sm border border-brass/40 bg-ink px-2 py-1 text-[12px] tracking-wide text-paper normal-case outline-none hover:border-brass-hi focus:border-brass-hi"
            >
              {RIGS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <Switch on={maskOn} onChange={() => set({ maskIds: !maskOn })} label="Che mã số" hint="225xxxx127" />
          <label className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-paper/80 uppercase">
            Số người trúng
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={winnerLimit ?? ''}
              placeholder="∞"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                set({ winnerLimit: Number.isFinite(v) && v > 0 ? v : null })
              }}
              className="w-16 border-b border-brass/40 bg-transparent py-0.5 text-center font-mono text-sm text-paper outline-none placeholder:text-muted focus:border-brass-hi"
              title="Để trống: quay đến khi hết danh sách. Có số: đủ số người trúng thì hạ màn."
            />
          </label>
          <div className="ml-auto">
            <Switch on={removeWinners} onChange={() => set({ removeWinners: !removeWinners })} label="Loại người đã trúng" />
          </div>
        </div>

        {/* body: left = list (input / preview tabs), right = the host holding the ballot box */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 sm:flex-row sm:px-8">
          <div className="flex min-h-[14rem] flex-[3] flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <div role="tablist" className="flex overflow-hidden rounded-sm border border-brass/40">
                {(['input', 'preview'] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors ${tab === t ? 'bg-brass/70 text-ink' : 'text-paper/85 hover:bg-brass/15'}`}
                  >
                    {t === 'input' ? 'Nhập' : `Xem trước (${stats.total})`}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap gap-3 text-[10px] tracking-[0.15em] text-muted uppercase">
                <span>
                  Trùng <b className="font-serif text-sm text-paper">{stats.duplicates}</b>
                </span>
                <span>
                  Trống bỏ qua <b className="font-serif text-sm text-paper">{stats.empty}</b>
                </span>
                <span>
                  Quả cầu (≤{MAX_BALLS}) <b className="font-serif text-sm text-brass-hi">{stats.balls}</b>
                </span>
              </div>
            </div>
            <div ref={listRef} className="relative min-h-0 flex-1">
              {tab === 'input' ? (
                <textarea
                  value={text}
                  onChange={(e) => set({ text: e.target.value })}
                  spellCheck={false}
                  placeholder={'Mỗi dòng một mục. Có thể dùng `Tên | Giải thưởng | Ghi chú`\n\nNguyễn Văn An | Giải Nhất | Phòng Kỹ thuật\nTrần Thị Bình | Giải Nhì\nLê Hoàng Cường'}
                  className="scroll-thin absolute inset-0 h-full w-full resize-none rounded border border-brass/25 bg-black/50 p-4 font-mono text-[13px] leading-[1.7] text-paper outline-none placeholder:text-muted/45 focus:border-brass/60"
                />
              ) : (
                <div onScroll={(e) => setScroll(e.currentTarget.scrollTop)} className="scroll-thin absolute inset-0 overflow-y-auto rounded border border-brass/15 bg-black/30">
                  {entries.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-6 text-center font-serif text-muted italic">Danh sách xem trước sẽ hiện ở đây</div>
                  ) : (
                    <div style={{ height: entries.length * ROW }} className="relative">
                      {entries.slice(first, last).map((e, k) => {
                        const i = first + k
                        return (
                          <div key={e.id} style={{ top: i * ROW, height: ROW }} className="absolute inset-x-0 flex items-center gap-3 border-b border-white/[0.04] px-3 text-sm">
                            <span className="w-10 shrink-0 text-right font-mono text-[11px] text-brass/80">{i + 1}</span>
                            <span className="truncate text-paper">{show(e.cols[0])}</span>
                            {e.cols.slice(1).map((c, ci) => (
                              <span key={ci} className="truncate text-xs text-muted">
                                {show(c)}
                              </span>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            {historyCount > 0 && (
              <div className="mt-2 text-[11px] tracking-wide text-muted">
                {historyCount} lượt đã quay trước đó{removeWinners ? ', người đã trúng sẽ được loại khỏi lượt mới' : ''}.
              </div>
            )}
          </div>
          <div className="relative hidden min-h-[14rem] flex-[2] overflow-hidden rounded border border-brass/15 bg-[radial-gradient(ellipse_at_50%_35%,rgba(184,137,59,0.18),transparent_65%)] sm:block">
            <Suspense fallback={null}>
              <CharacterPreview />
            </Suspense>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-serif text-sm tracking-[0.2em] text-paper/70">{rigLabel}</div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-4 border-t border-brass/25 px-5 py-4 sm:px-8">
          <ResultsButtons />
          <button
            type="button"
            disabled={!canStart}
            onClick={() => void director.start()}
            className="relative ml-auto overflow-hidden rounded-sm border border-brass-hi/70 bg-gradient-to-b from-[#d6a955] to-[#8a6223] px-8 py-3.5 font-serif text-base tracking-[0.3em] text-ink uppercase shadow-[0_0_40px_rgba(184,137,59,0.35)] transition-all hover:shadow-[0_0_60px_rgba(242,210,138,0.55)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:text-lg"
          >
            {!ready && <span className="absolute inset-y-0 left-0 bg-white/25 transition-[width]" style={{ width: `${progress}%` }} />}
            <span className="relative">{ready ? 'Tiến hành quay số' : `Đang dựng sân khấu… ${Math.round(progress)}%`}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

type MenuItem = { sep: true } | { label: string; onClick: () => void; danger?: boolean; keepOpen?: boolean; sep?: false }

/** "Thao tác ▾": all list tools in one dropdown. */
function ListMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase transition-colors ${open ? 'border-brass-hi text-brass-hi' : 'border-brass/40 text-paper/85 hover:border-brass-hi hover:text-brass-hi'}`}
      >
        Thao tác danh sách <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-1 min-w-[15rem] rounded-sm border border-brass/40 bg-ink/95 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          {items.map((it, i) =>
            it.sep ? (
              <div key={i} className="my-1 border-t border-brass/15" />
            ) : (
              <button
                key={i}
                role="menuitem"
                type="button"
                onClick={() => {
                  it.onClick()
                  if (!it.keepOpen) setOpen(false)
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-brass/15 ${it.danger ? 'text-red-300' : 'text-paper/90'}`}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-paper/80 uppercase" title={hint}>
      <span className={`relative h-4 w-8 rounded-full border transition-colors ${on ? 'border-brass bg-brass/40' : 'border-muted/50 bg-transparent'}`}>
        <span className={`absolute top-[1px] h-3 w-3 rounded-full transition-all ${on ? 'left-[17px] bg-brass-hi' : 'left-[1px] bg-muted'}`} />
      </span>
      {label}
      {hint && on && <span className="font-mono text-[10px] tracking-normal text-muted normal-case">{hint}</span>}
    </button>
  )
}


/** Past results: open the winners' ticket gallery, or clear them (second click confirms). */
function ResultsButtons() {
  const count = useGameStore((s) => s.history.length)
  const set = useGameStore((s) => s.set)
  const clear = useGameStore((s) => s.clearHistory)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(false), 3000)
    return () => clearTimeout(t)
  }, [confirm])
  const small = 'rounded-sm border px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase transition-colors disabled:opacity-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => set({ historyOpen: true })} className={`${small} border-brass/40 text-paper/85 hover:border-brass-hi hover:text-brass-hi`}>
        Người đã trúng ({count})
      </button>
      <button
        type="button"
        disabled={!count}
        onClick={() => {
          if (!confirm) return setConfirm(true)
          clear()
          setConfirm(false)
        }}
        className={`${small} ${confirm ? 'border-red-400/80 text-red-200' : 'border-brass/40 text-paper/85 hover:border-red-300 hover:text-red-200'}`}
      >
        {confirm ? 'Bấm lần nữa để xóa' : 'Xóa kết quả'}
      </button>
    </div>
  )
}
