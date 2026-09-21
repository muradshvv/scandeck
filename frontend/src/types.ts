export type EnhanceMode = 'color' | 'gray' | 'bw'

export type ScanStep = 'upload' | 'adjust' | 'result'


export type Page = 'scan' | 'history' | 'settings'

export interface UploadResponse {
  id: string
  width: number
  height: number
  corners: [number, number][]
  preview: string
}


export interface ProcessResponse {
  id: string
  result: string
  download_url: string
}


export interface OcrResult {
  text: string
  confidence: number
  word_count: number
}
