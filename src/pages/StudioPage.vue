<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ImperialCanvas from '../components/ImperialCanvas.vue'
import FloatingSeal from '../components/FloatingSeal.vue'
import StudioIcon from '../components/StudioIcon.vue'
import { useFontLibrary } from '../composables/useFontLibrary'
import { FONT_OPTIONS, birdUnsupported } from '../core/fonts'
import { TEMPLATES, type useStudio } from '../composables/useStudio'
import { INKS, inkByKey } from '../core/inks'
import { PAPERS } from '../core/paper'
import { clampSealPoint } from '../core/geometry'
import { createStamp } from '../core/stamp'
import { sealCharacters } from '../core/seal'
import { playStamp, unlockAudio } from '../core/audio'
import type { Point } from '../core/types'

const props = defineProps<{ studio: ReturnType<typeof useStudio>; active: boolean }>()
const emit = defineEmits<{ notice: [message: string] }>()
const exportScale = defineModel<2 | 4>('exportScale', { required: true })
const exporting = defineModel<boolean>('exporting', { required: true })
const overflow = defineModel<boolean>('overflow', { required: true })
const { state, restored, canUndo, canRedo, addStamp, undo, redo, clear, regenerate, createFromTemplate } = props.studio
const { fonts: customFonts, importing, importFont, ready: fontLibraryReady } = useFontLibrary()
function missingFont(key: string) { return key.startsWith('custom-') && !customFonts.value.some(f => f.key === key) }
const fontInput = ref<HTMLInputElement | null>(null)
const fontTarget = ref<'sealFont' | 'edictFont'>('sealFont')
const missingBirdChars = computed(() => birdUnsupported(sealText.value))
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
const stage = ref<InstanceType<typeof ImperialCanvas> | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const revealKey = ref(0)
const folded = ref(false)
const scrollMoving = ref(false)
const ghost = ref<Point | null>(null)
const selectedTemplate = ref<string>(restored ? '' : 'imperial')
const focusMode = ref(false)
const ink = computed(() => inkByKey(state.inkKey))
const sealText = computed(() => sealCharacters(state.sealText).join('') || '受命于天既寿永昌')
const characterCount = computed(() => Array.from(state.text.replace(/\s/g, '')).length)
const forceLabel = computed(() => state.force < .35 ? '轻触' : state.force < .7 ? '适中' : state.force < .9 ? '重按' : '全力')
function notify(message: string) { emit('notice', message) }
function stampAt(p: Point, signature = false) {
  if (folded.value || scrollMoving.value) return
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
  if (folded.value || scrollMoving.value) { notify('先展开圣旨，再落款用印'); return }
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
function toggleScroll() { ghost.value = null; folded.value = !folded.value }
function replayWriting() { folded.value = false; revealKey.value++ }
async function exportImage() {
  if (!stage.value || exporting.value || !props.active) return
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
  if (!props.active) return
  if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); void exportImage(); return }
  if (editing || target?.closest('dialog')) return
  if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
  else if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
  else if (e.key === 'Enter' && (meta || e.altKey)) { e.preventDefault(); randomize() }
  else if (e.key === 'Escape') focusMode.value = false
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
watch(() => props.active, () => { focusMode.value = false; ghost.value = null })
function resetTemplate() { selectedTemplate.value = '' }
defineExpose({ exportImage, resetTemplate })
</script>

