import { Download, Clipboard, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import type { RefObject } from 'react'
import { useToast } from './ToastContext'
import { DEFAULT_ADJUST_PARAMS } from '../lib/imageAdjust'
import type { AdjustParams } from '../lib/imageAdjust'


function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
  neutral,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
  neutral: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-mono text-[var(--color-text-muted)]">
          {value > neutral ? '+' : ''}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-surface-3)] accent-[var(--color-accent)]"
      />
    </div>
  )
}

function CheckboxControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
      <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4 last:border-b-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</h4>
      {children}
    </div>
  )
}

export function AdjustmentPanel({
  params,
  onParamsChange,
  canvasRef,
}: {
  params: AdjustParams
  onParamsChange: (params: AdjustParams) => void
  canvasRef: RefObject<HTMLCanvasElement | null>
}) {
  const [open, setOpen] = useState(true)
  const { showToast } = useToast()

  const set = <K extends keyof AdjustParams>(key: K, value: AdjustParams[K]) => {
    onParamsChange({ ...params, [key]: value })
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'scanned_document_adjusted.png'
    link.click()
    showToast('Adjusted image downloaded')
  }

  const handleCopy = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) return
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        showToast('Adjusted image copied to clipboard')
      } catch {
        showToast('Copy failed, your browser may not support this', 'error')
      }
    }, 'image/png')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-4 text-[var(--color-text-secondary)] shadow-[var(--shadow-card)] transition-opacity hover:text-[var(--color-accent)] ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        title="Open adjustments"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>

      <div
        className={`fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)] transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Adjustments</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onParamsChange(DEFAULT_ADJUST_PARAMS)}
              title="Reset all adjustments"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title="Geometry">
            <SliderControl label="Fine rotate" value={params.rotateFine} min={-15} max={15} suffix="°" neutral={0} onChange={(v) => set('rotateFine', v)} />
            <CheckboxControl label="Flip horizontal" checked={params.flipHorizontal} onChange={(v) => set('flipHorizontal', v)} />
            <CheckboxControl label="Flip vertical" checked={params.flipVertical} onChange={(v) => set('flipVertical', v)} />
          </Section>

          <Section title="Light">
            <SliderControl label="Brightness" value={params.brightness} min={-100} max={100} neutral={0} onChange={(v) => set('brightness', v)} />
            <SliderControl label="Exposure" value={params.exposure} min={-100} max={100} neutral={0} onChange={(v) => set('exposure', v)} />
            <SliderControl label="Contrast" value={params.contrast} min={-100} max={100} neutral={0} onChange={(v) => set('contrast', v)} />
            <SliderControl label="Gamma" value={params.gamma} min={50} max={250} suffix="%" neutral={100} onChange={(v) => set('gamma', v)} />
            <CheckboxControl label="Auto levels" checked={params.autoLevels} onChange={(v) => set('autoLevels', v)} />
          </Section>

          <Section title="Color">
            <SliderControl label="Saturation" value={params.saturation} min={0} max={200} suffix="%" neutral={100} onChange={(v) => set('saturation', v)} />
            <SliderControl label="Warmth" value={params.warmth} min={-100} max={100} neutral={0} onChange={(v) => set('warmth', v)} />
            <SliderControl label="Tint" value={params.tint} min={-100} max={100} neutral={0} onChange={(v) => set('tint', v)} />
            <SliderControl label="Sepia" value={params.sepia} min={0} max={100} suffix="%" neutral={0} onChange={(v) => set('sepia', v)} />
            <CheckboxControl label="Invert colors" checked={params.invert} onChange={(v) => set('invert', v)} />
          </Section>

          <Section title="Detail">
            <SliderControl label="Sharpen" value={params.sharpen} min={0} max={100} neutral={0} onChange={(v) => set('sharpen', v)} />
            <SliderControl label="Smooth / denoise" value={params.denoise} min={0} max={100} neutral={0} onChange={(v) => set('denoise', v)} />
            <SliderControl label="Vignette" value={params.vignette} min={0} max={100} neutral={0} onChange={(v) => set('vignette', v)} />
          </Section>

          <Section title="Black & white">
            <CheckboxControl label="Force threshold" checked={params.thresholdEnabled} onChange={(v) => set('thresholdEnabled', v)} />
            {params.thresholdEnabled && (
              <SliderControl label="Threshold level" value={params.thresholdLevel} min={0} max={255} neutral={128} onChange={(v) => set('thresholdLevel', v)} />
            )}
          </Section>
        </div>

        <div className="flex gap-2 border-t border-[var(--color-border)] p-4">
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            <Download className="h-3.5 w-3.5" />
            Download adjusted
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      </div>
    </>
  )
}
