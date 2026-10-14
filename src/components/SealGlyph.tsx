import { useEffect, useRef } from 'react'
import { getSealTexture } from '../core/seal'
import './SealGlyph.css'

export interface SealGlyphProps {
  size?: number
  ink?: string
  erosion?: number
  seed?: number
  columns?: 2 | 4
  text?: string
  font?: string
}

export function SealGlyph({ size = 168, ink = '#e0453a', erosion = 0.5, seed = 1000, text, font }: SealGlyphProps) {
  const el = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const paint = () => {
      const canvas = el.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const px = Math.round(size * dpr)
      canvas.width = px
      canvas.height = px

      const tex = getSealTexture(ink, erosion, text, seed, font)

      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, px, px)
      ctx.drawImage(tex, 0, 0, px, px)
    }
    document.fonts.addEventListener('loadingdone', paint)
    window.addEventListener('imperial-fonts-changed', paint)
    // 等字体就绪再画，否则 canvas 会先落到兜底字体上
    let cancelled = false
    void document.fonts.ready.then(() => { if (!cancelled) paint() }, () => { if (!cancelled) paint() })
    return () => {
      cancelled = true
      document.fonts.removeEventListener('loadingdone', paint)
      window.removeEventListener('imperial-fonts-changed', paint)
    }
  }, [size, ink, erosion, seed, text, font])

  return <canvas ref={el} className="seal-glyph" style={{ width: `${size}px`, height: `${size}px` }} />
}
