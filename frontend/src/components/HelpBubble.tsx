import { HelpCircle, X } from 'lucide-react'
import { useState } from 'react'

const SHORTCUTS = [
  { keys: 'Ctrl K', description: 'Focus the search bar' },
  { keys: 'Esc', description: 'Close the before/after compare view' },
]


export function HelpBubble() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-3 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-float)]">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Keyboard shortcuts</h3>
            <button onClick={() => setOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">{s.description}</span>
                <kbd className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">
                  {s.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-[var(--shadow-float)] transition-transform hover:scale-105"
        title="Help & shortcuts"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    </div>
  )
}
