import type { EnhanceMode, HistoryEntry, OcrResult, ProcessResponse, UploadResponse } from '../types'

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
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
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
  const res = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, corners, mode, upscale, rotation_steps: rotationSteps }),
  })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Processing failed'))
  return res.json()
}

export async function fetchOcrText(id: string): Promise<OcrResult> {
  const res = await fetch(`/api/ocr/${id}`)
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Text extraction failed'))
  return res.json()
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch('/api/history')
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to load history'))
  const body = await res.json()
  return body.entries
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const res = await fetch(`/api/history/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to delete history entry'))
}

export async function clearHistory(): Promise<void> {
  const res = await fetch('/api/history', { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to clear history'))
}
