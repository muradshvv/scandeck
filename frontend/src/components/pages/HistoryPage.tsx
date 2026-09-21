import { Columns2, Download, FileText, LayoutGrid, List, History as HistoryIcon, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { exportPdf } from '../../api/client'
import { deleteHistoryEntry, downloadBlob, listHistoryEntries } from '../../lib/historyStore'
import { BeforeAfterSlider } from '../BeforeAfterSlider'
import { useToast } from '../ToastContext'
import type { LocalHistoryEntry } from '../../lib/historyStore'

const MODE_LABELS: Record<string, string> = {
  color: 'Color',
  gray: 'Grayscale',
  bw: 'Black & white',
  uhd: 'Ultra HD',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function modeLabel(entry: LocalHistoryEntry) {
  const base = MODE_LABELS[entry.mode] ?? entry.mode
  return entry.upscaled ? `${base} + Ultra HD` : base
}

function matchesQuery(entry: LocalHistoryEntry, query: string) {
  if (!query.trim()) return true
  const haystack = `${modeLabel(entry)} ${formatDate(entry.created_at)}`.toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

function CompareModal({ entry, onClose }: { entry: LocalHistoryEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-white">
            {modeLabel(entry)} &middot; {formatDate(entry.created_at)}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <BeforeAfterSlider beforeSrc={entry.before_thumbnail} afterSrc={entry.thumbnail} />
      </div>
    </div>
  )
}


function EntryActions({
  entry,
  onCompare,
  onDelete,
}: {
  entry: LocalHistoryEntry
  onCompare: () => void
  onDelete: () => void
}) {
  const { showToast } = useToast()

  const handleDownloadImage = () => {
    downloadBlob(entry.imageBlob, `scanned_document.${entry.ext}`)
  }

  const handleDownloadPdf = async () => {
    try {
      const pdfBlob = await exportPdf(entry.imageBlob, 'flattened')
      downloadBlob(pdfBlob, 'scanned_document.pdf')
    } catch {
      showToast('PDF export failed', 'error')
    }
  }

  return (
    <div className="flex shrink-0 gap-1.5">
      <button
        onClick={onCompare}
        title="Compare before / after"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <Columns2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleDownloadImage}
        title="Download image"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleDownloadPdf}
        title="Download as PDF"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        title="Delete"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}


function GridCard({ entry, onCompare, onDelete }: { entry: LocalHistoryEntry; onCompare: () => void; onDelete: () => void }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <button onClick={onCompare} className="flex h-40 w-full items-center justify-center bg-[var(--color-surface-3)]" title="Compare before / after">
        <img src={entry.thumbnail} alt="scanned document" className="h-full w-full object-contain" />
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--color-text)]">{modeLabel(entry)}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{formatDate(entry.created_at)}</div>
        </div>
        <EntryActions entry={entry} onCompare={onCompare} onDelete={onDelete} />
      </div>
    </div>
  )
}

function ListRow({ entry, onCompare, onDelete }: { entry: LocalHistoryEntry; onCompare: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
      <button onClick={onCompare} className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-3)]">
        <img src={entry.thumbnail} alt="scanned document" className="h-full w-full object-cover" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">{modeLabel(entry)}</div>
        <div className="font-mono text-xs text-[var(--color-text-muted)]">{entry.width}×{entry.height}px</div>
      </div>
      <div className="hidden shrink-0 font-mono text-xs text-[var(--color-text-muted)] sm:block">{formatDate(entry.created_at)}</div>
      <EntryActions entry={entry} onCompare={onCompare} onDelete={onDelete} />
    </div>
  )
}

export function HistoryPage({
  searchQuery = '',
  limit,
  compact = false,
  onViewAll,
}: {
  searchQuery?: string
  limit?: number
  compact?: boolean
  onViewAll?: () => void
}) {
  const [entries, setEntries] = useState<LocalHistoryEntry[] | null>(null)
  const [compareEntry, setCompareEntry] = useState<LocalHistoryEntry | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const { showToast } = useToast()

  const load = () => {
    listHistoryEntries()
      .then(setEntries)
      .catch(() => showToast('Failed to load history', 'error'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteHistoryEntry(id)
      setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null)
      showToast('Removed from history')
    } catch {
      showToast('Failed to remove entry', 'error')
    }
  }

  if (entries === null) {
    return <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
  }

  const filtered = entries.filter((e) => matchesQuery(e, searchQuery))
  const visible = limit ? filtered.slice(0, limit) : filtered

  const emptyMessage =
    entries.length === 0
      ? 'No documents processed yet. Upload a file above to begin.'
      : 'No documents match your search.'

  return (
    <>
      {compact && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Recent</h2>
          {onViewAll && (
            <button onClick={onViewAll} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
              View all documents →
            </button>
          )}
        </div>
      )}

      {!compact && entries.length > 0 && (
        <div className="mb-4 flex items-center justify-end gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          <button
            onClick={() => setView('grid')}
            className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'grid' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
            title="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'list' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-strong)] py-20 text-center">
          <HistoryIcon className="h-8 w-8 text-[var(--color-text-muted)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
        </div>
      ) : compact || view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <GridCard key={entry.id} entry={entry} onCompare={() => setCompareEntry(entry)} onDelete={() => handleDelete(entry.id)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          {visible.map((entry) => (
            <ListRow key={entry.id} entry={entry} onCompare={() => setCompareEntry(entry)} onDelete={() => handleDelete(entry.id)} />
          ))}
        </div>
      )}

      {compareEntry && <CompareModal entry={compareEntry} onClose={() => setCompareEntry(null)} />}
    </>
  )
}
