import { ChevronLeft, ChevronRight, History, ScanLine, Settings } from 'lucide-react'
import { useState } from 'react'
import { BrandMark } from '../BrandMark'
import type { Page } from '../../types'

const NAV_ITEMS: { icon: typeof ScanLine; label: string; page: Page }[] = [
  { icon: ScanLine, label: 'Scan', page: 'scan' },
  { icon: History, label: 'History', page: 'history' },
  { icon: Settings, label: 'Settings', page: 'settings' },
]

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`relative my-3 ml-3 flex h-[calc(100%-1.5rem)] shrink-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-5 shadow-[var(--shadow-card)] transition-[width] ${collapsed ? 'w-[68px] px-2' : 'w-64 px-4'}`}
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-[var(--shadow-card)] transition-colors hover:text-[var(--color-accent)]"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className={`mb-8 flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
        <div className="shrink-0">
          <BrandMark size={32} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight text-[var(--color-text)]">ScanDeck</div>
            <div className="truncate text-[11px] leading-tight text-[var(--color-text-muted)]">Document Workspace</div>
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ icon: Icon, label, page: itemPage }) => {
          const active = page === itemPage
          return (
            <button
              key={label}
              onClick={() => onNavigate(itemPage)}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'} ${
                active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {!collapsed && <span className="flex-1 text-left">{label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
