<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ name: string; size?: number }>()
const paths: Record<string, string> = {
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  moon: 'M20 15A8 8 0 0 1 9 4a9 9 0 1 0 11 11',
  undo: 'M9 4 4 9l5 5M4 9h9a7 7 0 0 1 0 14',
  redo: 'm15 4 5 5-5 5m5-5h-9a7 7 0 0 0 0 14',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  shuffle: 'm17 3 4 4-4 4M3 17c6 0 9-10 18-10M3 7c3 0 5 2 7 5m4 4c2 1 4 1 7 1m-4-4 4 4-4 4',
  check: 'm5 12 4 4L19 6',
  volume: 'm11 5-6 4H2v6h3l6 4V5m4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'm11 5-6 4H2v6h3l6 4V5m5 4 5 6m0-6-5 6',
  stamp: 'M9 3h6v4l3 6H6l3-6V3M5 13h14v5H5zM4 21h16',
  replay: 'M3 10a9 9 0 1 1 1 7M3 4v6h6',
  help: 'M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  close: 'm6 6 12 12M6 18 18 6',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
  fold: 'M3 4v16m18-16v16M6 12h4m-3-3 3 3-3 3m11-3h-4m3-3-3 3 3 3',
  unfold: 'M3 4v16m18-16v16M10 12H6m3-3-3 3 3 3m5-3h4m-3-3 3 3-3 3',
}
const path = computed(() => paths[props.name] ?? paths.stamp)
</script>
<template><svg :width="size ?? 18" :height="size ?? 18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="path" /></svg></template>
