<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ImperialCanvas from './components/ImperialCanvas.vue'
import FloatingSeal from './components/FloatingSeal.vue'
import StudioIcon from './components/StudioIcon.vue'
import EmperorPage from './components/EmperorPage.vue'
import { useFontLibrary } from './composables/useFontLibrary'
import { FONT_OPTIONS, birdUnsupported } from './core/fonts'
import { palaceEdict, type DrawRecord } from './core/palace'
import { useStudio, TEMPLATES } from './composables/useStudio'
import { INKS, inkByKey } from './core/inks'
import { PAPERS } from './core/paper'
import { clampSealPoint } from './core/geometry'
import { createStamp } from './core/stamp'
import { sealCharacters } from './core/seal'
import { playStamp, unlockAudio } from './core/audio'
import type { Point } from './core/types'

const { state, restored, saveStatus, canUndo, canRedo, addStamp, undo, redo, clear, regenerate, createFromTemplate, flip } = useStudio()
const { fonts: customFonts, importing, importFont, ready: fontLibraryReady } = useFontLibrary()
function missingFont(key: string) { return key.startsWith('custom-') && !customFonts.value.some(f => f.key === key) }
const page = ref(window.location.hash === '#emperor' ? 'emperor' : 'studio')
const fontInput = ref<HTMLInputElement | null>(null)
const fontTarget = ref<'sealFont' | 'edictFont'>('sealFont')
const missingBirdChars = computed(() => birdUnsupported(sealText.value))
function onPageChange() { page.value = window.location.hash === '#emperor' ? 'emperor' : 'studio'; focusMode.value = false; ghost.value = null }
function navigate(target: 'studio' | 'emperor') { window.location.hash = target }
function fromPalace(record: DrawRecord) {
  state.subject = record.name
  state.text = palaceEdict(record, state.kingdom, state.emperor)
  selectedTemplate.value = ''
  navigate('studio')
  notify(`已为${record.name}拟旨，原有印痕保留`)
}
function chooseFontFile(target: 'sealFont' | 'edictFont') { fontTarget.value = target; fontInput.value?.click() }
async function onFontFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const imported = await importFont(file)
    state[fontTarget.value] = imported.key
    notify(imported.persisted ? '字体已导入并保存至本机' : '字体已导入，本次会话有效')
  } catch (error) { notify(error instanceof Error ? error.message : '字体导入失败') }
  finally { input.value = '' }
}
watch(() => state.theme, value => { document.documentElement.dataset.theme = value }, { immediate: true })
const stage = ref<InstanceType<typeof ImperialCanvas> | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const helpDialog = ref<HTMLDialogElement | null>(null)
const revealKey = ref(0)
const ghost = ref<Point | null>(null)
const selectedTemplate = ref<string>(restored ? '' : 'imperial')
const exportScale = ref<2 | 4>(2)
const exporting = ref(false)
const focusMode = ref(false)
const overflow = ref(false)
const toast = ref('')
let toastTimer = 0
const ink = computed(() => inkByKey(state.inkKey))
const sealText = computed(() => sealCharacters(state.sealText).join('') || '受命于天既寿永昌')
const characterCount = computed(() => Array.from(state.text.replace(/\s/g, '')).length)
const forceLabel = computed(() => state.force < .35 ? '轻触' : state.force < .7 ? '适中' : state.force < .9 ? '重按' : '全力')
const saveLabel = computed(() => saveStatus.value === 'saved' ? '草稿已保存至本机' : saveStatus.value === 'saving' ? '正在保存…' : '无法保存至本机，请及时导出')
function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.value = '', 2800)
}
function stampAt(p: Point, signature = false) {
  const force = signature ? Math.min(1, state.force + .12) : state.force
  const point = clampSealPoint(p, state.sealSize, state.sealAngle)
  const ok = addStamp(createStamp({
    x: point.x,
    y: point.y,
    size: state.sealSize, ink: ink.value.color, force, erosion: state.erosion, text: sealText.value,
    font: state.sealFont, angle: state.sealAngle,
  }))
  if (!ok) { notify('印痕已达 500 枚，请清空后继续'); return }
  if (state.sound) { unlockAudio(); playStamp(force) }
}
function signature() {
  const p = stage.value?.signature()
  if (!p) { notify('先写下正文，再落款用印'); return }
  stampAt(p, true)
  notify('落款已用印')
}
function selectTemplate(template: typeof TEMPLATES[number]) {
  selectedTemplate.value = template.key
  createFromTemplate(template)
  notify(`已切换「${template.label}」`)
}
function randomize() { regenerate(); selectedTemplate.value = ''; notify('新诏书已拟好') }
async function exportImage() {
  if (!stage.value || exporting.value || page.value !== 'studio') return
  if (overflow.value) { notify('正文超出纸面，请减少换行或缩短正文后导出'); return }
  exporting.value = true
  try {
    await stage.value.download(exportScale.value, `赛博玉玺-${state.subject.trim() || '御制'}-${new Date().toISOString().slice(0, 10)}`)
    notify('作品已导出为 PNG')
  } catch { notify('导出失败，请重试') }
  finally { exporting.value = false }
}
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const editing = target?.closest('input, textarea, select, [contenteditable="true"]')
  const meta = e.ctrlKey || e.metaKey
  if (page.value !== 'studio') return
  if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); void exportImage(); return }
  if (editing || helpDialog.value?.open) return
  if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
  else if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
  else if (e.key === 'Enter' && (meta || e.altKey)) { e.preventDefault(); randomize() }
  else if (e.key === 'Escape') focusMode.value = false
}
onMounted(() => { window.addEventListener('keydown', onKeydown); window.addEventListener('hashchange', onPageChange); if (restored) notify('已恢复上次的作品，继续落笔吧') })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); window.removeEventListener('hashchange', onPageChange); clearTimeout(toastTimer) })
</script>

