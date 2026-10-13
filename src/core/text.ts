/**
 * 中文竖排排版。
 * 圣旨是右起竖读的，所以第一列在最右侧，逐列向左推进。
 * 先 layout 出每个字的位置，再按 reveal 数逐字绘制——这样打字机效果
 * 和「界行」（列格线）都能复用同一份布局结果。
 */

/** 竖排时应当挪到格子右上角的标点（CJK 字体里它们默认落在左下）。 */
const TOP_RIGHT_PUNCT = new Set(['，', '。', '、', ',', '.'])

/**
 * 竖排时需要顺时针转 90° 的括号。
 * 字体的 OpenType `vert` 特性会做这件事，但 canvas fillText 不会应用它，
 * 所以只能手动转，否则「」会显示成横排的形态。
 */
const VERTICAL_ROTATED = new Set(['「', '」', '『', '』', '（', '）', '(', ')'])

export interface GlyphPos {
  ch: string
  /** 字格中心 x */
  x: number
  /** 字格中心 y */
  y: number
  col: number
  /** 标点用的额外偏移 */
  dx: number
  dy: number
  /** 是否需要顺时针旋转 90°（竖排括号） */
  rotated: boolean
}

export interface VerticalLayoutOptions {
  /** 最右一列的中线 x */
  right: number
  top: number
  bottom: number
  fontSize: number
  /** 列间距相对字号的倍数 */
  colGap?: number
  /** 最多排多少列，超出直接丢弃 */
  maxCols?: number
}

export interface VerticalLayout {
  glyphs: GlyphPos[]
  cols: number
  lineHeight: number
  colWidth: number
}

export function layoutVertical(text: string, o: VerticalLayoutOptions): VerticalLayout {
  const lineHeight = o.fontSize * 1.16
  const colWidth = o.fontSize * (o.colGap ?? 1.72)
  const maxCols = o.maxCols ?? 64
  const half = lineHeight * 0.5

  const glyphs: GlyphPos[] = []
  let col = 0
  let y = o.top + half

  const place = (ch: string) => {
    const isPunct = TOP_RIGHT_PUNCT.has(ch)
    if (y + half > o.bottom) {
      // 行末标点悬挂在前一字旁，避免句号独占下一列。
      const previous = glyphs[glyphs.length - 1]
      if (isPunct && previous?.col === col) {
        glyphs.push({ ch, x: previous.x, y: Math.min(o.bottom - o.fontSize * .2, previous.y + o.fontSize * .45), col,
          dx: o.fontSize * .42, dy: 0, rotated: false })
        return
      }
      col++
      y = o.top + half
    }
    if (col >= maxCols) return
    glyphs.push({
      ch,
      x: o.right - col * colWidth,
      y,
      col,
      dx: isPunct ? o.fontSize * 0.28 : 0,
      dy: isPunct ? -o.fontSize * 0.28 : 0,
      rotated: VERTICAL_ROTATED.has(ch),
    })
    y += lineHeight
  }

  for (const ch of text) {
    if (ch === '\n') {
      col++
      y = o.top + half
      continue
    }
    if (ch === ' ' || ch === '　') {
      y += lineHeight * 0.4
      continue
    }
    place(ch)
  }

  return { glyphs, cols: col + 1, lineHeight, colWidth }
}

export interface DrawVerticalOptions {
  /** 完整的 canvas font 简写 */
  font: string
  /** 字号（单独传，避免从 font 字符串里反解） */
  fontSize: number
  color: string
  /** 已揭示的字数 */
  reveal: number
  /** 刚出现那个字的渐入强度 0~1，用于打字机光晕 */
  headGlow?: number
}

export function drawVerticalGlyphs(
  ctx: CanvasRenderingContext2D,
  lay: VerticalLayout,
  o: DrawVerticalOptions,
): void {
  const n = Math.min(o.reveal, lay.glyphs.length)
  if (n <= 0) return

  ctx.save()
  ctx.font = o.font
  ctx.fillStyle = o.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 1

  const fontSize = o.fontSize

  // 除最后一个字外全部实心绘制
  for (let i = 0; i < n - 1; i++) drawGlyph(ctx, lay.glyphs[i])

  // 最新的一个字带光晕 + 半透明淡入，形成打字机的推进感
  const head = lay.glyphs[n - 1]
  const glow = o.headGlow ?? 0
  ctx.save()
  ctx.shadowColor = o.color
  ctx.shadowBlur = fontSize * 1.2 * glow
  ctx.globalAlpha = 0.45 + 0.55 * (1 - glow)
  ctx.translate(head.x + head.dx, head.y + head.dy)
  if (head.rotated) ctx.rotate(Math.PI / 2)
  ctx.fillText(head.ch, 0, 0)
  ctx.restore()

  ctx.restore()
}

function drawGlyph(ctx: CanvasRenderingContext2D, g: GlyphPos): void {
  if (!g.rotated) {
    ctx.fillText(g.ch, g.x + g.dx, g.y + g.dy)
    return
  }
  ctx.save()
  ctx.translate(g.x + g.dx, g.y + g.dy)
  ctx.rotate(Math.PI / 2)
  ctx.fillText(g.ch, 0, 0)
  ctx.restore()
}

/** 界行：每列身后一条朱红细线，圣旨的经典格线。 */
export function drawColumnRules(
  ctx: CanvasRenderingContext2D,
  lay: VerticalLayout,
  o: { top: number; bottom: number; color: string },
): void {
  const first = lay.glyphs[0]
  if (!first) return

  ctx.save()
  ctx.strokeStyle = o.color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 0; c <= lay.cols; c++) {
    const x = Math.round(first.x - c * lay.colWidth + lay.colWidth / 2)
    ctx.moveTo(x + 0.5, o.top)
    ctx.lineTo(x + 0.5, o.bottom)
  }
  ctx.stroke()
  ctx.restore()
}
