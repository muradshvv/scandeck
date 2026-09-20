import * as ort from 'onnxruntime-web'

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/'
ort.env.wasm.numThreads = 1

const MODEL_URL = `${import.meta.env.BASE_URL}models/ultra_hd_upscaler.onnx`
const TILE = 128
const TILE_PAD = 10
const TILE_SCALE = 4
const PADDED_SIZE = TILE + 2 * TILE_PAD
const MAX_SOURCE_DIM = 1400

let sessionPromise: Promise<ort.InferenceSession> | null = null

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })
  }
  return sessionPromise
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export async function upscaleTiled(
  img: HTMLImageElement,
  onProgress?: (done: number, total: number) => void,
): Promise<HTMLCanvasElement> {
  const session = await getSession()

  let w = img.naturalWidth
  let h = img.naturalHeight

  const srcCanvas = document.createElement('canvas')
  const scale = Math.min(1, MAX_SOURCE_DIM / Math.max(w, h))
  w = Math.round(w * scale)
  h = Math.round(h * scale)
  srcCanvas.width = w
  srcCanvas.height = h
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!
  srcCtx.drawImage(img, 0, 0, w, h)
  const { data: srcData } = srcCtx.getImageData(0, 0, w, h)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = w * TILE_SCALE
  outCanvas.height = h * TILE_SCALE
  const outCtx = outCanvas.getContext('2d')!

  const cols = Math.ceil(w / TILE)
  const rows = Math.ceil(h / TILE)
  const total = cols * rows
  let done = 0
  onProgress?.(0, total)

  const tileInput = new Float32Array(3 * PADDED_SIZE * PADDED_SIZE)
  const plane = PADDED_SIZE * PADDED_SIZE

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = col * TILE
      const ty = row * TILE
      const tw = Math.min(TILE, w - tx)
      const th = Math.min(TILE, h - ty)
      const px = tx - TILE_PAD
      const py = ty - TILE_PAD

      for (let y = 0; y < PADDED_SIZE; y++) {
        const sy = clamp(py + y, 0, h - 1)
        const rowOffset = sy * w
        for (let x = 0; x < PADDED_SIZE; x++) {
          const sx = clamp(px + x, 0, w - 1)
          const srcIdx = (rowOffset + sx) * 4
          const dstIdx = y * PADDED_SIZE + x
          tileInput[dstIdx] = srcData[srcIdx] / 255
          tileInput[plane + dstIdx] = srcData[srcIdx + 1] / 255
          tileInput[2 * plane + dstIdx] = srcData[srcIdx + 2] / 255
        }
      }

      const tensor = new ort.Tensor('float32', tileInput, [1, 3, PADDED_SIZE, PADDED_SIZE])
      const outputs = await session.run({ img: tensor })
      const output = outputs.output
      const outData = output.data as Float32Array
      const [, , outH, outW] = output.dims as number[]
      const outPlane = outW * outH

      const cropX = TILE_PAD * TILE_SCALE
      const cropY = TILE_PAD * TILE_SCALE
      const cropW = tw * TILE_SCALE
      const cropH = th * TILE_SCALE

      const rgba = new Uint8ClampedArray(cropW * cropH * 4)
      for (let yy = 0; yy < cropH; yy++) {
        const srcRow = (cropY + yy) * outW + cropX
        const dstRow = yy * cropW
        for (let xx = 0; xx < cropW; xx++) {
          const s = srcRow + xx
          const d = (dstRow + xx) * 4
          rgba[d] = clamp(outData[s], 0, 1) * 255
          rgba[d + 1] = clamp(outData[outPlane + s], 0, 1) * 255
          rgba[d + 2] = clamp(outData[2 * outPlane + s], 0, 1) * 255
          rgba[d + 3] = 255
        }
      }

      outCtx.putImageData(new ImageData(rgba, cropW, cropH), tx * TILE_SCALE, ty * TILE_SCALE)

      done++
      onProgress?.(done, total)
      await yieldToBrowser()
    }
  }

  return outCanvas
}

export function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = canvas.toDataURL('image/png')
  })
}
