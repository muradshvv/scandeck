import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './ToastContext'
import type { ToastKind } from './ToastContext'


interface Toast {
  id: number
  message: string
  kind: ToastKind
}

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const COLORS: Record<ToastKind, string> = {
  success: 'border-[var(--color-success)]/30 text-[var(--color-success)]',
  error: 'border-[var(--color-danger)]/30 text-[var(--color-danger)]',
  info: 'border-[var(--color-accent)]/30 text-[var(--color-accent)]',
}


export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 rounded-xl border bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium shadow-lg ${COLORS[t.kind]}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[var(--color-text)]">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
