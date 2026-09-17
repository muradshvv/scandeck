import { useCallback, useState } from 'react'
import { processImage, uploadImage } from '../api/client'
import { rotateCorners, rotatedDims, rotateImageDataUrl } from '../lib/rotate'
import type { EnhanceMode, ProcessResponse, ScanStep } from '../types'

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
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const confirm = useCallback(async (mode: EnhanceMode, upscale: boolean): Promise<boolean> => {
    if (!session) return false
    setError(null)
    setLoading(upscale ? 'Cropping & enhancing (upscale takes longer)…' : 'Cropping & enhancing…')
    try {
      const processData = await processImage(session.id, session.corners, mode, upscale, session.rotationSteps)
      setResult(processData)
      setStep('result')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      return false
    } finally {
      setLoading(null)
    }
  }, [session])

  const reset = useCallback(() => {
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
