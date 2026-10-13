<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DOCUMENT_HEIGHT as H, DOCUMENT_WIDTH as W, PAPERS, renderPaper, type PaperKey } from '../core/paper'
import { clearSealCache, getSealTexture } from '../core/seal'
import { fontFamily } from '../core/fonts'
import { clampSealPoint, sealHalfExtent } from '../core/geometry'
import { ensureFontLibrary } from '../composables/useFontLibrary'
import { drawStamp, type Stamp } from '../core/stamp'
import { drawColumnRules, drawVerticalGlyphs, layoutVertical, type VerticalLayout } from '../core/text'
import type { Point } from '../core/types'

const props = defineProps<{
  text: string; revealKey: number; ink: string; force: number; erosion: number
  sealSize: number; sealText: string; ghost: Point | null; paper: PaperKey; stamps: Stamp[]
  sealFont: string; edictFont: string; sealAngle: number; kingdom: string; emperor: string
}>()
const emit = defineEmits<{ stamp: [Point]; overflow: [boolean] }>()
const wrap = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const localGhost = ref<Point | null>(null)
let raf = 0
let revealStart = -Infinity
let mounted = false
let reducedMotion = false
let ro: ResizeObserver | null = null
let layout: VerticalLayout | null = null
const births = new Map<string, number>()

function computeLayout() {
  const text = props.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n')
  let fontSize = 36
  let result = layoutVertical(text, { right: 1004, top: 127, bottom: 650, fontSize })
  while (fontSize > 11 && result.cols * result.colWidth > 930) {
    fontSize--
    result = layoutVertical(text, { right: 1004, top: 127, bottom: 650, fontSize })
  }
  const overflow = result.cols * result.colWidth > 930
  if (overflow) result = layoutVertical(text, { right: 1004, top: 127, bottom: 650, fontSize, maxCols: Math.floor(930 / result.colWidth) })
  layout = result
  emit('overflow', overflow)
}

