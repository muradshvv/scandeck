import { UploadCloud, Hand, Lightbulb, Maximize, Palette, Plus, ScanLine } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

const TIPS = [
  { icon: Lightbulb, text: 'Even, bright lighting avoids harsh shadows on the page.' },
  { icon: Maximize, text: 'Fill the frame so the document takes up most of the shot.' },
  { icon: Palette, text: 'A contrasting background (dark desk, light page) helps corner detection.' },
  { icon: Hand, text: 'Lay the document flat. Clipboards, held pages, and hands in frame can confuse detection.' },
]


export function UploadStep({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert('Please upload a JPG or PNG image.')
        return
      }
      onUpload(file)
    },
    [onUpload],
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={
          'flex min-h-[380px] cursor-pointer flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed shadow-[var(--shadow-card)] transition-colors ' +
          (dragOver
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50')
        }
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-accent-soft)]">
          <ScanLine className="h-9 w-9 text-[var(--color-accent)]" strokeWidth={1.5} />
          <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-accent)]">
            <Plus className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight text-[var(--color-text)]">Drag a document here, or click to upload</p>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            <UploadCloud className="h-3.5 w-3.5" />
            JPG or PNG, up to 20MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      <aside className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Tips for best results</h3>
        <ul className="flex flex-col gap-3">
          {TIPS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-[var(--color-text-secondary)]">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