<template>
  <main v-show="active" class="workspace" aria-label="御制工坊" :class="{ 'focus-mode': focusMode }" :style="{ '--ink': ink.color }">
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
          <div class="writing-actions"><button class="text-button" @click="randomize"><StudioIcon name="shuffle" :size="15" /> 随机拟旨</button><button class="text-button" :disabled="!characterCount" @click="replayWriting"><StudioIcon name="replay" :size="14" /> 重放书写</button></div>
        </section>
        <div class="editor-foot"><span class="small-seal">御</span><p>文字有温度，落印有分量。<br /><span>把这一刻，留在纸上。</span></p></div>
      </aside>

      <section class="canvas-workspace" aria-label="作品预览">
        <div class="canvas-toolbar">
          <div class="paper-picker" aria-label="纸张材质"><span class="toolbar-label">纸张</span><button v-for="paper in PAPERS" :key="paper.key" :class="{ active: state.paper === paper.key }" :aria-pressed="state.paper === paper.key" @click="state.paper = paper.key"><span :style="{ background: paper.color }" />{{ paper.label }}</button></div>
          <div class="scroll-tools"><button class="scroll-toggle" aria-controls="edict-scroll" :aria-expanded="!folded" @click="toggleScroll"><StudioIcon :name="folded ? 'unfold' : 'fold'" :size="15" />{{ folded ? '展开圣旨' : '收起圣旨' }}</button><button class="icon-button" :aria-label="focusMode ? '退出专注模式' : '专注模式'" :title="focusMode ? '退出专注模式 · Esc' : '专注模式'" :aria-pressed="focusMode" @click="focusMode = !focusMode"><StudioIcon :name="focusMode ? 'close' : 'expand'" :size="16" /></button></div>
        </div>
        <div class="canvas-surface">
          <div class="paper-holder"><ImperialCanvas ref="stage" v-model:rolling="scrollMoving" :folded="folded" :text="state.text" :reveal-key="revealKey" :ink="ink.color" :force="state.force" :erosion="state.erosion" :seal-size="state.sealSize" :seal-text="sealText" :ghost="ghost" :paper="state.paper" :stamps="state.stamps" :seal-font="state.sealFont" :edict-font="state.edictFont" :seal-angle="state.sealAngle" :kingdom="state.kingdom" :emperor="state.emperor" @stamp="stampAt" @overflow="overflow = $event" @unfold="folded = false" /></div>
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
        <div class="seal-actions"><button class="button signature-button" :disabled="!characterCount || folded || scrollMoving" @click="signature"><StudioIcon name="stamp" :size="17" /> 落款用印<span>↗</span></button><button class="sound-toggle" :aria-pressed="state.sound" @click="state.sound = !state.sound"><StudioIcon :name="state.sound ? 'volume' : 'mute'" :size="15" /><span>落印音效</span><span class="toggle-track" :class="{ on: state.sound }"><i /></span></button></div>
      </aside>
  </main>
    <FloatingSeal v-if="!focusMode && active" :ink="ink.color" :text="sealText" :font="state.sealFont" :angle="state.sealAngle" :erosion="state.erosion" :size="128" :dock="dockEl" :to-canvas="(x, y) => stage?.toCanvas(x, y) ?? null" @drop="({ clientX, clientY }) => { const p = stage?.toCanvas(clientX, clientY); if (p) stampAt(p) }" @hover="ghost = $event" />
    <input ref="fontInput" class="font-file-input" type="file" accept=".ttf,.otf,.woff,.woff2" aria-label="导入字体文件" @change="onFontFile" />
</template>