function paint(ctx: CanvasRenderingContext2D, scale: number, now: number, exporting = false): boolean {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(renderPaper(props.paper), 0, 0)
  const theme = PAPERS.find(p => p.key === props.paper) ?? PAPERS[0]
  ctx.fillStyle = theme.text
  ctx.textAlign = 'left'
  ctx.font = '11px serif'
  ctx.globalAlpha = .55
  ctx.fillText(`CYBER IMPERIAL SEAL  /  ${props.kingdom.trim() || '赛博'}御制`, 80, 94)
  ctx.fillText('受命于天 · 既寿永昌', 80, 716)
  ctx.textAlign = 'right'
  ctx.fillText(`${props.kingdom.trim() || '赛博'}皇帝${props.emperor.trim() ? ` · ${props.emperor.trim()}` : ''}御笔`, W - 80, 716)
  ctx.globalAlpha = 1
  ctx.font = `48px ${fontFamily(props.edictFont)}`
  ctx.textAlign = 'center'
  Array.from('奉天承運').forEach((ch, i) => ctx.fillText(ch, 1110, 158 + i * 58))
  ctx.strokeStyle = props.paper === 'night' ? 'rgba(219,207,170,.25)' : 'rgba(125,92,49,.25)'
  ctx.beginPath(); ctx.moveTo(1064, 125); ctx.lineTo(1064, 650); ctx.stroke()
  let animating = false
  if (layout?.glyphs.length) {
    const fontSize = layout.lineHeight / 1.16
    drawColumnRules(ctx, layout, { top: 127, bottom: 650, color: props.paper === 'night' ? 'rgba(210,181,123,.09)' : 'rgba(132,81,46,.10)' })
    const reveal = exporting || reducedMotion ? layout.glyphs.length : Math.floor((now - revealStart) / 19)
    if (reveal < layout.glyphs.length) animating = true
    drawVerticalGlyphs(ctx, layout, { font: `400 ${fontSize}px ${fontFamily(props.edictFont)}`, fontSize, color: theme.text, reveal, headGlow: 0 })
  }
  for (const s of props.stamps) {
    const progress = exporting || reducedMotion ? 1 : Math.min(1, (now - (births.get(s.id) ?? -Infinity)) / 260)
    drawStamp(ctx, s, progress)
    if (progress < 1) animating = true
  }
  const rawGhost = props.ghost ?? localGhost.value
  const ghost = rawGhost ? clampSealPoint(rawGhost, props.sealSize, props.sealAngle) : null
  if (!exporting && ghost) {
    ctx.save()
    ctx.translate(ghost.x, ghost.y)
    ctx.rotate(props.sealAngle * Math.PI / 180)
    ctx.globalAlpha = .35
    ctx.drawImage(getSealTexture(props.ink, props.erosion, props.sealText, 1000, props.sealFont), -props.sealSize / 2, -props.sealSize / 2, props.sealSize, props.sealSize)
    ctx.globalAlpha = .7
    ctx.strokeStyle = props.ink
    ctx.setLineDash([4, 5])
    ctx.strokeRect(-props.sealSize / 2 - 8, -props.sealSize / 2 - 8, props.sealSize + 16, props.sealSize + 16)
    ctx.restore()
  }
  return animating
}
function invalidate() {
  if (!mounted || raf) return
  raf = requestAnimationFrame(now => {
    raf = 0
    const ctx = canvasEl.value?.getContext('2d')
    if (ctx && paint(ctx, canvasEl.value!.width / W, now)) invalidate()
  })
}
function resize() {
  const canvas = canvasEl.value
  if (!canvas || !wrap.value) return
  const px = Math.round(wrap.value.clientWidth * Math.min(window.devicePixelRatio || 1, 2))
  if (canvas.width !== px) { canvas.width = px; canvas.height = Math.round(px * H / W) }
  invalidate()
}
function toCanvas(clientX: number, clientY: number): Point | null {
  const r = canvasEl.value?.getBoundingClientRect()
  if (!r || !r.width || clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return null
  return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H }
}
function signature(): Point | null {
  const last = layout?.glyphs[layout.glyphs.length - 1]
  if (!last) return null
  const extent = sealHalfExtent(props.sealSize, props.sealAngle)
  const maxY = H - 80 - extent
  const below = last.y + (layout?.lineHeight ?? 0) / 2 + extent + 18
  return {
    x: Math.max(80 + extent, below <= maxY ? last.x : last.x - (layout?.colWidth ?? 0) / 2 - extent - 18),
    y: Math.min(maxY, below),
  }
}
async function download(scale: 2 | 4, name: string): Promise<void> {
  await ensureFontLibrary()
  const sealFonts = new Map<string, string>([[props.sealFont, props.sealText]])
  for (const s of props.stamps) sealFonts.set(s.font, (sealFonts.get(s.font) ?? '') + s.text)
  // 自定义文字可能触发新的中文字体子集下载，导出前等这些字形就绪。
  await Promise.allSettled([
    document.fonts.load(`400 36px ${fontFamily(props.edictFont)}`, props.text + '奉天承運'),
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
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const point = toCanvas(e.clientX, e.clientY)
  if (point) emit('stamp', point)
}
function onPointerMove(e: PointerEvent) {
  localGhost.value = e.pointerType === 'mouse' ? toCanvas(e.clientX, e.clientY) : null
}
watch(() => props.text, () => { computeLayout(); revealStart = -Infinity; invalidate() })
watch(() => props.revealKey, () => { revealStart = performance.now(); invalidate() })
watch(() => props.stamps, (next, previous) => {
  const ids = new Set(previous.map(s => s.id))
  for (const s of next) if (!ids.has(s.id)) births.set(s.id, performance.now())
  const live = new Set(next.map(s => s.id))
  for (const id of births.keys()) if (!live.has(id)) births.delete(id)
  invalidate()
})
watch(() => [props.ink, props.force, props.erosion, props.sealSize, props.sealText, props.ghost, props.paper, props.sealFont, props.edictFont, props.sealAngle, props.kingdom, props.emperor, localGhost.value], invalidate, { deep: true })
onMounted(() => {
  mounted = true
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  computeLayout(); resize()
  ro = new ResizeObserver(resize)
  if (wrap.value) ro.observe(wrap.value)
  document.fonts.addEventListener('loadingdone', onFontsLoaded)
  window.addEventListener('imperial-fonts-changed', onFontsLoaded)
  void document.fonts.ready.then(() => { if (mounted) { clearSealCache(); invalidate() } })
})
function onFontsLoaded() { clearSealCache(); invalidate() }
onBeforeUnmount(() => { mounted = false; ro?.disconnect(); cancelAnimationFrame(raf); document.fonts.removeEventListener('loadingdone', onFontsLoaded); window.removeEventListener('imperial-fonts-changed', onFontsLoaded) })
defineExpose({ toCanvas, signature, download })
</script>

<template>
  <div ref="wrap" class="document" :class="{ targeting: !!ghost }">
    <canvas ref="canvasEl" aria-label="圣旨画布，点击任意位置盖印；也可使用落款用印按钮" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerleave="localGhost = null" />
  </div>
</template>

<style scoped>
.document { position: relative; width: 100%; aspect-ratio: 3 / 2; box-shadow: 0 24px 60px #0005, 0 2px 5px #0004; outline: 1px solid #ffffff12; }
.document.targeting { outline: 2px solid var(--ink); }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; touch-action: manipulation; }
</style>
