import { Check, RotateCcw, RotateCw } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ScanSession } from '../../hooks/useScanFlow'

const DISPLAY_MAX_WIDTH = 640
const DISPLAY_MAX_HEIGHT = 560
const HANDLE_RADIUS = 9


function useDisplayScale(session: ScanSession) {
  const scale = Math.min(DISPLAY_MAX_WIDTH / session.width, DISPLAY_MAX_HEIGHT / session.height, 1)
  return { scale, dispW: session.width * scale, dispH: session.height * scale }
}

export function AdjustStep({
  session,
  onUpdateCorners,
  onRotate,
  onConfirm,
  onResetCorners,
  originalCorners,
}: {
  session: ScanSession
  onUpdateCorners: (corners: [number, number][]) => void
  onRotate: (direction: 1 | -1) => void
  onConfirm: () => void
  onResetCorners: () => void
  originalCorners: [number, number][] | null
}) {
  const { scale, dispW, dispH } = useDisplayScale(session)
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const toDisplay = ([x, y]: [number, number]): [number, number] => [x * scale, y * scale]
  const toImage = ([x, y]: [number, number]): [number, number] => [x / scale, y / scale]

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIndex === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = Math.min(Math.max(e.clientX - rect.left, 0), dispW)
    const dy = Math.min(Math.max(e.clientY - rect.top, 0), dispH)
    const [ix, iy] = toImage([dx, dy])
    const next = [...session.corners] as [number, number][]
    next[draggingIndex] = [ix, iy]
    onUpdateCorners(next)
  }

  const stopDragging = () => setDraggingIndex(null)

  const displayCorners = session.corners.map(toDisplay)
  const polygonPoints = displayCorners.map(([x, y]) => `${x},${y}`).join(' ')

  const cornersChanged =
    originalCorners !== null &&
    JSON.stringify(originalCorners) !== JSON.stringify(session.corners)

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">Confirm the document edges</h2>
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
          We auto-detected these corners. Drag any handle to fine-tune it, or continue if it already looks right.
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative inline-block touch-none select-none overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black shadow-[var(--shadow-card)]"
        style={{ width: dispW, height: dispH }}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
      >
        <img
          src={session.preview}
          alt="uploaded document"
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
        <svg className="absolute inset-0" width={dispW} height={dispH}>
          <polygon
            points={polygonPoints}
            fill="rgba(16, 185, 129, 0.18)"
            stroke="var(--color-accent)"
            strokeWidth={2}
          />
          {displayCorners.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={HANDLE_RADIUS}
              fill="white"
              stroke="var(--color-accent)"
              strokeWidth={3}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setDraggingIndex(i)
              }}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => onRotate(-1)}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
        >
          <RotateCcw className="h-4 w-4" />
          Rotate left
        </button>
        <button
          onClick={() => onRotate(1)}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
        >
          <RotateCw className="h-4 w-4" />
          Rotate right
        </button>
        {cornersChanged && (
          <button
            onClick={onResetCorners}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Reset to detected
          </button>
        )}
        <button
          onClick={onConfirm}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Check className="h-4 w-4" />
          Confirm & process
        </button>
      </div>
    </div>
  )
}
