import { Check, Moon, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { clearHistoryEntries } from '../../lib/historyStore'
import { useToast } from '../ToastContext'
import type { SettingsStore } from '../../hooks/useSettings'
import type { EnhanceMode } from '../../types'

const MODES: { key: EnhanceMode; label: string }[] = [
  { key: 'color', label: 'Color' },
  { key: 'gray', label: 'Grayscale' },
  { key: 'bw', label: 'Black & white' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}


function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <div className="text-sm font-medium text-[var(--color-text)]">{title}</div>
        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</div>
      </div>
      {children}
    </div>
  )
}

function pillClass(active: boolean) {
  return `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'
  }`
}

export function SettingsPage({ store }: { store: SettingsStore }) {
  const { settings, update } = store
  const { showToast } = useToast()
  const [clearing, setClearing] = useState(false)

  const handleClearHistory = async () => {
    if (!window.confirm('Delete all scan history? This cannot be undone.')) return
    setClearing(true)
    try {
      await clearHistoryEntries()
      showToast('History cleared')
    } catch {
      showToast('Failed to clear history', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5">
      <Row title="Theme" description="Switch between dark and light mode.">
        <div className="flex gap-1.5 rounded-lg border border-[var(--color-border)] p-1">
          <button onClick={() => update('theme', 'dark')} className={pillClass(settings.theme === 'dark')}>
            <Moon className="h-3.5 w-3.5" /> Dark
          </button>
          <button onClick={() => update('theme', 'light')} className={pillClass(settings.theme === 'light')}>
            <Sun className="h-3.5 w-3.5" /> Light
          </button>
        </div>
      </Row>

      <Row title="Default output style" description="Pre-selected style when you start a new scan.">
        <div className="flex gap-1.5 rounded-lg border border-[var(--color-border)] p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => update('defaultMode', m.key)}
              className={pillClass(settings.defaultMode === m.key)}
            >
              {settings.defaultMode === m.key && <Check className="h-3 w-3" />}
              {m.label}
            </button>
          ))}
        </div>
      </Row>

      <Row
        title="Ultra HD upscale"
        description="Runs an AI model in your browser after each scan (first run downloads ~18MB). Can take a while on larger scans - runs entirely on your device, not the server."
      >
        <Toggle checked={settings.upscaleEnabled} onChange={(v) => update('upscaleEnabled', v)} />
      </Row>

      <Row title="Auto-download" description="Automatically download the file as soon as a scan finishes.">
        <Toggle checked={settings.autoDownload} onChange={(v) => update('autoDownload', v)} />
      </Row>

      <Row title="Clear history" description="Permanently delete all saved scans, stored in this browser, from the History page.">
        <button
          onClick={handleClearHistory}
          disabled={clearing}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)] disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </button>
      </Row>
    </div>
  )
}
