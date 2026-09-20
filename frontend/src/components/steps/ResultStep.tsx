import { ChevronDown, Clipboard, Download, FileText, Loader2, RefreshCcw, ScanText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiUrl, fetchOcrText } from '../../api/client'
import { AdjustmentPanel } from '../AdjustmentPanel'
import { useToast } from '../ToastContext'
import { DEFAULT_ADJUST_PARAMS, renderAdjusted } from '../../lib/imageAdjust'
import type { AdjustParams } from '../../lib/imageAdjust'
import type { OcrResult, ProcessResponse } from '../../types'

async function toPngBlob(dataUrl: string): Promise<Blob> {
  // ClipboardItem only accepts image/png, results are often jpeg
  const img = new Image()
  img.src = dataUrl
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

type OcrState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: OcrResult }


const toolbarButtonClass =
  'flex h-11 items-center gap-2 px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'

function ExportMenu({ downloadUrl }: { downloadUrl: string }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  const pdfBase = downloadUrl.replace(/ext=\w+/, 'ext=pdf')

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
          <a
            href={`${pdfBase}&variant=flattened`}
            download="scanned_document.pdf"
            className="block px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
          >
            <div className="font-medium text-[var(--color-text)]">Standard PDF</div>
            <div className="text-xs text-[var(--color-text-muted)]">Image only, no text layer</div>
          </a>
          <a
            href={`${pdfBase}&variant=searchable`}
            download="scanned_document.pdf"
            className="block border-t border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
          >
            <div className="font-medium text-[var(--color-text)]">Searchable OCR PDF</div>
            <div className="text-xs text-[var(--color-text-muted)]">Adds a selectable text layer</div>
          </a>
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
  upscaleStatus,
}: {
  result: ProcessResponse
  onScanAnother: () => void
  upscaleStatus: 'idle' | 'running' | 'error'
}) {
  const { showToast } = useToast()

  const [params, setParams] = useState<AdjustParams>(DEFAULT_ADJUST_PARAMS)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const prevUpscaleStatus = useRef(upscaleStatus)

  useEffect(() => {
    setImgLoaded(false)
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
    if (prevUpscaleStatus.current === 'running' && upscaleStatus === 'idle') {
      showToast('Ultra HD upscale applied')
    } else if (prevUpscaleStatus.current === 'running' && upscaleStatus === 'error') {
      showToast('Ultra HD upscale failed - showing the standard scan instead', 'error')
    }
    prevUpscaleStatus.current = upscaleStatus
  }, [upscaleStatus, showToast])

  const handleCopy = async () => {
    try {
      const blob = await toPngBlob(result.result)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      showToast('Copied to clipboard')
    } catch {
      showToast('Copy failed, your browser may not support this', 'error')
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex max-h-[56vh] items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-3)] ring-1 ring-inset ring-black/5">
          <canvas ref={canvasRef} aria-label="scanned document" className="max-h-[56vh] max-w-full" />
        </div>
        {upscaleStatus === 'running' && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running Ultra HD upscale in the background - this can take a few minutes…
          </div>
        )}
      </div>

      <div className="inline-flex items-center divide-x divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <a
          href={apiUrl(result.download_url)}
          download="scanned_document"
          className="flex h-11 items-center gap-2 bg-[var(--color-accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
        <ExportMenu downloadUrl={apiUrl(result.download_url)} />
        <button onClick={handleCopy} className={toolbarButtonClass}>
          <Clipboard className="h-4 w-4" />
          Copy
        </button>
        <button onClick={onScanAnother} className={toolbarButtonClass}>
          <RefreshCcw className="h-4 w-4" />
          Scan another
        </button>
      </div>

      <ExtractedText id={result.id} />

      <AdjustmentPanel params={params} onParamsChange={setParams} canvasRef={canvasRef} />
    </div>
  )
}
