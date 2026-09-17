import { Check, ChevronRight } from 'lucide-react'
import type { ScanStep } from '../types'

const STEPS: { key: ScanStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'adjust', label: 'Confirm' },
  { key: 'result', label: 'Done' },
]

export function Stepper({ current }: { current: ScanStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current)

  return (
    <div className="mb-8 flex items-stretch overflow-hidden rounded-lg border border-[var(--color-border)]">
      {STEPS.map((s, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex
        return (
          <div key={s.key} className="flex flex-1 items-center">
            <div
              className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : isDone
                    ? 'text-[var(--color-text-secondary)]'
                    : 'text-[var(--color-text-muted)]'
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-border-strong)]" />}
          </div>
        )
      })}
    </div>
  )
}
