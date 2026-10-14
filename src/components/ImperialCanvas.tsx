import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { DOCUMENT_HEIGHT as H, DOCUMENT_WIDTH as W, PAPERS, renderPaper, type PaperKey } from '../core/paper'
import { clearSealCache, getSealTexture } from '../core/seal'
import { fontFamily } from '../core/fonts'
import { clampSealPoint, sealHalfExtent } from '../core/geometry'
import { ensureFontLibrary } from '../state/fontLibrary'
import { drawStamp, type Stamp } from '../core/stamp'
import { drawColumnRules, drawVerticalGlyphs, layoutVertical, type VerticalLayout } from '../core/text'
import type { Point } from '../core/types'
import './ImperialCanvas.css'

export interface ImperialCanvasProps {
  text: string
  revealKey: number
  ink: string
  force: number
  erosion: number
  sealSize: number
  sealText: string
  ghost: Point | null
  paper: PaperKey
  stamps: Stamp[]
  sealFont: string
  edictFont: string
  sealAngle: number
  folded: boolean
  rolling: boolean
  onRollingChange: (v: boolean) => void
  onStamp: (point: Point) => void
  onOverflow: (v: boolean) => void
  onUnfold: () => void
}

export interface ImperialCanvasHandle {
  toCanvas(clientX: number, clientY: number): Point | null
  signature(): Point | null
  download(scale: 2 | 4, name: string): Promise<void>
}

const SCROLL_DURATION = 760

