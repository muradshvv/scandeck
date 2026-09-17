import { GripVertical } from 'lucide-react'
import { useRef, useState } from 'react'


export function BeforeAfterSlider({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const updateFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, pct)))
  }

  return (
    <div
      ref={containerRef}
      className="relative max-h-[60vh] w-full touch-none overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black select-none"
      onPointerMove={(e) => draggingRef.current && updateFromClientX(e.clientX)}
      onPointerUp={() => (draggingRef.current = false)}
      onPointerLeave={() => (draggingRef.current = false)}
    >
      <img src={afterSrc} alt="scanned result" className="block max-h-[60vh] w-full object-contain" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={beforeSrc} alt="original photo" className="block h-full max-h-[60vh] w-full object-contain" draggable={false} />
      </div>

      <div
        className="absolute top-0 bottom-0 flex w-0 items-center justify-center"
        style={{ left: `${position}%` }}
      >
        <div className="absolute h-full w-px bg-white/70" />
        <button
          onPointerDown={(e) => {
            draggingRef.current = true
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          }}
          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 border-white bg-[var(--color-accent)] text-white shadow-lg active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white">Before</span>
      <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white">After</span>
    </div>
  )
}
