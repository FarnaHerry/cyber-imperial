<script setup lang="ts">
defineProps<{ title: string; eyebrow: string; description: string }>()
</script>
<template>
  <main class="empire-page" :aria-label="title">
    <div class="empire-content">
      <header class="empire-heading"><div><span class="eyebrow">{{ eyebrow }}</span><h1>{{ title }}</h1><p>{{ description }}</p></div><div class="empire-heading-actions"><slot name="actions" /></div></header>
      <slot />
    </div>
  </main>
</template>
<style scoped>
.empire-page { flex: 1; min-height: 0; overflow-y: auto; padding: 34px 36px 40px; }
.empire-content { width: 100%; max-width: 1320px; margin: auto; }
.empire-heading { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 28px; }
.empire-heading h1 { font: 400 32px var(--font-serif); letter-spacing: 5px; margin: 12px 0; }
.empire-heading p { font-size: 12px; line-height: 1.9; color: var(--muted); margin: 0; }
.empire-heading-actions { flex: none; display: flex; align-items: center; gap: 12px; }
@media (max-width: 1100px) { .empire-page { overflow: visible; padding: 28px 24px; } }
@media (max-width: 700px) { .empire-page { padding: 24px 16px; }.empire-heading { align-items: stretch; flex-direction: column; gap: 18px; }.empire-heading h1 { font-size: 28px; }.empire-heading-actions { flex-wrap: wrap; } }
</style>
