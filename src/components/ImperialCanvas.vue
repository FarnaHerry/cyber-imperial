<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  folded: boolean
}>()
const emit = defineEmits<{ stamp: [Point]; overflow: [boolean]; unfold: [] }>()
const rolling = defineModel<boolean>('rolling', { required: true })
const SCROLL_DURATION = 760
const paperTheme = computed(() => PAPERS.find(p => p.key === props.paper) ?? PAPERS[0])
const scrollStyle = computed(() => ({ '--scroll-paper': paperTheme.value.color, '--scroll-duration': `${SCROLL_DURATION}ms` }))
const wrap = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const localGhost = ref<Point | null>(null)
let raf = 0
let revealStart = -Infinity
let mounted = false
let reducedMotion = false
let motionQuery: MediaQueryList | null = null
let scrollTimer: ReturnType<typeof setTimeout> | undefined
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
  ctx.fillText(`CYBER IMPERIAL  /  ${props.kingdom.trim() || '赛博'}御制`, 80, 94)
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
  const rawGhost = props.folded || rolling.value ? null : props.ghost ?? localGhost.value
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
  if (props.folded || rolling.value) return null
  const r = canvasEl.value?.getBoundingClientRect()
  if (!r || !r.width || clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return null
  return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H }
}
function signature(): Point | null {
  if (props.folded || rolling.value) return null
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
watch(() => props.folded, () => {
  localGhost.value = null
  clearTimeout(scrollTimer)
  const animating = !reducedMotion
  rolling.value = animating
  if (animating) scrollTimer = setTimeout(() => { rolling.value = false }, SCROLL_DURATION)
  invalidate()
})
watch(rolling, invalidate)
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
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  computeLayout(); resize()
  ro = new ResizeObserver(resize)
  if (wrap.value) ro.observe(wrap.value)
  document.fonts.addEventListener('loadingdone', onFontsLoaded)
  window.addEventListener('imperial-fonts-changed', onFontsLoaded)
  void document.fonts.ready.then(() => { if (mounted) { clearSealCache(); invalidate() } })
})
function onFontsLoaded() { clearSealCache(); invalidate() }
function onMotionChange(e: MediaQueryListEvent) {
  reducedMotion = e.matches
  if (reducedMotion) { clearTimeout(scrollTimer); rolling.value = false }
  invalidate()
}
onBeforeUnmount(() => { mounted = false; clearTimeout(scrollTimer); motionQuery?.removeEventListener('change', onMotionChange); ro?.disconnect(); cancelAnimationFrame(raf); document.fonts.removeEventListener('loadingdone', onFontsLoaded); window.removeEventListener('imperial-fonts-changed', onFontsLoaded) })
defineExpose({ toCanvas, signature, download })
</script>

<template>
  <div id="edict-scroll" ref="wrap" class="document" :class="{ folded, rolling, targeting: !!ghost && !folded && !rolling, 'night-scroll': paper === 'night' }" :style="scrollStyle" :aria-busy="rolling">
    <div class="scroll-paper"><canvas ref="canvasEl" :aria-hidden="folded || rolling" aria-label="圣旨画布，点击任意位置盖印；也可使用落款用印按钮" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerleave="localGhost = null" /></div>
    <div class="scroll-roller roller-left" aria-hidden="true"><span class="roller-silk" /></div>
    <div class="scroll-roller roller-right" aria-hidden="true"><span class="roller-silk" /></div>
    <button class="scroll-binding" :tabindex="folded ? 0 : -1" :aria-hidden="!folded" :disabled="!folded || rolling" aria-label="点击卷轴展开圣旨" aria-controls="edict-scroll" @click="emit('unfold')"><span class="binding-title">御制圣旨</span><span class="binding-seal">御</span></button>
    <p class="scroll-hint" :aria-hidden="!folded">点击卷轴 · 展读圣旨</p>
  </div>
</template>