<style scoped>
.workspace { display: grid; grid-template-columns: 244px minmax(0, 1fr) 278px; flex: 1; min-height: 0; }
.side-panel { background: var(--panel); overflow-y: auto; min-height: 0; }
.editor { border-right: 1px solid var(--line); display: flex; flex-direction: column; }
.seal-panel { border-left: 1px solid var(--line); }
.panel-heading { height: 61px; min-height: 61px; display: flex; align-items: center; gap: 10px; padding: 0 21px; border-bottom: 1px solid var(--line); }
.section-index { font: 10px var(--font-serif); color: #b0997e; }
.panel-heading h2 { font-size: 12px; letter-spacing: 1.5px; font-weight: 500; margin: 0; }
.micro { font-size: 8px; letter-spacing: 1.5px; color: #626f65; margin-left: auto; }
.panel-section { padding: 23px 21px; }
.field-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 5px; font-size: 11px; color: #d0d6c8; margin-bottom: 12px; }
.field-heading h3 { margin: 0; font: inherit; }
.field-heading > span:last-child { color: #8b988e; font-size: 9px; }
.template-list { display: flex; flex-direction: column; gap: 8px; }
.template-card { width: 100%; display: flex; align-items: center; gap: 11px; position: relative; text-align: left; border: 1px solid #ffffff09; border-radius: var(--radius); padding: 11px; color: var(--text); background: #ffffff02; }
.template-card:hover { background: #ffffff05; border-color: #ffffff20; }
.template-card.selected { border-color: #c69f7660; background: #c69f760a; }
.template-mark { width: 30px; height: 34px; display: grid; place-items: center; color: #aeb8a5; font: 21px var(--font-serif); border-right: 1px solid #ffffff0d; padding-right: 9px; }
.selected .template-mark { color: #d7b18d; }
.template-copy { display: flex; flex-direction: column; gap: 4px; }
.template-copy strong { font-size: 11px; font-weight: 500; letter-spacing: .5px; }
.template-copy small { font-size: 8px; color: #8b978c; letter-spacing: .4px; }
.template-check { color: #d7b18d; position: absolute; right: 8px; top: 8px; }
.writing-section { padding-top: 0; display: flex; flex-direction: column; flex: 1 0 auto; min-height: 275px; }
.edict-input { display: block; width: 100%; border: 1px solid #ffffff12; border-radius: var(--radius); padding: 11px 12px; background: #10171265; color: #d6dacd; outline: none; font-size: 11px; }
.edict-input:focus { border-color: #c69f7680; }
.edict-input::placeholder { color: #758376; }
.body-label { margin-top: 22px; }
.edict-input { flex: 1; resize: vertical; min-height: 165px; line-height: 2.05; font-family: var(--font-serif); font-size: 12px; }
.writing-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.editor-foot { display: flex; gap: 12px; align-items: center; padding: 18px 21px; border-top: 1px solid var(--line); }
.small-seal { color: #b48d74; border: 1px solid #b48d7440; padding: 2px 3px; font: 20px var(--font-serif); }
.editor-foot p { margin: 0; font-size: 9px; color: #a2af9d; line-height: 1.9; }
.editor-foot p span { color: #7f8d80; }
.canvas-workspace { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: radial-gradient(ellipse at 50% 50%, #29332a40, transparent 75%), var(--bg); }
.canvas-toolbar { height: 61px; min-height: 61px; display: flex; justify-content: space-between; align-items: center; padding: 0 25px; border-bottom: 1px solid var(--line); }
.paper-picker { display: flex; align-items: center; gap: 4px; }
.toolbar-label { font-size: 10px; color: #8b998c; margin-right: 10px; }
.paper-picker button { display: flex; align-items: center; gap: 6px; border: 1px solid transparent; border-radius: var(--radius); background: none; color: #8b998c; padding: 6px 10px; font-size: 10px; }
.paper-picker button.active { background: #ffffff05; border-color: #ffffff10; color: #e2d9c4; }
.paper-picker button:hover { color: var(--text); }
.paper-picker button span { display: block; width: 10px; height: 10px; border: 1px solid #ffffff20; border-radius: var(--radius); }
.canvas-surface { flex: 1; min-height: 0; display: grid; place-items: center; container-type: size; overflow: hidden; padding: 32px; }
.paper-holder { width: min(100%, 150cqh); max-width: none; position: relative; }
.scroll-tools { display: flex; align-items: center; gap: 12px; }
.scroll-toggle { display: inline-flex; align-items: center; gap: 6px; flex: none; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: var(--accent); font-size: 10px; padding: 7px 9px; white-space: nowrap; }
.scroll-toggle:hover { border-color: var(--accent); }
.canvas-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 51px; height: 51px; padding: 0 22px; border-top: 1px solid var(--line); }
.history-tools { display: flex; align-items: center; gap: 4px; }
.stamp-counter { font-size: 9px; color: #8d9987; white-space: nowrap; }
.stamp-counter b { color: #cfcbbb; font: 14px var(--font-serif); margin-right: 4px; }
.seal-preview { display: flex; flex-direction: column; align-items: center; padding: 22px 21px 17px; border-bottom: 1px solid var(--line); background: var(--panel); position: sticky; top: 0; z-index: 4; }
.seal-orbit { position: relative; width: 142px; height: 142px; display: grid; place-items: center; background: radial-gradient(circle, #d7b18d08, transparent 70%); }
.seal-dock { width: 128px; height: 128px; }
.orbit-corner { position: absolute; width: 13px; height: 13px; border: 1px solid #a59a7040; }
.orbit-corner.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.orbit-corner.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.orbit-corner.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.orbit-corner.br { bottom: 0; right: 0; border-left: 0; border-top: 0; }
.preview-name { font: 12px var(--font-serif); letter-spacing: 3px; margin-top: 15px; color: #d9d6c3; }
.preview-instruction { font-size: 9px; color: #869380; margin-top: 7px; letter-spacing: .5px; }
.seal-settings { padding-top: 21px; padding-bottom: 0; }
.seal-text-input { font-family: var(--font-serif); letter-spacing: 2.5px; }
.ink-heading { margin-top: 23px; }
.ink-picker { display: flex; justify-content: space-between; }
.ink-picker button { border: 0; background: none; color: #8d9987; padding: 4px; display: flex; flex-direction: column; gap: 9px; align-items: center; }
.ink-picker button > span { width: 22px; height: 22px; border-radius: var(--radius); background: var(--swatch); box-shadow: 0 0 0 4px var(--panel), 0 0 0 5px transparent; }
.ink-picker button.active > span { box-shadow: 0 0 0 4px var(--panel), 0 0 0 5px var(--swatch); }
.ink-picker small { font-size: 9px; }
.ink-picker button.active small { color: #dedccb; }
.slider-field { margin-top: 24px; }
.slider-field label { display: flex; justify-content: space-between; font-size: 11px; color: #d0d6c8; }
.slider-field label > span { font-size: 9px; color: #8d9987; }
.slider-field b { font-size: 10px; color: #d6b491; font-weight: 400; margin-left: 5px; font-variant-numeric: tabular-nums; }
.range-labels { display: flex; justify-content: space-between; font-size: 8px; color: #7e8d7e; }
.seal-actions { padding: 24px 21px 18px; }
.sound-toggle { display: flex; width: 100%; gap: 9px; align-items: center; background: none; border: 0; color: #9ba895; font-size: 10px; padding: 17px 0 0; }
.toggle-track { width: 25px; height: 13px; border-radius: var(--radius); background: #39443a; padding: 3px; margin-left: auto; }
.toggle-track i { display: block; width: 7px; height: 7px; background: #879485; border-radius: var(--radius); transition: transform .18s; }
.toggle-track.on { background: #708768; }
.toggle-track.on i { background: #e4e4d2; transform: translateX(12px); }
.workspace.focus-mode { grid-template-columns: 1fr; }
.focus-mode .side-panel { display: none; }

@media (min-width: 1600px) {
.workspace { grid-template-columns: 270px minmax(0, 1fr) 300px; }
.panel-section { padding-left: 26px; padding-right: 26px; }
.canvas-surface { padding-left: 40px; padding-right: 40px; }
}
@media (max-height: 780px) and (min-width: 1101px) {
.panel-section { padding-top: 18px; padding-bottom: 18px; }
.writing-section { padding-top: 0; }
.seal-preview { padding-top: 15px; padding-bottom: 13px; }
.seal-orbit { width: 130px; height: 128px; }
.slider-field { margin-top: 20px; }
.seal-actions { padding-top: 19px; }
.editor-foot { display: none; }
}
@media (max-width: 1100px) {
.workspace { grid-template-columns: minmax(0, 1fr) 270px; min-height: 0; }
.canvas-workspace { min-height: 650px; }
.seal-panel { max-height: none; overflow: visible; }
.seal-preview { position: relative; }
.editor { grid-column: 1 / -1; grid-row: 2; display: grid; grid-template-columns: 240px 1fr; border-top: 1px solid var(--line); }
.editor .panel-heading { grid-column: 1/-1; }
.editor .template-section { grid-column: 1; }
.editor .writing-section { grid-column: 2; padding-top: 23px; }
.editor-foot { display: none; }
.edict-input { min-height: 180px; resize: vertical; }
.paper-holder { max-width: 100%; }
.canvas-surface { padding: 28px 24px; }
.focus-mode .canvas-workspace { min-height: calc(100dvh - 120px); }
}
@media (max-width: 700px) {
.workspace { display: flex; flex-direction: column; }
.canvas-workspace { order: 0; min-height: 490px; }
.canvas-toolbar { height: 51px; min-height: 51px; padding: 0 16px; }
.scroll-tools { gap: 5px; }
.scroll-toggle { padding: 6px; }
.paper-picker .toolbar-label { display: none; }
.paper-picker button { padding: 6px 5px; }
.canvas-surface { padding: 25px 22px; }
.canvas-bottom { padding: 0 14px; }
.stamp-counter { font-size: 8px; }
.seal-panel { order: 1; border: 0; border-top: 1px solid var(--line); display: grid; grid-template-columns: 140px minmax(0, 1fr); }
.seal-panel .panel-heading { grid-column: 1/-1; }
.seal-preview { border-bottom: 0; padding: 24px 0; align-self: start; }
.seal-orbit { width: 126px; height: 132px; }
.preview-name { font-size: 11px; }
.preview-instruction { font-size: 8px; }
.seal-settings { padding: 24px 21px 0 10px; }
.seal-text-input { font-size: 10px; letter-spacing: 1px; padding: 10px; }
.seal-actions { grid-column: 1/-1; padding: 22px; }
.editor { order: 2; display: flex; }
.editor .writing-section { padding-top: 0; }
.template-list { display: grid; grid-template-columns: 1fr 1fr; }
.template-card { padding: 11px 7px; gap: 6px; }
.template-copy small { font-size: 7px; }
.template-copy strong { font-size: 10px; }
.template-check { right: 4px; top: 4px; }
.focus-mode .canvas-workspace { min-height: calc(100dvh - 122px); }
.focus-mode .side-panel { display: none; }

}
.font-control { margin-top: 18px; display: flex; flex-direction: column; align-items: stretch; gap: 9px; }
.font-control > label { font-size: 11px; color: var(--text); }
.font-select { width: 100%; background: #10171265; border: 1px solid #ffffff12; border-radius: var(--radius); padding: 10px; font-size: 11px; color: var(--text); }
.font-control .text-button { justify-content: flex-start; font-size: 9px; }
.font-file-input { display: none; }
.angle-presets { display: flex; justify-content: space-between; }
.angle-presets button[aria-pressed='true'] { color: var(--accent); }
@media (max-width: 700px) {
.font-select { font-size: 12px; }
.focus-mode .canvas-workspace { min-height: calc(100dvh - 179px); }
}

@media (max-width: 1100px) and (min-width: 701px) {
  .canvas-workspace { position: sticky; top: 0; align-self: start; height: max(480px, calc(100dvh - var(--shell-offset, 120px))); min-height: 0; }
}
@media (max-width: 700px) {
  .canvas-workspace { min-height: 0; }
  .canvas-surface { flex: none; container-type: normal; padding: 28px 22px; }
  .paper-holder { width: 100%; }
  .workspace.focus-mode .canvas-workspace { min-height: 0; }
}
</style>
