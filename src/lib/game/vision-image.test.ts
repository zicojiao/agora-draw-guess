import { expect, it } from 'vitest'
import { drawingBounds } from './vision-image'
const width = 200, height = 150
function image() { return new Uint8ClampedArray(width * height * 4).fill(255) }
function pixel(p: Uint8ClampedArray, x: number, y: number, rgba: number[]) { p.set(rgba, (y * width + x) * 4) }
it('leaves blank and transparent boards alone', () => {
  expect(drawingBounds(image(), width, height)).toBeNull()
  expect(drawingBounds(new Uint8ClampedArray(width * height * 4), width, height)).toBeNull()
})
it('preserves thin colored strokes, disconnected parts and padding', () => {
  const p = image()
  pixel(p, 40, 50, [255, 220, 70, 255]); pixel(p, 130, 90, [0, 150, 230, 255])
  const bounds = drawingBounds(p, width, height)!
  expect(bounds.x).toBeLessThan(40); expect(bounds.y).toBeLessThan(50)
  expect(bounds.x + bounds.width).toBeGreaterThan(130); expect(bounds.y + bounds.height).toBeGreaterThan(90)
  expect(bounds.width).toBeLessThan(width)
})
it('never cuts off strokes at the edge or stretches outside the image', () => {
  const p = image()
  pixel(p, 0, 0, [0, 0, 0, 255]); pixel(p, 199, 149, [0, 0, 0, 255])
  expect(drawingBounds(p, width, height)).toEqual({ x: 0, y: 0, width, height })
})