<style scoped>
.document { --roll-width: clamp(16px, 3.4cqw, 26px); position: relative; width: 100%; aspect-ratio: 3 / 2; filter: drop-shadow(0 18px 22px #0005); }
.scroll-paper { position: absolute; inset: 0; clip-path: inset(0 0); transition: clip-path var(--scroll-duration) cubic-bezier(.65, 0, .25, 1); }
.folded .scroll-paper { clip-path: inset(0 50%); }
.document.targeting .scroll-paper { outline: 2px solid var(--ink); }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; touch-action: manipulation; }
.folded canvas, .rolling canvas { pointer-events: none; }
.scroll-roller { position: absolute; top: -10px; bottom: -10px; width: var(--roll-width); border-radius: 5px; z-index: 2; background: linear-gradient(90deg, #382717, #a2824d 35%, #dcc391 52%, #75532f 77%, #342419); box-shadow: 2px 3px 6px #0005; pointer-events: none; transition: left var(--scroll-duration) cubic-bezier(.65, 0, .25, 1), right var(--scroll-duration) cubic-bezier(.65, 0, .25, 1); }
.roller-left { left: 0; transform: translateX(-50%); }
.roller-right { right: 0; transform: translateX(50%); }
.folded .roller-left { left: calc(50% - var(--roll-width) / 2); }
.folded .roller-right { right: calc(50% - var(--roll-width) / 2); }
.scroll-roller::before, .scroll-roller::after { content: ''; position: absolute; left: -2px; right: -2px; height: 7px; border-radius: 3px; background: linear-gradient(90deg, #49341d, #d1b26e 44%, #9c7338 74%, #3c2919); border-top: 1px solid #ead09780; }
.scroll-roller::before { top: 3px; }.scroll-roller::after { bottom: 3px; }
.roller-silk { position: absolute; inset: 13px 0; border-radius: 3px; background: linear-gradient(90deg, #0006, #0001 24%, #fff5 48%, #fff1 65%, #0004), var(--scroll-paper); box-shadow: inset 1px 0 2px #fff5, inset -2px 0 3px #0003; background-size: 100% 100%; transition: background-position var(--scroll-duration) ease; }
.rolling .roller-silk { animation: turn-silk var(--scroll-duration) ease-in-out; }
.roller-right .roller-silk { animation-direction: reverse; }
.scroll-binding { position: absolute; z-index: 3; top: 29%; left: 50%; width: calc(var(--roll-width) * 2 + 12px); height: 42%; transform: translateX(-50%) scale(.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; border: 1px solid #d4aa6880; border-radius: 2px; background: linear-gradient(90deg, #8d633f, #c39b66 45%, #a4794d); box-shadow: 0 3px 8px #0005, inset 0 0 0 3px #d4b07b55; color: #38251b; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 180ms, transform 180ms, visibility 180ms; }
.folded .scroll-binding { opacity: 1; visibility: visible; pointer-events: auto; transform: translateX(-50%) scale(1); transition-delay: 480ms; }
.scroll-binding:disabled { opacity: 1; }
.binding-title { writing-mode: vertical-rl; letter-spacing: 5px; font: 18px var(--font-serif); }
.binding-seal { display: grid; place-items: center; width: 24px; height: 24px; color: #a83827; border: 1px solid currentColor; font: 17px var(--font-serif); }
.scroll-hint { position: absolute; top: calc(100% + 18px); left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 10px; letter-spacing: 2px; color: var(--muted); margin: 0; opacity: 0; transition: opacity 200ms; pointer-events: none; }
.folded .scroll-hint { opacity: 1; transition-delay: 480ms; }
.night-scroll .scroll-binding { background: linear-gradient(90deg, #283328, #485440 45%, #252e27); color: #ddc996; }
.night-scroll .binding-seal { color: #d6b47a; }
@keyframes turn-silk { 0% { background-size: 100% 100%; } 50% { background-size: 180% 100%; } 100% { background-size: 100% 100%; } }
@media (max-width: 700px) { .document { --roll-width: 16px; }.scroll-binding { top: 22%; height: 56%; gap: 8px; }.binding-title { font-size: 14px; letter-spacing: 3px; }.binding-seal { width: 20px; height: 20px; font-size: 14px; }.scroll-hint { top: calc(100% + 10px); font-size: 9px; letter-spacing: 1.5px; } }
@media (prefers-reduced-motion: reduce) { .scroll-paper, .scroll-roller, .scroll-binding, .scroll-hint { transition: none; }.roller-silk { animation: none !important; } }
</style>
