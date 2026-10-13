<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SealGlyph from './SealGlyph.vue'
import type { Point } from '../core/types'

const props = withDefaults(
  defineProps<{
    ink: string
    text?: string
    font?: string
    angle?: number
    erosion?: number
    size?: number
    /** 印盒元素：空闲时玉玺停在这里，不会挡住任何可点区域 */
    dock?: HTMLElement | null
    /** 屏幕坐标 → 画布坐标；返回 null 表示不落在画布上 */
    toCanvas: (clientX: number, clientY: number) => Point | null
  }>(),
  { erosion: 0.5, size: 140 },
)

const emit = defineEmits<{
  drop: [{ clientX: number; clientY: number }]
  hover: [Point | null]
}>()

const pos = ref({ x: 0, y: 0 })
const dragging = ref(false)
const over = ref(false)
const pressed = ref(false)
let pressTimer = 0
let homeTimer = 0

let grabDx = 0
let grabDy = 0

const style = computed(() => ({
  transform: `translate3d(${pos.value.x}px, ${pos.value.y}px, 0)`,
  width: `${props.size}px`,
  height: `${props.size}px`,
  color: props.ink,
  '--seal-angle': `${props.angle ?? 0}deg`,
}))

/** 归位：停在印盒正中；印盒不存在时退回右下角。 */
function home() {
  const d = props.dock
  if (d) {
    const r = d.getBoundingClientRect()
    pos.value = {
      x: r.left + (r.width - props.size) / 2,
      y: r.top + (r.height - props.size) / 2,
    }
    return
  }
  const m = 40
  pos.value = {
    x: Math.max(m, window.innerWidth - props.size - m),
    y: Math.max(m, window.innerHeight - props.size - 96),
  }
}

/** 印面中心当前的屏幕坐标——盖下去的位置以「看见的印章」为准，而不是指针。 */
function sealCenter(): Point {
  return {
    x: pos.value.x + props.size / 2,
    y: pos.value.y + props.size / 2,
  }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  clearTimeout(homeTimer)
  clearTimeout(pressTimer)
  pressed.value = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
  grabDx = e.clientX - pos.value.x
  grabDy = e.clientY - pos.value.y
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  pos.value = { x: e.clientX - grabDx, y: e.clientY - grabDy }
  const c = sealCenter()
  const hit = props.toCanvas(c.x, c.y)
  over.value = !!hit
  emit('hover', hit)
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  over.value = false
  emit('hover', null)

  const c = sealCenter()
  if (props.toCanvas(c.x, c.y)) {
    // 落点命中画布 → 盖下去
    pressed.value = true
    emit('drop', { clientX: c.x, clientY: c.y })
    pressTimer = window.setTimeout(() => (pressed.value = false), 180)
    // 盖完让印章滑回印盒，别赖在卷轴上挡住刚盖好的印
    homeTimer = window.setTimeout(home, 220)
  } else {
    // 没盖到，自己飘回原位
    home()
  }
}

function onDblClick() {
  home()
}

function onPointerCancel() {
  dragging.value = false
  over.value = false
  emit('hover', null)
  home()
}

/** 印盒是 sticky 的，面板滚动时玉玺要跟着走。 */
function onScroll() {
  if (!dragging.value) home()
}

onMounted(() => {
  home()
  window.addEventListener('resize', onScroll)
  window.addEventListener('scroll', onScroll, true)
})

onBeforeUnmount(() => {
  emit('hover', null)
  clearTimeout(pressTimer)
  clearTimeout(homeTimer)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('scroll', onScroll, true)
})

// 印盒元素可能晚于本组件挂载（父组件模板 ref）
watch(
  () => props.dock,
  () => home(),
)

defineExpose({ home })
</script>

<template>
  <div
    class="floating-seal"
    :class="{ dragging, over, pressed }"
    :style="style"
    title="拖到卷轴上盖章 · 双击归位"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @dblclick="onDblClick"
  >
    <div class="halo" />
    <div class="body">
      <SealGlyph :ink="ink" :text="text" :font="font" :erosion="erosion" :size="size - 24" :seed="1000" />
    </div>
    <div class="label">拖我盖章</div>
  </div>
</template>

<style scoped>
.floating-seal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
  will-change: transform;
  /* 非拖拽状态下位置变化（归位）平滑过渡；拖拽时即时跟手 */
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-seal.dragging {
  cursor: grabbing;
  z-index: 60;
  transition: none;
}

.body {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  transform: rotate(var(--seal-angle));
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dragging .body {
  transform: rotate(var(--seal-angle)) scale(1.08);
}

.pressed .body {
  transform: rotate(var(--seal-angle)) scale(0.88);
  transition-duration: 0.08s;
}

.halo {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background: radial-gradient(circle, currentColor 0%, transparent 68%);
  opacity: 0.16;
  filter: blur(18px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  animation: idle-float 5.5s ease-in-out infinite;
}

.dragging .halo,
.over .halo {
  opacity: 0.42;
  transform: scale(1.22);
  animation-play-state: paused;
}

.label {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, currentColor 45%, transparent);
  background: rgba(6, 5, 10, 0.86);
  color: currentColor;
  font-size: 11px;
  letter-spacing: 0.14em;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.floating-seal:hover .label,
.dragging .label {
  opacity: 1;
}

@keyframes idle-float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-6px) scale(1.06);
  }
}
</style>
