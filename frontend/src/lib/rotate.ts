// kept in sync with scanner.py::rotate_image_steps (cv2.rotate) geometry

export type Point = [number, number]

export function rotatedDims(w: number, h: number, steps: number): { w: number; h: number } {
  return steps % 2 === 0 ? { w, h } : { w: h, h: w }
}

export function rotatePoint([x, y]: Point, w: number, h: number, steps: number): Point {
  const s = ((steps % 4) + 4) % 4
  if (s === 1) return [h-1-y, x]
  if (s === 2) return [w - 1 - x, h - 1 - y]
  if (s === 3) return [y, w - 1 - x]
  return [x, y]
}

export function rotateCorners(corners: Point[], w: number, h: number, steps: number): Point[] {
  return corners.map((p) => rotatePoint(p, w, h, steps))
}

export function rotateImageDataUrl(img: HTMLImageElement, w: number, h: number, steps: number): string {
  const s = ((steps % 4) + 4) % 4
  const { w: outW, h: outH } = rotatedDims(w, h, s)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((s * 90 * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return canvas.toDataURL('image/png')
}
