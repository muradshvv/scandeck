import type { EnhanceMode } from '../types'

export interface LocalHistoryEntry {
  id: string
  created_at: string
  mode: EnhanceMode
  upscaled: boolean
  width: number
  height: number
  ext: 'jpg' | 'png'
  thumbnail: string
  before_thumbnail: string
  imageBlob: Blob
}

const DB_NAME = 'scandeck-history'
const STORE = 'entries'
const DB_VERSION = 1
const MAX_ENTRIES = 300

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function upsertHistoryEntry(entry: LocalHistoryEntry): Promise<void> {
  await withStore('readwrite', (store) => store.put(entry))

  const all = await listHistoryEntries()
  if (all.length > MAX_ENTRIES) {
    const overflow = all.slice(MAX_ENTRIES)
    for (const e of overflow) {
      await deleteHistoryEntry(e.id)
    }
  }
}

export async function listHistoryEntries(): Promise<LocalHistoryEntry[]> {
  const all = await withStore<LocalHistoryEntry[]>('readonly', (store) => store.getAll())
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

export async function clearHistoryEntries(): Promise<void> {
  await withStore('readwrite', (store) => store.clear())
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export function makeThumbnail(source: HTMLImageElement | HTMLCanvasElement, maxDim = 480): string {
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), type)
  })
}
