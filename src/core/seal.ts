import { fbm, makeValueNoise, mulberry32, type Noise2D } from './noise'
import { drawBirdGlyph } from './birdGlyphs'
import { fontFamily } from './fonts'

/** 传国玉玺八字。 */
export const SEAL_CHARS = ['受', '命', '于', '天', '既', '寿', '永', '昌'] as const

/** 印章内部渲染分辨率：够清晰，又不至于每次盖印都卡一下。 */
const TEXTURE_SIZE = 360

/** 印章字体的兜底顺序：优先衬线/楷体，篆书字体如已安装可自行加在最前。 */
export const SEAL_FONT_STACK =
  '"Noto Serif SC", "Source Han Serif SC", "STZhongsong", "KaiTi", "STKaiti", "SimSun", serif'

export const EDICT_FONT_STACK =
  '"Ma Shan Zheng", "LiSu", "STLiti", "KaiTi", "STKaiti", "Noto Serif SC", serif'

export interface SealTextureOptions {
  ink: string
  /** 字格列数：2 = 两列四行（右起竖读），4 = 四列两行。 */
  columns?: 2 | 4
  /** 做旧侵蚀强度 0~1，0 为全新印章。 */
  erosion?: number
  seed?: number
  chars?: readonly string[]
  font?: string
}

/**
 * 把一枚印章画成离屏 canvas（透明底，只有印色）。
 * 布局遵循传统印章读序：右列自上而下，再读左列。
 */
export function createSealTexture(opts: SealTextureOptions): HTMLCanvasElement {
  const {
    ink,
    columns = 2,
    erosion = 0.5,
    seed = 1,
    chars = SEAL_CHARS,
    font = 'bird',
  } = opts

  const size = TEXTURE_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(seed)
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = ink
  ctx.fillStyle = ink

  // ---- 印边：外粗框 + 内细线，模拟玉玺的双边 ----
  const outerPad = size * 0.038
  const outerLw = size * 0.055
  ctx.lineWidth = outerLw
  ctx.lineJoin = 'miter'
  roundedRect(
    ctx,
    outerPad + outerLw / 2,
    outerPad + outerLw / 2,
    size - outerPad * 2 - outerLw,
    size - outerPad * 2 - outerLw,
    size * 0.02,
  )
  ctx.stroke()

  const innerPad = size * 0.145
  ctx.lineWidth = Math.max(1, size * 0.014)
  ctx.strokeRect(innerPad, innerPad, size - innerPad * 2, size - innerPad * 2)

  // ---- 字格 ----
  const rows = Math.ceil(chars.length / columns)
  const gridPad = size * 0.168
  const cellW = (size - gridPad * 2) / columns
  const cellH = (size - gridPad * 2) / rows
  const fontSize = Math.min(cellW, cellH) * 0.98

  ctx.font = `${font === 'serif' ? 700 : 400} ${fontSize}px ${fontFamily(font)}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let c = 0; c < columns; c++) {
    for (let r = 0; r < rows; r++) {
      const ch = chars[c * rows + r]
      if (!ch) continue
      // 第 0 列在最右，向左推进
      const colIndex = columns - 1 - c
      const cx = gridPad + colIndex * cellW + cellW / 2
      const cy = gridPad + r * cellH + cellH / 2
      // 手工刻凿的微小抖动，避免过于「印刷体」
      const jx = (rand() - 0.5) * size * 0.008
      const jy = (rand() - 0.5) * size * 0.008
      const rot = (rand() - 0.5) * 0.03
      ctx.save()
      ctx.translate(cx + jx, cy + jy)
      ctx.rotate(rot)
      if (font !== 'bird' || !drawBirdGlyph(ctx, ch, cellW * .84, cellH * .86)) ctx.fillText(ch, 0, 0)
      ctx.restore()
    }
  }

  if (erosion > 0) erode(canvas, erosion, seed)
  return canvas
}

/**
 * 逐像素侵蚀：用多倍频噪声决定哪里「没蘸到印泥」。
 * 比纯随机撒盐噪声更像真实拓印——缺损是成片的，不是椒盐点。
 */
function erode(canvas: HTMLCanvasElement, amount: number, seed: number): void {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data

  const rand = mulberry32(seed ^ 0x9e3779b9)
  const noise: Noise2D = fbm(
    [makeValueNoise(rand, 9), makeValueNoise(rand, 27), makeValueNoise(rand, 74)],
    [0.5, 0.32, 0.18],
  )

  const threshold = amount * 0.6
  const fade = 0.26

  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i + 3] === 0) continue
      const n = noise(x / w, v)
      if (n < threshold) {
        d[i + 3] = 0
        continue
      }
      // 阈值边缘做半透明过渡，避免硬边
      const m = (n - threshold) / fade
      if (m < 1) {
        d[i + 3] = d[i + 3] * (0.3 + 0.7 * m)
      } else {
        d[i + 3] = d[i + 3] * (0.86 + 0.14 * rand())
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

/* ------------------------------------------------------------------ *
 * 纹理缓存：同一印色预生成若干枚「磨损程度不同」的印章，
 * 盖章时轮流取用，既省去每帧重算，又不会每枚长得一模一样。
 * ------------------------------------------------------------------ */

const cache = new Map<string, HTMLCanvasElement>()

export function sealCharacters(text: string): string[] {
  return Array.from(text.replace(/\s/g, '')).slice(0, 8)
}

export function getSealTexture(ink: string, erosion: number, text = SEAL_CHARS.join(''), seed = 1000, font = 'bird'): HTMLCanvasElement {
  const key = JSON.stringify([ink, Math.round(erosion * 100), text, seed, font])
  const hit = cache.get(key)
  if (hit) return hit
  const chars = sealCharacters(text)
  const texture = createSealTexture({ ink, erosion, seed, chars: chars.length ? chars : SEAL_CHARS, font })
  if (cache.size >= 48) cache.delete(cache.keys().next().value!)
  cache.set(key, texture)
  return texture
}

export function clearSealCache() { cache.clear() }