<template>
  <div class="studio" :class="{ 'focus-mode': focusMode }" :style="{ '--ink': ink.color }">
    <header class="topbar">
      <a class="brand" href="#studio" aria-label="赛博玉玺首页"><span class="brand-mark">玺</span><span class="brand-copy"><strong>赛博玉玺<span class="version">叁</span></strong><small>CYBER IMPERIAL SEAL</small></span></a>
      <nav class="page-nav" aria-label="页面导航"><a href="#studio" :aria-current="page === 'studio' ? 'page' : undefined">御制工坊</a><a href="#emperor" :aria-current="page === 'emperor' ? 'page' : undefined">赛博皇帝</a></nav>
      <div class="header-actions">
        <button class="icon-button help-button" aria-label="使用说明" title="使用说明" @click="helpDialog?.showModal()"><StudioIcon name="help" /></button>
        <button class="icon-button theme-button" :aria-label="state.theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'" :title="state.theme === 'dark' ? '浅色模式' : '深色模式'" @click="state.theme = state.theme === 'dark' ? 'light' : 'dark'"><StudioIcon :name="state.theme === 'dark' ? 'sun' : 'moon'" /></button>
        <div v-if="page === 'studio'" class="export-control"><select v-model="exportScale" aria-label="导出分辨率"><option :value="2">2× 高清</option><option :value="4">4× 超清</option></select><button class="button export-button" :disabled="exporting || overflow" @click="exportImage"><StudioIcon name="download" :size="16" />{{ exporting ? '导出中…' : '导出作品' }}</button></div>
      </div>
    </header>

    <main v-show="page === 'studio'" class="workspace">
      <aside class="editor side-panel" aria-label="诏书编辑">
        <div class="panel-heading"><span class="section-index">01</span><h2>拟一道诏书</h2><span class="micro">EDICT</span></div>
        <section class="panel-section template-section">
          <div class="field-heading"><h3>选择题笺</h3><span>四种灵感起笔</span></div>
          <div class="template-list"><button v-for="template in TEMPLATES" :key="template.key" class="template-card" :class="{ selected: selectedTemplate === template.key }" :aria-pressed="selectedTemplate === template.key" @click="selectTemplate(template)"><span class="template-mark">{{ template.mark }}</span><span class="template-copy"><strong>{{ template.label }}</strong><small>{{ template.hint }}</small></span><span v-if="selectedTemplate === template.key" class="template-check"><StudioIcon name="check" :size="14" /></span></button></div>
        </section>
        <section class="panel-section writing-section">
          <label class="field-heading" for="subject"><span>受封者</span><span>可选</span></label>
          <input id="subject" v-model="state.subject" class="text-input" maxlength="12" placeholder="写下一个名字" />
          <div class="font-control"><label for="edict-font">圣旨字体</label><select id="edict-font" v-model="state.edictFont" class="font-select"><option v-if="missingFont(state.edictFont)" :value="state.edictFont" disabled>{{ fontLibraryReady ? '本地字体未能载入，请重新导入' : '正在载入本地字体…' }}</option><option v-for="font in FONT_OPTIONS.filter(f => f.key !== 'bird')" :key="font.key" :value="font.key">{{ font.label }}</option><option v-for="font in customFonts" :key="font.key" :value="font.key">{{ font.label }}</option></select><button class="text-button" :disabled="importing" @click="chooseFontFile('edictFont')">{{ importing ? '正在导入…' : '＋ 导入本地字体' }}</button></div>
          <div class="field-heading body-label"><label for="edict">诏书正文</label><span>{{ characterCount }} 字</span></div>
          <textarea id="edict" v-model="state.text" class="edict-input" maxlength="1200" spellcheck="false" placeholder="从右至左，写下你想说的话…" @input="selectedTemplate = ''" />
          <p v-if="overflow" class="overflow-warning" role="alert">正文分栏超出纸面，请减少换行或缩短正文后导出。</p>
          <div class="writing-actions"><button class="text-button" @click="randomize"><StudioIcon name="shuffle" :size="15" /> 随机拟旨</button><button class="text-button" :disabled="!characterCount" @click="revealKey++"><StudioIcon name="replay" :size="14" /> 重放书写</button></div>
        </section>
        <div class="editor-foot"><span class="small-seal">御</span><p>文字有温度，落印有分量。<br /><span>把这一刻，留在纸上。</span></p></div>
      </aside>

      <section class="canvas-workspace" aria-label="作品预览">
        <div class="canvas-toolbar"><div class="paper-picker" aria-label="纸张材质"><span class="toolbar-label">纸张</span><button v-for="paper in PAPERS" :key="paper.key" :class="{ active: state.paper === paper.key }" :aria-pressed="state.paper === paper.key" @click="state.paper = paper.key"><span :style="{ background: paper.color }" />{{ paper.label }}</button></div><button class="icon-button" :aria-label="focusMode ? '退出专注模式' : '专注模式'" :title="focusMode ? '退出专注模式 · Esc' : '专注模式'" :aria-pressed="focusMode" @click="focusMode = !focusMode"><StudioIcon :name="focusMode ? 'close' : 'expand'" :size="16" /></button></div>
        <div class="canvas-surface"><div class="canvas-intro"><span class="eyebrow">THE ART OF LEAVING A MARK</span><h1>落一方印，见一方天地。</h1><p>传统的仪式感，也可以很赛博。</p></div>
          <div class="paper-holder"><ImperialCanvas ref="stage" :text="state.text" :reveal-key="revealKey" :ink="ink.color" :force="state.force" :erosion="state.erosion" :seal-size="state.sealSize" :seal-text="sealText" :ghost="ghost" :paper="state.paper" :stamps="state.stamps" :seal-font="state.sealFont" :edict-font="state.edictFont" :seal-angle="state.sealAngle" :kingdom="state.kingdom" :emperor="state.emperor" @stamp="stampAt" @overflow="overflow = $event" /></div>
          <div class="canvas-caption"><span class="caption-line" /><span>点击纸面落印，或将右侧玉玺拖至此处</span><span class="caption-line" /></div>
        </div>
        <div class="canvas-bottom"><div class="history-tools"><button class="icon-button" :disabled="!canUndo" aria-label="撤销" title="撤销 · Ctrl / ⌘ Z" @click="undo"><StudioIcon name="undo" :size="16" /></button><button class="icon-button" :disabled="!canRedo" aria-label="重做" title="重做 · Ctrl / ⌘ Shift Z" @click="redo"><StudioIcon name="redo" :size="16" /></button><span class="tool-divider" /><button class="text-button clear-button" :disabled="!state.stamps.length" @click="clear"><StudioIcon name="trash" :size="14" /> 清空印痕</button></div><span class="stamp-counter"><b>{{ String(state.stamps.length).padStart(2, '0') }}</b> 枚印痕 <span class="tool-divider" /> 1200 × 800</span></div>
      </section>

      <aside class="seal-panel side-panel" aria-label="玉玺设置">
        <div class="panel-heading"><span class="section-index">02</span><h2>琢一方玉玺</h2><span class="micro">SEAL</span></div>
        <section class="seal-preview"><div class="seal-orbit"><span class="orbit-corner tl" /><span class="orbit-corner tr" /><span class="orbit-corner bl" /><span class="orbit-corner br" /><div ref="dockEl" class="seal-dock" /></div><span class="preview-name">{{ sealText === '受命于天既寿永昌' ? '传国玉玺' : '私人藏印' }}</span><span class="preview-instruction">拖动玉玺，亲手落印</span></section>
        <section class="panel-section seal-settings">
          <label class="field-heading" for="seal-text"><span>印文</span><span>1–8 字 · 右起竖读</span></label><input id="seal-text" v-model="state.sealText" class="text-input seal-text-input" maxlength="8" placeholder="受命于天既寿永昌" />
          <div class="font-control"><label for="seal-font">玉玺字体</label><select id="seal-font" v-model="state.sealFont" class="font-select"><option v-if="missingFont(state.sealFont)" :value="state.sealFont" disabled>{{ fontLibraryReady ? '本地字体未能载入，请重新导入' : '正在载入本地字体…' }}</option><option v-for="font in FONT_OPTIONS" :key="font.key" :value="font.key">{{ font.label }}</option><option v-for="font in customFonts" :key="font.key" :value="font.key">{{ font.label }}</option></select><button class="text-button" :disabled="importing" @click="chooseFontFile('sealFont')">{{ importing ? '正在导入…' : '＋ 导入本地字体' }}</button><p v-if="state.sealFont === 'bird'" class="field-note">内置原创八字鸟虫篆风格印面。<template v-if="missingBirdChars.length">「{{ missingBirdChars.join('') }}」使用宋体补字，可切换或导入字体。</template></p></div>
          <div class="slider-field angle-field"><label for="seal-angle">盖章角度<span>{{ state.sealAngle > 0 ? '+' : '' }}<b>{{ state.sealAngle }}°</b></span></label><input id="seal-angle" v-model.number="state.sealAngle" type="range" min="-180" max="180" step="1" :style="{ '--progress': `${(state.sealAngle + 180) / 360 * 100}%` }" /><div class="angle-presets"><button v-for="angle in [-45, 0, 45, 90]" :key="angle" class="text-button" :aria-pressed="state.sealAngle === angle" @click="state.sealAngle = angle">{{ angle === 0 ? '归正' : `${angle}°` }}</button></div></div>
          <div class="field-heading ink-heading"><h3>印泥色泽</h3><span>{{ ink.label }}</span></div>
          <div class="ink-picker"><button v-for="item in INKS" :key="item.key" :aria-label="item.label" :aria-pressed="state.inkKey === item.key" :class="{ active: state.inkKey === item.key }" :style="{ '--swatch': item.color }" @click="state.inkKey = item.key"><span /><small>{{ item.label }}</small></button></div>
          <div class="slider-field"><label for="force">落印力度<span>{{ forceLabel }} <b>{{ Math.round(state.force * 100) }}%</b></span></label><input id="force" v-model.number="state.force" type="range" min="0.15" max="1" step="0.01" :style="{ '--progress': `${(state.force - .15) / .85 * 100}%` }" /><div class="range-labels"><span>轻触</span><span>重按</span></div></div>
          <div class="slider-field"><label for="erosion">岁月痕迹<span><b>{{ Math.round(state.erosion * 100) }}%</b></span></label><input id="erosion" v-model.number="state.erosion" type="range" min="0" max="0.92" step="0.01" :style="{ '--progress': `${state.erosion / .92 * 100}%` }" /><div class="range-labels"><span>新刻</span><span>斑驳</span></div></div>
          <div class="slider-field"><label for="seal-size">印面尺寸<span><b>{{ state.sealSize }}</b> px</span></label><input id="seal-size" v-model.number="state.sealSize" type="range" min="60" max="260" step="1" :style="{ '--progress': `${(state.sealSize - 60) / 200 * 100}%` }" /><div class="range-labels"><span>小巧</span><span>恢宏</span></div></div>
        </section>
        <div class="seal-actions"><button class="button signature-button" :disabled="!characterCount" @click="signature"><StudioIcon name="stamp" :size="17" /> 落款用印<span>↗</span></button><button class="sound-toggle" :aria-pressed="state.sound" @click="state.sound = !state.sound"><StudioIcon :name="state.sound ? 'volume' : 'mute'" :size="15" /><span>落印音效</span><span class="toggle-track" :class="{ on: state.sound }"><i /></span></button></div>
      </aside>
    </main>
    <EmperorPage v-if="page === 'emperor'" :state="state" :flip="flip" @edict="fromPalace" @studio="navigate('studio')" />
    <footer class="statusbar"><span class="save-status" :class="{ unavailable: saveStatus === 'unavailable' }"><span class="status-light" />{{ saveLabel }}</span><span class="footer-motto">受命于天，既寿永昌。</span><span v-if="page === 'studio'" class="shortcut-hint"><kbd>⌘ / Ctrl</kbd> + <kbd>S</kbd> 导出 <span>·</span> 所有创作留在本机</span><span v-else class="shortcut-hint">宫册与翻牌簿自动保存至本机</span></footer>
    <FloatingSeal v-if="!focusMode && page === 'studio'" :ink="ink.color" :text="sealText" :font="state.sealFont" :angle="state.sealAngle" :erosion="state.erosion" :size="128" :dock="dockEl" :to-canvas="(x, y) => stage?.toCanvas(x, y) ?? null" @drop="({ clientX, clientY }) => { const p = stage?.toCanvas(clientX, clientY); if (p) stampAt(p) }" @hover="ghost = $event" />
    <input ref="fontInput" class="font-file-input" type="file" accept=".ttf,.otf,.woff,.woff2" aria-label="导入字体文件" @change="onFontFile" />
    <Transition name="toast"><div v-if="toast" class="toast-message" role="status"><StudioIcon name="check" :size="16" />{{ toast }}</div></Transition>
    <dialog ref="helpDialog" class="help-dialog" aria-labelledby="help-title" @click="($event.target === helpDialog) && helpDialog?.close()"><button class="icon-button dialog-close" aria-label="关闭说明" @click="helpDialog?.close()"><StudioIcon name="close" /></button><span class="eyebrow">A SMALL RITUAL</span><h2 id="help-title">一方玉玺，怎样用？</h2><p>选择题笺，编辑正文，再选一方属于你的印。点击纸面即可落印，也可以从印盒拖动玉玺。落款用印会自动盖在正文末尾。</p><dl><dt>撤销 / 重做</dt><dd>Ctrl / ⌘ Z · Ctrl / ⌘ Shift Z</dd><dt>导出作品</dt><dd>Ctrl / ⌘ S · 2× 或 4× PNG</dd><dt>随机拟旨</dt><dd>Ctrl / ⌘ Enter</dd><dt>退出专注</dt><dd>Esc</dd></dl><p class="help-note">草稿与印痕自动保存在当前浏览器。清空印痕也可以撤销；文字编辑使用输入框自身的撤销功能。字体为可选在线增强，其余创作在本机完成。</p></dialog>
  </div>
</template>

