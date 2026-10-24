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
.empire-page { flex: 1; min-height: 0; overflow-y: auto; padding: 38px 36px 48px; }
.empire-content { width: 100%; max-width: var(--content-max); margin: 0 auto; }
.empire-heading { position: relative; display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 1px solid var(--line); }
.empire-heading::after { content: ''; position: absolute; left: 0; bottom: -1px; width: 72px; height: 1px; background: linear-gradient(90deg, var(--accent), var(--accent-border)); }
.empire-heading > div:first-child { min-width: 0; max-width: 780px; }
.empire-heading .eyebrow { display: flex; align-items: center; gap: 10px; letter-spacing: 3px; }
.empire-heading .eyebrow::before { content: ''; width: 18px; height: 1px; flex: none; background: var(--accent-border); }
.empire-heading h1 { margin: 10px 0 9px; color: var(--text); font: 400 34px/1.45 var(--font-serif); letter-spacing: 4px; }
.empire-heading p { max-width: 68ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.9; }
.empire-heading-actions { flex: none; display: flex; align-items: center; gap: 12px; padding-bottom: 3px; }
@media (max-width: 1100px) {
.empire-page { overflow: visible; padding: 30px 24px 40px; }
.empire-heading { gap: 24px; }
}
@media (max-width: 700px) {
.empire-page { padding: 24px 16px 36px; }
.empire-heading { align-items: stretch; flex-direction: column; gap: 18px; margin-bottom: 24px; padding-bottom: 21px; }
.empire-heading h1 { margin: 9px 0 8px; font-size: 28px; letter-spacing: 3px; }
.empire-heading .eyebrow { letter-spacing: 2.5px; }
.empire-heading-actions { flex-wrap: wrap; padding-bottom: 0; }
}
</style>
