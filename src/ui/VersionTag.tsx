/** Bottom-left: app version and author, read from package.json at build time. */
export function VersionTag() {
  return (
    <div className="pointer-events-none fixed bottom-2 left-3 z-30 font-mono text-[10px] tracking-wider text-paper/35 select-none">
      v{__APP_VERSION__} · {__APP_AUTHOR__}
    </div>
  )
}