export const ImperialCanvas = forwardRef<ImperialCanvasHandle, ImperialCanvasProps>(function ImperialCanvas(props, ref) {
  // paint / rAF 循环可能跨多次渲染运行，全部经 latest 读取最新 props，避免闭包过期
  const latest = useRef(props)
  latest.current = props
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [localGhost, setLocalGhost] = useState<Point | null>(null)
  const localGhostRef = useRef<Point | null>(null)
  localGhostRef.current = localGhost
  const rafRef = useRef(0)
  const revealStartRef = useRef(-Infinity)
  const mountedRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const layoutRef = useRef<VerticalLayout | null>(null)
  const birthsRef = useRef(new Map<string, number>())
  const prevStampsRef = useRef<Stamp[]>(props.stamps)

  function computeLayout() {
    const text = latest.current.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n')
    let fontSize = 36
    let result = layoutVertical(text, { right: 1076, top: 127, bottom: 650, fontSize })
    while (fontSize > 11 && result.cols * result.colWidth > 930) {
      fontSize--
      result = layoutVertical(text, { right: 1076, top: 127, bottom: 650, fontSize })
    }
    const overflow = result.cols * result.colWidth > 930
    if (overflow) result = layoutVertical(text, { right: 1076, top: 127, bottom: 650, fontSize, maxCols: Math.floor(930 / result.colWidth) })
    layoutRef.current = result
    latest.current.onOverflow(overflow)
  }

  function paint(ctx: CanvasRenderingContext2D, scale: number, now: number, exporting = false): boolean {
    const p = latest.current
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(renderPaper(p.paper), 0, 0)
    const theme = PAPERS.find(x => x.key === p.paper) ?? PAPERS[0]
    let animating = false
    const layout = layoutRef.current
    if (layout?.glyphs.length) {
      const fontSize = layout.lineHeight / 1.16
      drawColumnRules(ctx, layout, { top: 127, bottom: 650, color: p.paper === 'night' ? 'rgba(210,181,123,.09)' : 'rgba(132,81,46,.10)' })
      const reveal = exporting || reducedMotionRef.current ? layout.glyphs.length : Math.floor((now - revealStartRef.current) / 19)
      if (reveal < layout.glyphs.length) animating = true
      drawVerticalGlyphs(ctx, layout, { font: `400 ${fontSize}px ${fontFamily(p.edictFont)}`, fontSize, color: theme.text, reveal, headGlow: 0 })
    }
    for (const s of p.stamps) {
      const progress = exporting || reducedMotionRef.current ? 1 : Math.min(1, (now - (birthsRef.current.get(s.id) ?? -Infinity)) / 260)
      drawStamp(ctx, s, progress)
      if (progress < 1) animating = true
    }
    const rawGhost = p.folded || p.rolling ? null : p.ghost ?? localGhostRef.current
    const ghost = rawGhost ? clampSealPoint(rawGhost, p.sealSize, p.sealAngle) : null
    if (!exporting && ghost) {
      ctx.save()
      ctx.translate(ghost.x, ghost.y)
      ctx.rotate(p.sealAngle * Math.PI / 180)
      ctx.globalAlpha = .35
      ctx.drawImage(getSealTexture(p.ink, p.erosion, p.sealText, 1000, p.sealFont), -p.sealSize / 2, -p.sealSize / 2, p.sealSize, p.sealSize)
      ctx.globalAlpha = .7
      ctx.strokeStyle = p.ink
      ctx.setLineDash([4, 5])
      ctx.strokeRect(-p.sealSize / 2 - 8, -p.sealSize / 2 - 8, p.sealSize + 16, p.sealSize + 16)
      ctx.restore()
    }
    return animating
  }

  function invalidate() {
    if (!mountedRef.current || rafRef.current) return
    rafRef.current = requestAnimationFrame(now => {
      rafRef.current = 0
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx && paint(ctx, canvas.width / W, now)) invalidate()
    })
  }

  function resize() {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const px = Math.round(wrap.clientWidth * Math.min(window.devicePixelRatio || 1, 2))
    if (canvas.width !== px) { canvas.width = px; canvas.height = Math.round(px * H / W) }
    invalidate()
  }

  function toCanvas(clientX: number, clientY: number): Point | null {
    const p = latest.current
    if (p.folded || p.rolling) return null
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !r.width || clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return null
    return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H }
  }

  function signature(): Point | null {
    const p = latest.current
    if (p.folded || p.rolling) return null
    const layout = layoutRef.current
    const last = layout?.glyphs[layout.glyphs.length - 1]
    if (!last) return null
    const extent = sealHalfExtent(p.sealSize, p.sealAngle)
    const maxY = H - 80 - extent
    const below = last.y + (layout?.lineHeight ?? 0) / 2 + extent + 18
    return {
      x: Math.max(80 + extent, below <= maxY ? last.x : last.x - (layout?.colWidth ?? 0) / 2 - extent - 18),
      y: Math.min(maxY, below),
    }
  }

  async function download(scale: 2 | 4, name: string): Promise<void> {
    const p = latest.current
    await ensureFontLibrary()
    const sealFonts = new Map<string, string>([[p.sealFont, p.sealText]])
    for (const s of p.stamps) sealFonts.set(s.font, (sealFonts.get(s.font) ?? '') + s.text)
    // 自定义文字可能触发新的中文字体子集下载，导出前等这些字形就绪。
    await Promise.allSettled([
      document.fonts.load(`400 36px ${fontFamily(p.edictFont)}`, p.text),
      ...Array.from(sealFonts, ([key, text]) => document.fonts.load(`${key === 'serif' ? 700 : 400} 36px ${fontFamily(key)}`, text)),
    ])
    clearSealCache()
    const off = document.createElement('canvas')
    off.width = W * scale; off.height = H * scale
    paint(off.getContext('2d')!, scale, performance.now(), true)
    const blob = await new Promise<Blob>((resolve, reject) => off.toBlob(b => b ? resolve(b) : reject(new Error('图片生成失败')), 'image/png'))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${name}.png`; a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    const point = toCanvas(e.clientX, e.clientY)
    if (point) props.onStamp(point)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    setLocalGhost(e.pointerType === 'mouse' ? toCanvas(e.clientX, e.clientY) : null)
  }

  function onFontsLoaded() { clearSealCache(); invalidate() }

  function onMotionChange(e: MediaQueryListEvent) {
    reducedMotionRef.current = e.matches
    if (e.matches) { clearTimeout(scrollTimerRef.current); latest.current.onRollingChange(false) }
    invalidate()
  }

  useEffect(() => {
    mountedRef.current = true
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
    computeLayout(); resize()
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    document.fonts.addEventListener('loadingdone', onFontsLoaded)
    window.addEventListener('imperial-fonts-changed', onFontsLoaded)
    void document.fonts.ready.then(() => { if (mountedRef.current) { clearSealCache(); invalidate() } })
    return () => {
      mountedRef.current = false
      clearTimeout(scrollTimerRef.current)
      motionQuery.removeEventListener('change', onMotionChange)
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
      document.fonts.removeEventListener('loadingdone', onFontsLoaded)
      window.removeEventListener('imperial-fonts-changed', onFontsLoaded)
    }
  }, [])

  // watch(() => props.text)：正文变化重新排版并立即完整呈现
  useEffect(() => {
    computeLayout()
    revealStartRef.current = -Infinity
    invalidate()
  }, [props.text])

  // watch(() => props.folded)：原 watch 非 immediate，跳过挂载当次
  const foldedSkip = useRef(false)
  useEffect(() => {
    if (!foldedSkip.current) { foldedSkip.current = true; return }
    setLocalGhost(null)
    clearTimeout(scrollTimerRef.current)
    const animating = !reducedMotionRef.current
    latest.current.onRollingChange(animating)
    if (animating) scrollTimerRef.current = setTimeout(() => { latest.current.onRollingChange(false) }, SCROLL_DURATION)
    invalidate()
  }, [props.folded])

  // watch(rolling)：开合动画期间随 rolling 重绘
  useEffect(() => {
    invalidate()
  }, [props.rolling])

  // watch(() => props.revealKey)：原 watch 非 immediate，跳过挂载当次
  const revealSkip = useRef(false)
  useEffect(() => {
    if (!revealSkip.current) { revealSkip.current = true; return }
    revealStartRef.current = performance.now()
    invalidate()
  }, [props.revealKey])

  // watch(() => props.stamps)：为新增印痕记录落印时刻，清理已移除印痕
  useEffect(() => {
    const next = props.stamps
    const ids = new Set(prevStampsRef.current.map(s => s.id))
    for (const s of next) if (!ids.has(s.id)) birthsRef.current.set(s.id, performance.now())
    const live = new Set(next.map(s => s.id))
    for (const id of Array.from(birthsRef.current.keys())) if (!live.has(id)) birthsRef.current.delete(id)
    prevStampsRef.current = next
    invalidate()
  }, [props.stamps])

  // watch(deep)：印色 / 印面 / 纸张 / 字体 / 悬停 ghost 变化时重绘
  useEffect(() => {
    invalidate()
  }, [props.ink, props.force, props.erosion, props.sealSize, props.sealText, props.ghost, props.paper, props.sealFont, props.edictFont, props.sealAngle, localGhost])

  useImperativeHandle(ref, () => ({ toCanvas, signature, download }))

  const paperTheme = PAPERS.find(p => p.key === props.paper) ?? PAPERS[0]
  const scrollStyle = { '--scroll-paper': paperTheme.color, '--scroll-duration': `${SCROLL_DURATION}ms` } as CSSProperties
  const className = [
    'document',
    props.folded && 'folded',
    props.rolling && 'rolling',
    props.ghost && !props.folded && !props.rolling && 'targeting',
    props.paper === 'night' && 'night-scroll',
  ].filter(Boolean).join(' ')

  return (
    <div id="edict-scroll" ref={wrapRef} className={className} style={scrollStyle} aria-busy={props.rolling}>
      <div className="scroll-paper"><canvas ref={canvasRef} aria-hidden={props.folded || props.rolling} aria-label="圣旨画布，点击任意位置盖印；也可使用落款用印按钮" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => setLocalGhost(null)} /></div>
      <div className="scroll-roller roller-left" aria-hidden="true"><span className="roller-silk" /></div>
      <div className="scroll-roller roller-right" aria-hidden="true"><span className="roller-silk" /></div>
      <button className="scroll-binding" tabIndex={props.folded ? 0 : -1} aria-hidden={!props.folded} disabled={!props.folded || props.rolling} aria-label="点击卷轴展开圣旨" aria-controls="edict-scroll" onClick={() => props.onUnfold()}><span className="binding-title">御制圣旨</span><span className="binding-seal">御</span></button>
    </div>
  )
})
