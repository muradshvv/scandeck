import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { apiUrl } from '../../api/client'
import { Stepper } from '../Stepper'
import { LoadingOverlay } from '../LoadingOverlay'
import { UploadStep } from '../steps/UploadStep'
import { AdjustStep } from '../steps/AdjustStep'
import { ResultStep } from '../steps/ResultStep'
import { HistoryPage } from './HistoryPage'
import { useToast } from '../ToastContext'
import type { ScanFlow } from '../../hooks/useScanFlow'
import type { Settings } from '../../hooks/useSettings'


export function ScanPage({
  flow,
  settings,
  onViewAllHistory,
}: {
  flow: ScanFlow
  settings: Settings
  onViewAllHistory: () => void
}) {
  const { showToast } = useToast()
  const downloadedResultRef = useRef<string | null>(null)

  useEffect(() => {
    if (!settings.autoDownload || !flow.result || downloadedResultRef.current === flow.result.download_url) return
    downloadedResultRef.current = flow.result.download_url
    const link = document.createElement('a')
    link.href = apiUrl(flow.result.download_url)
    link.download = 'scanned_document'
    link.click()
    showToast('Downloaded automatically')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoDownload, flow.result])

  const handleUpload = async (file: File) => {
    await flow.upload(file)
  }

  const handleConfirm = async () => {
    const ok = await flow.confirm(settings.defaultMode, settings.upscaleEnabled)
    if (ok) showToast('Scan complete')
  }

  return (
    <>
      <Stepper current={flow.step} />

      {flow.error && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          <span>{flow.error}</span>
          <button onClick={flow.clearError} className="shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {flow.step === 'upload' && (
        <>
          <UploadStep onUpload={handleUpload} />
          <div className="mt-10">
            <HistoryPage compact limit={3} onViewAll={onViewAllHistory} />
          </div>
        </>
      )}
      {flow.step === 'adjust' && flow.session && (
        <AdjustStep
          session={flow.session}
          onUpdateCorners={flow.updateCorners}
          onRotate={flow.rotate}
          onConfirm={handleConfirm}
          onResetCorners={flow.resetCorners}
          originalCorners={flow.session.detectedCorners}
        />
      )}
      {flow.step === 'result' && flow.result && (
        <ResultStep result={flow.result} onScanAnother={flow.reset} upscaleStatus={flow.upscaleStatus} />
      )}

      {flow.loading && <LoadingOverlay text={flow.loading} />}
    </>
  )
}
