import type { EnhanceMode, OcrResult, ProcessResponse, UploadResponse } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return body.detail ?? fallback
  } catch {
    return fallback
  }
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Upload failed'))
  return res.json()
}

export async function processImage(
  id: string,
  corners: [number, number][],
  mode: EnhanceMode,
  upscale: boolean,
  rotationSteps: number,
): Promise<ProcessResponse> {
  const res = await fetch(apiUrl('/api/process'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, corners, mode, upscale, rotation_steps: rotationSteps }),
  })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Processing failed'))
  return res.json()
}

export async function fetchOcrText(id: string): Promise<OcrResult> {
  const res = await fetch(apiUrl(`/api/ocr/${id}`))
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Text extraction failed'))
  return res.json()
}

export async function exportPdf(imageBlob: Blob, variant: 'flattened' | 'searchable'): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', imageBlob, 'scan.png')
  const res = await fetch(apiUrl(`/api/export?ext=pdf&variant=${variant}`), { method: 'POST', body: formData })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'PDF export failed'))
  return res.blob()
}
