import { useCallback, useRef, useState } from 'react'
import { fetchProcessStatus, processImage, uploadImage } from '../api/client'
import { rotateCorners, rotatedDims, rotateImageDataUrl } from '../lib/rotate'
import type { EnhanceMode, ProcessResponse, ScanStep } from '../types'

const UPSCALE_POLL_INTERVAL_MS = 3000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export interface ScanSession {
  id: string
  preview: string
  width: number
  height: number
  corners: [number, number][]
  detectedCorners: [number, number][]
  rotationSteps: number
}


export function useScanFlow() {
  const [step, setStep] = useState<ScanStep>('upload')
  const [session, setSession] = useState<ScanSession | null>(null)
  const activePollId = useRef<string | null>(null)
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upscaleStatus, setUpscaleStatus] = useState<'idle' | 'running' | 'error'>('idle')

  const upload = useCallback(async (file: File): Promise<boolean> => {
    setError(null)
    setLoading('Uploading & detecting document…')
    try {
      const data = await uploadImage(file)
      setSession({
        id: data.id,
        preview: data.preview,
        width: data.width,
        height: data.height,
        corners: data.corners,
        detectedCorners: data.corners,
        rotationSteps: 0,
      })
      setStep('adjust')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return false
    } finally {
      setLoading(null)
    }
  }, [])

  const updateCorners = useCallback((corners: [number, number][]) => {
    setSession((prev) => (prev ? { ...prev, corners } : prev))
  }, [])

  const rotate = useCallback(async (direction: 1 | -1) => {
    if (!session) return
    const steps = direction === 1 ? 1 : 3
    const { preview, width, height, corners, detectedCorners, rotationSteps } = session

    const img = await loadImage(preview)
    const rotatedPreview = rotateImageDataUrl(img, width, height, steps)
    const { w: newW, h: newH } = rotatedDims(width, height, steps)

    setSession({
      ...session,
      preview: rotatedPreview,
      width: newW,
      height: newH,
      corners: rotateCorners(corners, width, height, steps),
      detectedCorners: rotateCorners(detectedCorners, width, height, steps),
      rotationSteps: (rotationSteps + direction + 4) % 4,
    })
  }, [session])

  const resetCorners = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, corners: prev.detectedCorners } : prev))
  }, [])

  const pollUpscale = useCallback(async (id: string) => {
    activePollId.current = id
    setUpscaleStatus('running')
    // this can take several minutes on a free-tier server since the model
    // runs on small tiles to stay within its memory limits
    for (let attempt = 0; attempt < 200; attempt++) {
      await sleep(UPSCALE_POLL_INTERVAL_MS)
      if (activePollId.current !== id) return
      try {
        const status = await fetchProcessStatus(id)
        if (activePollId.current !== id) return
        if (status.status === 'done' && status.result && status.download_url) {
          setResult((prev) => (prev && prev.id === id ? { ...prev, result: status.result!, download_url: status.download_url! } : prev))
          setUpscaleStatus('idle')
          return
        }
        if (status.status === 'error') {
          setUpscaleStatus('error')
          return
        }
      } catch {
        setUpscaleStatus('error')
        return
      }
    }
    setUpscaleStatus('error')
  }, [])

  const confirm = useCallback(async (mode: EnhanceMode, upscale: boolean): Promise<boolean> => {
    if (!session) return false
    setError(null)
    setLoading('Cropping & enhancing…')
    try {
      const processData = await processImage(session.id, session.corners, mode, upscale, session.rotationSteps)
      setResult(processData)
      setStep('result')
      if (processData.upscale_pending) {
        pollUpscale(processData.id)
      } else {
        activePollId.current = null
        setUpscaleStatus('idle')
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      return false
    } finally {
      setLoading(null)
    }
  }, [session, pollUpscale])

  const reset = useCallback(() => {
    activePollId.current = null
    setUpscaleStatus('idle')
    setSession(null)
    setResult(null)
    setError(null)
    setStep('upload')
  }, [])

  return {
    step,
    session,
    result,
    loading,
    error,
    upscaleStatus,
    clearError: () => setError(null),
    upload,
    updateCorners,
    resetCorners,
    rotate,
    confirm,
    reset,
  }
}

export type ScanFlow = ReturnType<typeof useScanFlow>
