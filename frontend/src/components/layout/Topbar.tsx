import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'


export function Topbar({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
}: {
  title: string
  subtitle: string
  searchQuery: string
  onSearchChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className="flex items-center justify-between gap-6 border-b border-[var(--color-border)] px-8 py-5">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">{title}</h1>
        <p className="truncate text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
      </div>

      <div className="flex flex-1 justify-center">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your scan history…"
            className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-9 pr-14 text-sm text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
            Ctrl K
          </kbd>
        </div>
      </div>
    </header>
  )
}
