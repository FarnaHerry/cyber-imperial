<script setup lang="ts">
import { computed, ref } from 'vue'
import StudioIcon from '../components/StudioIcon.vue'
import { PAGES, type PageKey } from '../core/navigation'
const props = defineProps<{ page: PageKey; theme: 'dark' | 'light' }>()
const emit = defineEmits<{ 'toggle-theme': [] }>()
const helpDialog = ref<HTMLDialogElement | null>(null)
const navDialog = ref<HTMLDialogElement | null>(null)
const navOpen = ref(false)
function openNavigation() {
  navOpen.value = true
  navDialog.value?.showModal()
}
const pageInfo = computed(() => PAGES.find(p => p.key === props.page)!)
const help = computed(() => ({
  emperor: '设置国号与名讳，维护宫册，再随机翻牌。翻牌结果可送入工坊拟旨。',
  treasury: '至宝自动归入皇室宝库，其他藏品归入国库。编目可修改类别与数量；入库和出库都会记入库簿，出库不能超过库存。',
  officials: '品级从正一品、从一品依次降至从九品，另设不入流。文武共用顺序、分别设置职名。在官册中选择文武与品级，还可为官员拟任命旨。',
  memorials: '具折人可从官册选取，也可手填。草稿上奏后进入待批队列，填写朱批并准奏、驳回或发回修改；发回的奏折可修订再奏，保留最近 20 次批阅记录。批复可送入工坊拟旨，库藏与官册由你另行办理。',
  palace: '点击地图建筑或宫阙名录，查看宫殿详情。题写名称与用途后保存，地图会同步更新。库藏与文武议事殿可直接前往相应页面。',
  studio: '',
}[props.page]))
</script>

<template>
  <div class="app-layout">
    <header class="topbar">
      <button class="brand" aria-label="展开页面导航" title="展开页面导航" aria-controls="page-navigation" :aria-expanded="navOpen" @click="openNavigation"><span class="brand-mark">帝</span></button>
      <div class="header-actions">
        <button class="icon-button help-button" aria-label="使用说明" title="使用说明" @click="helpDialog?.showModal()"><StudioIcon name="help" /></button>
        <button class="icon-button theme-button" :aria-label="theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'" :title="theme === 'dark' ? '浅色模式' : '深色模式'" @click="emit('toggle-theme')"><StudioIcon :name="theme === 'dark' ? 'sun' : 'moon'" /></button>
        <slot name="actions" />
      </div>
    </header>
    <dialog id="page-navigation" ref="navDialog" class="nav-drawer" aria-labelledby="navigation-title" @close="navOpen = false" @click="($event.target === navDialog) && navDialog?.close()">
      <button class="icon-button drawer-close" aria-label="关闭页面导航" @click="navDialog?.close()"><StudioIcon name="close" /></button>
      <span class="eyebrow">IMPERIAL NAVIGATION</span>
      <h2 id="navigation-title">御前导航</h2>
      <nav class="page-nav" aria-label="页面导航"><a v-for="item in PAGES" :key="item.key" :href="`#${item.key}`" :aria-current="page === item.key ? 'page' : undefined" @click="navDialog?.close()">{{ item.label }}</a></nav>
    </dialog>
    <div class="layout-content"><slot /></div>
    <dialog ref="helpDialog" class="help-dialog" aria-labelledby="help-title" @click="($event.target === helpDialog) && helpDialog?.close()"><button class="icon-button dialog-close" aria-label="关闭说明" @click="helpDialog?.close()"><StudioIcon name="close" /></button><span class="eyebrow">THE IMPERIAL GUIDE</span><h2 id="help-title">{{ page === 'studio' ? '一方玉玺，怎样用？' : `${pageInfo.label}，怎样用？` }}</h2><template v-if="page === 'studio'"><p>选择题笺，编辑正文，再选一方属于你的印。点击纸面即可落印，也可以从印盒拖动玉玺。落款用印会自动盖在正文末尾。</p><dl><dt>撤销 / 重做</dt><dd>Ctrl / ⌘ Z · Ctrl / ⌘ Shift Z</dd><dt>导出作品</dt><dd>Ctrl / ⌘ S · 2× 或 4× PNG</dd><dt>随机拟旨</dt><dd>Ctrl / ⌘ Enter</dd><dt>退出专注</dt><dd>Esc</dd></dl></template><p v-else>{{ help }}</p><p class="help-note">所有创作与记录自动保存至当前浏览器。字体为可选在线增强，其余操作在本机完成。</p></dialog>
    <slot name="overlays" />
  </div>
</template>

<style scoped>
.app-layout { --shell-offset: 86px; height: 100dvh; min-height: 480px; display: flex; flex-direction: column; }
.topbar { height: 86px; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 30px; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; padding: 0; border: 0; background: transparent; color: inherit; }
.brand-mark { font-family: var(--font-serif); font-size: 29px; display: grid; place-items: center; height: 43px; width: 43px; border: 1px solid #c58566; color: #e9ac8c; position: relative; transition: background .18s, box-shadow .18s; }
.brand:hover .brand-mark { background: #c5856612; box-shadow: 0 0 20px #c5856614; }
.brand-mark::after { content: ''; position: absolute; inset: 3px; border: 1px solid #c5856645; pointer-events: none; }
.header-actions { display: flex; align-items: center; gap: 18px; }
.nav-drawer { position: fixed; inset: 0 auto 0 0; margin: 0; width: 292px; max-width: 86vw; height: 100dvh; max-height: 100dvh; padding: 40px 26px; border: 0; border-right: 1px solid #c5856640; border-radius: 0; background: var(--panel); color: var(--text); box-shadow: 24px 0 70px #0004; }
.nav-drawer[open] { display: flex; flex-direction: column; animation: drawer-enter .22s ease-out; }
.nav-drawer::backdrop { background: #080d0bb8; backdrop-filter: blur(3px); animation: backdrop-enter .22s ease-out; }
.drawer-close { position: absolute; top: 20px; right: 18px; }
.nav-drawer h2 { margin: 15px 0 28px; font: 400 24px var(--font-serif); letter-spacing: 3px; }
.page-nav { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.page-nav a { padding: 14px 16px; color: var(--muted); font-size: 13px; letter-spacing: 2px; text-decoration: none; border: 1px solid transparent; border-radius: var(--radius); }
.page-nav a:hover { color: var(--text); background: #ffffff06; }
.page-nav a[aria-current='page'] { color: var(--accent); background: #c69f760a; border-color: #c69f762f; }
.layout-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
@keyframes drawer-enter { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes backdrop-enter { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 1100px) {
.app-layout { height: auto; min-height: 100dvh; }
.topbar { padding: 0 22px; }
}
@media (max-width: 700px) {
.topbar { height: 74px; padding: 0 16px; gap: 10px; }
.brand-mark { width: 35px; height: 35px; font-size: 24px; }
.header-actions { gap: 6px; }
.help-button { width: 27px; }
.theme-button { width: 26px; }
.help-button { display: none; }
.nav-drawer { padding: 36px 22px; }
}
</style>
