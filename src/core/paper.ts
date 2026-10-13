import { mulberry32 } from './noise'

export type PaperKey = 'parchment' | 'ivory' | 'night'
export const PAPERS = [
  { key: 'parchment', label: '古宣', color: '#e5d6b5', text: '#493e30' },
  { key: 'ivory', label: '素笺', color: '#f2efe6', text: '#3c413e' },
  { key: 'night', label: '玄金', color: '#202925', text: '#dbcfaa' },
] as const
export const DOCUMENT_WIDTH = 1200
export const DOCUMENT_HEIGHT = 800

const cache = new Map<PaperKey, HTMLCanvasElement>()
export function renderPaper(theme: PaperKey): HTMLCanvasElement {
  const hit = cache.get(theme)
  if (hit) return hit
  const w = DOCUMENT_WIDTH, h = DOCUMENT_HEIGHT
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const paper = PAPERS.find(p => p.key === theme) ?? PAPERS[0]
  ctx.fillStyle = paper.color
  ctx.fillRect(0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const random = mulberry32(0xc0ffee)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (random() - 0.5) * 13
    for (let j = 0; j < 3; j++) img.data[i + j] += n
  }
  ctx.putImageData(img, 0, 0)
  const shade = ctx.createRadialGradient(w / 2, h / 2, h * .1, w / 2, h / 2, w * .65)
  shade.addColorStop(0, 'rgba(97,65,28,0)')
  shade.addColorStop(1, theme === 'night' ? 'rgba(0,0,0,.35)' : 'rgba(97,65,28,.18)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = theme === 'night' ? '#887e55' : '#a99a77'
  ctx.lineWidth = 1
  ctx.strokeRect(32, 32, w - 64, h - 64)
  ctx.strokeRect(39, 39, w - 78, h - 78)
  for (const x of [32, w - 64]) for (const y of [32, h - 64]) {
    ctx.strokeRect(x, y, 32, 32)
    ctx.strokeRect(x + 7, y + 7, 18, 18)
  }
  cache.set(theme, canvas)
  return canvas
}
