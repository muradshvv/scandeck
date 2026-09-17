export interface AdjustParams {
  brightness: number // -100..100, additive
  exposure: number // -100..100, multiplicative gain
  contrast: number // -100..100
  saturation: number // 0..200 (%)
  gamma: number // 50..250, represents 0.50..2.50
  warmth: number // -100..100
  tint: number // -100..100
  sharpen: number // 0..100
  denoise: number // 0..100 (blur-based smoothing)
  vignette: number // 0..100
  sepia: number // 0..100
  rotateFine: number // -15..15 degrees
  invert: boolean
  flipHorizontal: boolean
  flipVertical: boolean
  autoLevels: boolean
  thresholdEnabled: boolean
  thresholdLevel: number // 0..255
}

export const DEFAULT_ADJUST_PARAMS: AdjustParams = {
  brightness: 0,
  exposure: 0,
  contrast: 0,
  saturation: 100,
  gamma: 100,
  warmth: 0,
  tint: 0,
  sharpen: 0,
  denoise: 0,
  vignette: 0,
  sepia: 0,
  rotateFine: 0,
  invert: false,
  flipHorizontal: false,
  flipVertical: false,
  autoLevels: false,
  thresholdEnabled: false,
  thresholdLevel: 128,
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}


function needsPixelPass(p: AdjustParams) {
  return (
    p.exposure !== 0 ||
    p.gamma !== 100 ||
    p.warmth !== 0 ||
    p.tint !== 0 ||
    p.autoLevels ||
    p.thresholdEnabled
  )
}


function applyPixelPass(data: Uint8ClampedArray, p: AdjustParams) {
  const expFactor = Math.pow(2, p.exposure/100)
  const invGamma = 1 / (p.gamma / 100)

  let minR = 255, minG = 255, minB = 255, maxR = 0, maxG = 0, maxB = 0
  if (p.autoLevels) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < minR) minR = data[i]
      if (data[i] > maxR) maxR = data[i]
      if (data[i + 1] < minG) minG = data[i + 1]
      if (data[i + 1] > maxG) maxG = data[i + 1]
      if (data[i + 2] < minB) minB = data[i + 2]
      if (data[i + 2] > maxB) maxB = data[i + 2]
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    if (p.autoLevels) {
      if (maxR > minR) r = ((r - minR) * 255) / (maxR - minR)
      if (maxG > minG) g = ((g - minG) * 255) / (maxG - minG)
      if (maxB > minB) b = ((b - minB) * 255) / (maxB - minB)
    }

    if (p.exposure !== 0) {
      r *= expFactor
      g *= expFactor
      b *= expFactor
    }

    if (p.gamma !== 100) {
      r = 255 * Math.pow(clamp255(r) / 255, invGamma)
      g = 255 * Math.pow(clamp255(g) / 255, invGamma)
      b = 255 * Math.pow(clamp255(b) / 255, invGamma)
    }

    if (p.warmth !== 0) {
      r += p.warmth * 0.5
      b -= p.warmth * 0.5
    }
    if (p.tint !== 0) {
      g += p.tint * 0.5
      r -= p.tint * 0.25
      b -= p.tint * 0.25
    }

    if (p.thresholdEnabled) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      const v = gray > p.thresholdLevel ? 255 : 0
      r = g = b = v
    }

    data[i] = clamp255(r)
    data[i + 1] = clamp255(g)
    data[i + 2] = clamp255(b)
  }
}


function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const original = ctx.getImageData(0, 0, w, h)
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d')!
  tctx.filter = 'blur(2px)'
  tctx.drawImage(ctx.canvas, 0, 0)
  const blurred = tctx.getImageData(0, 0, w, h)

  const amt = (amount / 100) * 1.5
  const od = original.data
  const bd = blurred.data
  for (let i = 0; i < od.length; i += 4) {
    od[i] = clamp255(od[i] + amt * (od[i] - bd[i]))
    od[i + 1] = clamp255(od[i + 1] + amt * (od[i + 1] - bd[i + 1]))
    od[i + 2] = clamp255(od[i + 2] + amt * (od[i + 2] - bd[i + 2]))
  }
  ctx.putImageData(original, 0, 0)
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.3,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  )
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, `rgba(0,0,0,${(amount / 100) * 0.85})`)
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

export function renderAdjusted(canvas: HTMLCanvasElement, img: HTMLImageElement, p: AdjustParams) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((p.rotateFine * Math.PI) / 180)
  ctx.scale(p.flipHorizontal ? -1 : 1, p.flipVertical ? -1 : 1)

  const filters: string[] = []
  filters.push(`brightness(${100 + p.brightness}%)`)
  filters.push(`contrast(${100 + p.contrast}%)`)
  filters.push(`saturate(${p.saturation}%)`)
  if (p.sepia > 0) filters.push(`sepia(${p.sepia}%)`)
  if (p.invert) filters.push('invert(100%)')
  if (p.denoise > 0) filters.push(`blur(${((p.denoise / 100) * 2.5).toFixed(2)}px)`)
  ctx.filter = filters.join(' ')

  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
  ctx.filter = 'none'

  if (needsPixelPass(p)) {
    const imageData = ctx.getImageData(0, 0, w, h)
    applyPixelPass(imageData.data, p)
    ctx.putImageData(imageData, 0, 0)
  }

  if (p.sharpen > 0) applySharpen(ctx, w, h, p.sharpen)
  if (p.vignette > 0) applyVignette(ctx, w, h, p.vignette)
}
