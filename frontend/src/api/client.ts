import type { EnhanceMode, HistoryEntry, OcrResult, ProcessResponse, ProcessStatusResponse, UploadResponse } from '../types'

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

export async function fetchProcessStatus(id: string): Promise<ProcessStatusResponse> {
  const res = await fetch(apiUrl(`/api/process/${id}/status`))
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to check enhancement status'))
  return res.json()
}

export async function fetchOcrText(id: string): Promise<OcrResult> {
  const res = await fetch(apiUrl(`/api/ocr/${id}`))
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Text extraction failed'))
  return res.json()
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(apiUrl('/api/history'))
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to load history'))
  const body = await res.json()
  return body.entries
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/history/${id}`), { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to delete history entry'))
}

export async function clearHistory(): Promise<void> {
  const res = await fetch(apiUrl('/api/history'), { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to clear history'))
}
