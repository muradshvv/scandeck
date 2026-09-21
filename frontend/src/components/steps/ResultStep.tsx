import { ChevronDown, Clipboard, Download, FileText, Loader2, Maximize2, RefreshCcw, ScanText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { exportPdf, fetchOcrText, pingBackend } from '../../api/client'
import { AdjustmentPanel } from '../AdjustmentPanel'
import { useToast } from '../ToastContext'
import { DEFAULT_ADJUST_PARAMS, renderAdjusted } from '../../lib/imageAdjust'
import { canvasToImage, upscaleTiled } from '../../lib/upscale'
import { canvasToBlob, downloadBlob, listHistoryEntries, makeThumbnail, upsertHistoryEntry } from '../../lib/historyStore'
import type { AdjustParams } from '../../lib/imageAdjust'
import type { OcrResult, ProcessResponse } from '../../types'

type OcrState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: OcrResult }


const toolbarButtonClass =
  'flex h-11 items-center gap-2 px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'

function ExportMenu({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const { showToast } = useToast()

  const handleExport = async (variant: 'flattened' | 'searchable') => {
    setOpen(false)
    if (!canvasRef.current) return
    try {
      const blob = await canvasToBlob(canvasRef.current)
      const pdfBlob = await exportPdf(blob, variant)
      downloadBlob(pdfBlob, 'scanned_document.pdf')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF export failed', 'error')
    }
  }

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        closeTimer.current = window.setTimeout(() => setOpen(false), 150)
      }}
      onMouseEnter={() => window.clearTimeout(closeTimer.current)}
    >
      <button onClick={() => setOpen((v) => !v)} className={toolbarButtonClass}>
        <FileText className="h-4 w-4" />
        Export PDF
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
          <button
            onClick={() => handleExport('flattened')}
            className="block w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
          >
            <div className="font-medium text-[var(--color-text)]">Standard PDF</div>
            <div className="text-xs text-[var(--color-text-muted)]">Image only, no text layer</div>
          </button>
          <button
            onClick={() => handleExport('searchable')}
            className="block w-full border-t border-[var(--color-border)] px-4 py-2.5 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
          >
            <div className="font-medium text-[var(--color-text)]">Searchable OCR PDF</div>
            <div className="text-xs text-[var(--color-text-muted)]">Adds a selectable text layer</div>
          </button>
        </div>
      )}
    </div>
  )
}


function ExtractedText({ id }: { id: string }) {
  const { showToast } = useToast()
  const [state, setState] = useState<OcrState>({ status: 'idle' })

  const load = async () => {
    setState({ status: 'loading' })
    try {
      const data = await fetchOcrText(id)
      setState({ status: 'loaded', data })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Text extraction failed'
      if (message.toLowerCase().includes('ocr requires')) {
        setState({ status: 'unavailable' })
      } else {
        setState({ status: 'error', message })
      }
    }
  }

  const copyText = async () => {
    if (state.status !== 'loaded') return
    try {
      await navigator.clipboard.writeText(state.data.text)
      showToast('Extracted text copied to clipboard')
    } catch {
      showToast('Copy failed, your browser may not support this', 'error')
    }
  }

  if (state.status === 'idle') {
    return (
      <button
        onClick={load}
        className="flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
      >
        <ScanText className="h-3.5 w-3.5" />
        Extract text
      </button>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] px-4 text-xs text-[var(--color-text-muted)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Extracting text…
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <div className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
        OCR isn't installed on this server (optional dependency, see <code>requirements-ocr.txt</code>).
      </div>
    )
  }

  if (state.status === 'error') {
    return <div className="rounded-lg border border-[var(--color-danger)]/30 px-4 py-2.5 text-xs text-[var(--color-danger)]">{state.message}</div>
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono">{state.data.word_count} words</span>
          <span>·</span>
          <span className="font-mono">{Math.round(state.data.confidence * 100)}% confidence</span>
        </div>
        <button
          onClick={copyText}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Copy text
        </button>
      </div>
      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-[var(--color-text-secondary)]">
        {state.data.text || '(no text detected)'}
      </pre>
    </div>
  )
}

