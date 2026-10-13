import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from './paper'
import type { Point } from './types'
export function sealHalfExtent(size: number, angle: number): number {
  const radians = angle * Math.PI / 180
  return size * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))) / 2 + 6
}
export function clampSealPoint(point: Point, size: number, angle: number): Point {
  const margin = sealHalfExtent(size, angle)
  return { x: Math.max(margin, Math.min(DOCUMENT_WIDTH - margin, point.x)), y: Math.max(margin, Math.min(DOCUMENT_HEIGHT - margin, point.y)) }
}
