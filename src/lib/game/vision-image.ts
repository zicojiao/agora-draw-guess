export type DrawingBounds = { x: number; y: number; width: number; height: number }

/** Scan every pixel so thin and pale colored strokes survive the crop. */
export function drawingBounds(pixels: Uint8ClampedArray, width: number, height: number): DrawingBounds | null {
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, alpha = pixels[i + 3] / 255
    // Composite transparent snapshots onto white before comparing.
    const darkest = Math.min(pixels[i], pixels[i + 1], pixels[i + 2])
    if (alpha * (255 - darkest) < 18) continue
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (right < left) return null
  const padding = Math.max(20, Math.ceil(Math.max(right - left + 1, bottom - top + 1) * .12))
  const x = Math.max(0, left - padding), y = Math.max(0, top - padding)
  return { x, y, width: Math.min(width, right + padding + 1) - x, height: Math.min(height, bottom + padding + 1) - y }
}

/** Only the AI copy is cropped. The shared board retains its original coordinates. */
export async function prepareVisionImage(image: string): Promise<string | null> {
  const bitmap = await createImageBitmap(await (await fetch(image)).blob())
  try {
    const source = document.createElement('canvas')
    source.width = bitmap.width; source.height = bitmap.height
    const ctx = source.getContext('2d', { willReadFrequently: true })
    if (!ctx) return image
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, source.width, source.height); ctx.drawImage(bitmap, 0, 0)
    const bounds = drawingBounds(ctx.getImageData(0, 0, source.width, source.height).data, source.width, source.height)
    if (!bounds) return null
    const scale = Math.min(2, 640 / Math.max(bounds.width, bounds.height))
    const target = document.createElement('canvas')
    target.width = Math.max(1, Math.round(bounds.width * scale)); target.height = Math.max(1, Math.round(bounds.height * scale))
    const output = target.getContext('2d')!
    output.fillStyle = '#fff'; output.fillRect(0, 0, target.width, target.height)
    output.imageSmoothingQuality = 'high'
    output.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, target.width, target.height)
    return target.toDataURL('image/png')
  } finally { bitmap.close() }
}