export function ResultStep({
  result,
  onScanAnother,
  autoAiUpscale,
}: {
  result: ProcessResponse
  onScanAnother: () => void
  autoAiUpscale: boolean
}) {
  const { showToast } = useToast()

  const [params, setParams] = useState<AdjustParams>(DEFAULT_ADJUST_PARAMS)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [upscaleStatus, setUpscaleStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [upscaleProgress, setUpscaleProgress] = useState<{ done: number; total: number } | null>(null)
  const upscaleAttempted = useRef(false)

  useEffect(() => {
    setImgLoaded(false)
    upscaleAttempted.current = false
    setUpscaleStatus('idle')
    setUpscaleProgress(null)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
    img.src = result.result
    setParams(DEFAULT_ADJUST_PARAMS)
  }, [result.result])

  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return
    renderAdjusted(canvasRef.current, imgRef.current, params)
  }, [params, imgLoaded])

  useEffect(() => {
    if (upscaleStatus !== 'running') return
    pingBackend()
    const interval = setInterval(pingBackend, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [upscaleStatus])

  const handleAiUpscale = useCallback(async () => {
    if (!imgRef.current || !canvasRef.current) return
    setUpscaleStatus('running')
    setUpscaleProgress(null)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    try {
      const canvas = await upscaleTiled(imgRef.current, (done, total) => setUpscaleProgress({ done, total }))
      imgRef.current = await canvasToImage(canvas)
      renderAdjusted(canvasRef.current, imgRef.current, params)
      setUpscaleStatus('idle')
      setUpscaleProgress(null)
      showToast('Ultra HD upscale applied - click the photo to see it at full size')

      try {
        const existing = (await listHistoryEntries()).find((e) => e.id === result.id)
        if (existing) {
          await upsertHistoryEntry({
            ...existing,
            upscaled: true,
            width: canvas.width,
            height: canvas.height,
            thumbnail: makeThumbnail(canvas),
            imageBlob: await canvasToBlob(canvas),
          })
        }
      } catch (err) {
        console.error('Failed to update history entry after upscale', err)
      }
    } catch (err) {
      console.error(err)
      setUpscaleStatus('error')
      setUpscaleProgress(null)
      showToast('Ultra HD upscale failed - showing the standard scan instead', 'error')
    }
  }, [params, showToast, result.id])

  useEffect(() => {
    if (!imgLoaded || !autoAiUpscale || upscaleAttempted.current) return
    upscaleAttempted.current = true
    handleAiUpscale()
  }, [imgLoaded, autoAiUpscale, handleAiUpscale])

  const handleCopy = async () => {
    if (!canvasRef.current) return
    try {
      const blob = await canvasToBlob(canvasRef.current)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      showToast('Copied to clipboard')
    } catch {
      showToast('Copy failed, your browser may not support this', 'error')
    }
  }

  const handleDownload = async () => {
    if (!canvasRef.current) return
    try {
      const blob = await canvasToBlob(canvasRef.current)
      downloadBlob(blob, 'scanned_document.png')
    } catch {
      showToast('Download failed, your browser may not support this', 'error')
    }
  }

  const handleViewFullSize = () => {
    if (!canvasRef.current) return
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        showToast('Could not open full size view', 'error')
        return
      }
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    }, 'image/png')
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-[var(--shadow-card)]">
        <button
          onClick={handleViewFullSize}
          className="group relative flex max-h-[56vh] items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-3)] ring-1 ring-inset ring-black/5"
          title="View at full resolution"
        >
          <canvas ref={canvasRef} aria-label="scanned document" className="max-h-[56vh] max-w-full" />
          <div className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
            <span className="flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2 text-sm font-medium text-white">
              <Maximize2 className="h-4 w-4" />
              View full size
            </span>
          </div>
        </button>
        {upscaleStatus === 'running' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running Ultra HD upscale in your browser - this can take a while, keep this tab open…
            </div>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--color-surface-3)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                style={{
                  width: upscaleProgress
                    ? `${Math.min(100, Math.round((upscaleProgress.done / Math.max(1, upscaleProgress.total)) * 100))}%`
                    : '8%',
                }}
              />
            </div>
            {upscaleProgress && (
              <div className="text-[11px] text-[var(--color-text-muted)]">
                {upscaleProgress.done} / {upscaleProgress.total} tiles
              </div>
            )}
          </div>
        )}
      </div>

      <div className="inline-flex items-center divide-x divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <button
          onClick={handleDownload}
          className="flex h-11 items-center gap-2 rounded-l-lg bg-[var(--color-accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        <ExportMenu canvasRef={canvasRef} />
        <button onClick={handleCopy} className={toolbarButtonClass}>
          <Clipboard className="h-4 w-4" />
          Copy
        </button>
        <button onClick={onScanAnother} className={`${toolbarButtonClass} rounded-r-lg`}>
          <RefreshCcw className="h-4 w-4" />
          Scan another
        </button>
      </div>

      <ExtractedText id={result.id} />

      <AdjustmentPanel params={params} onParamsChange={setParams} canvasRef={canvasRef} />
    </div>
  )
}
