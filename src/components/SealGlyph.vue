<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSealTexture } from '../core/seal'

const props = withDefaults(
  defineProps<{
    size?: number
    ink?: string
    erosion?: number
    seed?: number
    columns?: 2 | 4
    text?: string
    font?: string
  }>(),
  {
    size: 168,
    ink: '#e0453a',
    erosion: 0.5,
    seed: 1000,
    columns: 2,
  },
)

const el = ref<HTMLCanvasElement | null>(null)

function paint() {
  const canvas = el.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const px = Math.round(props.size * dpr)
  canvas.width = px
  canvas.height = px

  const tex = getSealTexture(props.ink, props.erosion, props.text, props.seed, props.font)

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, px, px)
  ctx.drawImage(tex, 0, 0, px, px)
}

onMounted(async () => {
  document.fonts.addEventListener('loadingdone', paint)
  window.addEventListener('imperial-fonts-changed', paint)
  // 等字体就绪再画，否则 canvas 会先落到兜底字体上
  try {
    await document.fonts.ready
  } catch {
    /* 字体 API 不可用时直接画 */
  }
  paint()
})

onBeforeUnmount(() => { document.fonts.removeEventListener('loadingdone', paint); window.removeEventListener('imperial-fonts-changed', paint) })

watch(
  () => [props.size, props.ink, props.erosion, props.seed, props.columns, props.text, props.font],
  paint,
)
</script>

<template>
  <canvas
    ref="el"
    class="seal-glyph"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>

<style scoped>
.seal-glyph {
  display: block;
  filter: drop-shadow(0 3px 7px #0002);
}
</style>
