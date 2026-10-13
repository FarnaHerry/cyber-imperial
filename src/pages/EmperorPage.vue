<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { StudioState } from '../composables/useStudio'
import type { DrawRecord, PalaceMember } from '../core/palace'
import StudioIcon from '../components/StudioIcon.vue'
const props = defineProps<{ state: StudioState; flip: () => DrawRecord | null }>()
const emit = defineEmits<{ edict: [DrawRecord]; studio: [] }>()
const drawing = ref(false)
const editor = ref<HTMLDialogElement | null>(null)
const editingId = ref<string | null>(null)
const form = ref({ name: '', title: '', palace: '' })
const formError = ref('')
const removed = ref<{ member: PalaceMember; index: number } | null>(null)
const activeCount = computed(() => props.state.members.filter(m => m.enabled).length)
const selected = computed(() => props.state.draws[0] ?? null)
let timer = 0
function flipCard() {
  if (drawing.value || !activeCount.value) return
  drawing.value = true
  timer = window.setTimeout(() => { props.flip(); drawing.value = false }, 850)
}
function edit(member?: PalaceMember) {
  editingId.value = member?.id ?? null
  form.value = { name: member?.name ?? '', title: member?.title ?? '美人', palace: member?.palace ?? '未央宫' }
  formError.value = ''
  editor.value?.showModal()
}
function submit() {
  const name = form.value.name.trim(), title = form.value.title.trim(), palace = form.value.palace.trim()
  if (!name || !title || !palace) { formError.value = '请填写姓名、位份与宫苑'; return }
  if ([name, title, palace].some(v => Array.from(v).length > 12)) { formError.value = '每项最多 12 字'; return }
  if (editingId.value) {
    const member = props.state.members.find(m => m.id === editingId.value)
    if (member) Object.assign(member, { name, title, palace })
  } else {
    if (props.state.members.length >= 24) { formError.value = '宫册最多容纳 24 位人物'; return }
    props.state.members.push({ id: crypto.randomUUID(), name, title, palace, enabled: true })
  }
  editor.value?.close()
}
function remove(member: PalaceMember) {
  const index = props.state.members.findIndex(m => m.id === member.id)
  if (index < 0) return
  removed.value = { member: { ...member }, index }
  props.state.members.splice(index, 1)
  editor.value?.close()
}
function restoreMember() {
  if (!removed.value || props.state.members.length >= 24) return
  props.state.members.splice(removed.value.index, 0, removed.value.member)
  removed.value = null
}
function time(at: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(at)) }
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <main class="emperor-page">
    <section class="royal-profile palace-panel">
      <span class="eyebrow">THE CYBER EMPEROR</span><div class="royal-emblem" aria-hidden="true">帝</div>
      <p class="royal-overline">{{ state.kingdom.trim() || '赛博' }} · 御极于云端</p>
      <h1>{{ state.emperor.trim() || '赛博皇帝' }}</h1><p class="royal-description">一朝一号，一字一旨。<br />此间天地，由你落笔。</p>
      <div class="royal-settings"><label for="kingdom-name">国号<span>最多 12 字</span></label><input id="kingdom-name" v-model="state.kingdom" class="text-input" maxlength="12" placeholder="赛博" /><label for="emperor-name">皇帝名讳<span>可留空</span></label><input id="emperor-name" v-model="state.emperor" class="text-input" maxlength="12" placeholder="写下朕的名讳" /><p class="field-note">用于新拟圣旨的称谓，以及卷轴上的御制落款。</p></div>
      <button class="button signature-button" @click="emit('studio')"><StudioIcon name="stamp" :size="16" /> 移驾御制工坊 <span>↗</span></button>
    </section>
    <section class="palace-main">
      <div class="palace-heading"><div><span class="eyebrow">THE INNER COURT</span><h2>今夜，翻谁的牌？</h2><p>一方名牌，一场良辰。宫册由你定，缘分交给天意。</p></div><button class="button subtle-button" :disabled="drawing || state.members.length >= 24" @click="edit()">＋ 添入宫册</button></div>
      <div class="palace-toolbar"><span><b>{{ activeCount }}</b> 位可翻 · {{ state.members.length }} 位入册</span><label class="repeat-setting"><input v-model="state.avoidRepeat" type="checkbox" :disabled="drawing" /> 避免连续翻中同一人</label></div>
      <div v-if="state.members.length" class="palace-cards" :class="{ drawing }">
        <article v-for="(member, i) in state.members" :key="member.id" class="palace-card" :class="{ inactive: !member.enabled, chosen: selected?.memberId === member.id && !drawing }" :style="{ '--card-index': i }">
          <button class="card-edit" :aria-label="`编辑${member.name}`" :disabled="drawing" @click="edit(member)">编辑</button>
          <div class="name-plaque"><span class="plaque-palace">{{ member.palace }}</span><span class="plaque-name">{{ member.name }}</span><span class="plaque-title">{{ member.title }}</span><span class="plaque-knot" aria-hidden="true">◇</span></div>
          <button class="card-eligibility" :aria-label="`${member.name}参与翻牌`" :aria-pressed="member.enabled" :disabled="drawing" @click="member.enabled = !member.enabled"><span class="status-light" />{{ member.enabled ? '参与翻牌' : '暂不参与' }}</button>
        </article>
      </div>
      <div v-else class="palace-empty"><span>宫册尚空</span><p>添入一位人物，再开启今夜的故事。</p><button class="button subtle-button" @click="edit()">＋ 添入宫册</button></div>
      <div v-if="removed" class="restore-member" role="status">已移出 {{ removed.member.name }} <button class="text-button" :disabled="state.members.length >= 24" @click="restoreMember">恢复入册</button></div>
      <div class="flip-action"><button class="button flip-button" :disabled="drawing || !activeCount" @click="flipCard"><span aria-hidden="true">✧</span>{{ drawing ? '天意流转，候旨片刻…' : '随机翻牌' }}<span aria-hidden="true">✧</span></button><p>{{ !activeCount ? '请先启用一位人物参与翻牌' : state.avoidRepeat && activeCount > 1 ? '等概率抽取，跳过上次翻中的人物' : '在参与翻牌的人物中等概率抽取' }}</p></div>
      <Transition name="reveal"><section v-if="selected && !drawing" class="flip-result" aria-live="polite"><div><span class="eyebrow">TONIGHT’S DESTINY</span><p>今夜翻中 <strong>{{ selected.title }} · {{ selected.name }}</strong><span>{{ selected.palace }}</span></p></div><button class="button signature-button" @click="emit('edict', selected)"><StudioIcon name="stamp" :size="16" /> 为{{ selected.name }}拟旨 <span>↗</span></button></section></Transition>
      <section class="draw-history palace-panel"><div class="history-heading"><h3>翻牌簿</h3><span>保留最近 50 次 · 北京时间</span></div><p v-if="!state.draws.length" class="field-note">今夜尚未落笔，第一份缘分正等着你。</p><ol v-else><li v-for="record in state.draws.slice(0, 8)" :key="record.id"><span class="record-mark">翻</span><span><strong>{{ record.name }}</strong><small>{{ record.title }} · {{ record.palace }}</small></span><time :datetime="record.at">{{ time(record.at) }}</time><button class="text-button" :aria-label="`为${record.name}拟旨`" @click="emit('edict', record)">拟旨 ↗</button></li></ol><details v-if="state.draws.length > 8"><summary>查看更早的 {{ state.draws.length - 8 }} 次翻牌</summary><ol><li v-for="record in state.draws.slice(8)" :key="record.id"><span class="record-mark">翻</span><span><strong>{{ record.name }}</strong><small>{{ record.title }} · {{ record.palace }}</small></span><time :datetime="record.at">{{ time(record.at) }}</time><button class="text-button" :aria-label="`为${record.name}拟旨`" @click="emit('edict', record)">拟旨 ↗</button></li></ol></details></section>
    </section>
    <dialog ref="editor" class="help-dialog member-dialog" aria-labelledby="member-dialog-title" @click="$event.target === editor && editor?.close()"><button class="icon-button dialog-close" aria-label="关闭宫册编辑" @click="editor?.close()"><StudioIcon name="close" /></button><span class="eyebrow">PALACE REGISTER</span><h2 id="member-dialog-title">{{ editingId ? '编辑宫册' : '添入宫册' }}</h2><form @submit.prevent="submit"><label for="member-name">姓名</label><input id="member-name" v-model="form.name" class="text-input" maxlength="12" required /><label for="member-title">位份</label><input id="member-title" v-model="form.title" class="text-input" maxlength="12" required /><label for="member-palace">宫苑</label><input id="member-palace" v-model="form.palace" class="text-input" maxlength="12" required /><p v-if="formError" class="overflow-warning" role="alert">{{ formError }}</p><div class="member-dialog-actions"><button v-if="editingId" class="text-button" type="button" @click="remove(state.members.find(m => m.id === editingId)!)">移出宫册</button><button class="button signature-button" type="submit">保存宫册</button></div></form></dialog>
  </main>
</template>

<style scoped>
.emperor-page { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 36px; padding: 34px max(32px, calc((100vw - 1320px) / 2)); align-items: start; }
.palace-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
.royal-profile { padding: 28px; position: sticky; top: 0; display: flex; flex-direction: column; text-align: center; align-items: center; }
.royal-emblem { position: relative; margin: 27px 0 15px; display: grid; place-items: center; width: 85px; height: 85px; color: var(--accent); font: 49px var(--font-serif); border: 1px solid #b59a7140; background: radial-gradient(ellipse, #c69f760e, transparent); }
.royal-emblem::before { content: ''; position: absolute; inset: 5px; border: 1px solid #b59a7125; }
.royal-overline { color: var(--muted); font-size: 11px; letter-spacing: 2px; }
.royal-profile h1 { font: 400 29px var(--font-serif); margin: 6px 0 16px; letter-spacing: 3px; overflow-wrap: anywhere; }
.royal-description { font: 11px/2 var(--font-serif); color: var(--muted); margin: 0; }
.royal-settings { margin: 30px 0; width: 100%; text-align: left; border-top: 1px solid var(--line); padding-top: 23px; }
.royal-settings label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text); margin-bottom: 10px; }
.royal-settings label span { color: var(--muted); font-size: 9px; }
.royal-settings .text-input { font-size: 13px; font-family: var(--font-serif); letter-spacing: 2px; margin-bottom: 21px; }
.royal-profile > .button { font-size: 11px; }
.palace-main { min-width: 0; }
.palace-heading { display: flex; justify-content: space-between; align-items: center; gap: 15px; }
.palace-heading h2 { font: 400 32px var(--font-serif); letter-spacing: 4px; margin: 12px 0; }
.palace-heading p { font-size: 11px; color: var(--muted); line-height: 1.8; margin-bottom: 0; }
.subtle-button { background: #c69f7608; border-color: #c69f763f; color: var(--accent); white-space: nowrap; }
.subtle-button:hover:not(:disabled) { background: #c69f761a; }
.palace-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 24px 0 20px; font-size: 10px; color: var(--muted); }
.palace-toolbar b { color: var(--accent); font-weight: 400; }
.repeat-setting { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.repeat-setting input { accent-color: #af9670; }
.palace-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.palace-card { position: relative; display: flex; align-items: center; flex-direction: column; padding: 31px 14px 15px; background: var(--panel); border: 1px solid #b39d692d; border-radius: 5px; min-height: 235px; transition: border-color .3s, opacity .3s, background .3s; }
.palace-card.chosen { border-color: #d6b17c; background: #bd995a0f; box-shadow: 0 0 25px #d6b17c0c, inset 0 0 25px #d6b17c06; }
.palace-card.inactive { opacity: .48; }
.card-edit { position: absolute; right: 9px; top: 10px; font-size: 9px; color: var(--muted); padding: 3px 7px; border: 0; background: none; }
.name-plaque { width: 100%; max-width: 150px; min-height: 159px; position: relative; display: flex; justify-content: center; align-items: center; gap: 12px; border: 1px solid #b49f644f; border-radius: 28px 28px 3px 3px; background: linear-gradient(160deg, #d1bd8610, transparent 65%); padding: 24px 15px 21px; }
.name-plaque::after { content: ''; inset: 5px; position: absolute; border: 1px solid #b49f6425; border-radius: 23px 23px 1px 1px; pointer-events: none; }
.plaque-name { writing-mode: vertical-rl; font: 29px var(--font-serif); letter-spacing: 7px; color: var(--text); line-height: 1.2; overflow-wrap: anywhere; max-height: 260px; }
.plaque-palace, .plaque-title { writing-mode: vertical-rl; font: 10px var(--font-serif); color: var(--accent); letter-spacing: 3px; overflow-wrap: anywhere; max-height: 260px; }
.plaque-palace { opacity: .7; }
.plaque-knot { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-size: 16px; color: #bf956b; background: var(--panel); padding: 0 5px; }
.card-eligibility { display: flex; gap: 6px; align-items: center; justify-content: center; background: none; border: 0; color: var(--muted); font-size: 9px; margin-top: 16px; }
.inactive .card-eligibility .status-light { background: var(--muted); box-shadow: none; }
.drawing .palace-card:not(.inactive) { animation: card-shimmer .4s ease-in-out infinite alternate; animation-delay: calc(var(--card-index) * -90ms); }
@keyframes card-shimmer { from { border-color: #b39d6930; transform: translateY(0); } to { border-color: #d6b17c; transform: translateY(-4px); background: #bd995a18; } }
.flip-action { text-align: center; padding: 25px 0 20px; }
.flip-button { margin: 0 auto; background: #dec299; color: #34352b; min-height: 47px; min-width: 236px; font: 15px var(--font-serif); letter-spacing: 4px; gap: 25px; }
.flip-button:hover:not(:disabled) { background: #edd8b7; }
.flip-action p { font-size: 9px; color: var(--muted); letter-spacing: 1px; margin: 12px 0 0; }
.flip-result { display: flex; justify-content: space-between; align-items: center; gap: 20px; border: 1px solid #c69f764d; background: #c69f7608; border-radius: 5px; padding: 20px 23px; margin: 0 0 22px; }
.flip-result p { font-size: 11px; color: var(--muted); margin-bottom: 0; line-height: 1.8; }
.flip-result p strong { font: 17px var(--font-serif); color: var(--text); margin: 0 10px; }
.flip-result p > span { color: var(--accent); }
.flip-result .button { width: auto; flex: none; }
.draw-history { padding: 20px 23px; }
.history-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
.history-heading h3 { font: 14px var(--font-serif); letter-spacing: 2px; margin: 0; }
.history-heading > span { font-size: 9px; color: var(--muted); }
.draw-history ol { list-style: none; margin: 0; padding: 0; }
.draw-history li { display: flex; align-items: center; gap: 13px; padding: 12px 0; border-top: 1px solid var(--line); }
.record-mark { color: var(--accent); border: 1px solid #c69f7630; font: 15px var(--font-serif); padding: 3px; }
.draw-history li > span:nth-child(2) { display: flex; flex-direction: column; gap: 4px; }
.draw-history strong { font: 12px var(--font-serif); }
.draw-history small { font-size: 9px; color: var(--muted); }
.draw-history time { margin-left: auto; color: var(--muted); font-size: 10px; }
.draw-history summary { color: var(--muted); font-size: 10px; cursor: pointer; padding: 10px 0 2px; }
.palace-empty { text-align: center; padding: 70px 20px; border: 1px dashed #c69f7630; color: var(--muted); }
.palace-empty > span { font: 25px var(--font-serif); letter-spacing: 3px; }
.palace-empty p { font-size: 11px; margin: 15px 0 20px; }
.palace-empty .button { margin: auto; width: fit-content; }
.restore-member { display: flex; gap: 20px; align-items: center; font-size: 11px; color: var(--muted); margin-top: 14px; }
.member-dialog label { display: block; font-size: 12px; margin: 17px 0 9px; }
.member-dialog .text-input { font-size: 13px; }
.member-dialog-actions { display: flex; align-items: center; gap: 20px; margin-top: 24px; }
.member-dialog-actions .signature-button { flex: 1; }
.reveal-enter-active { transition: opacity .35s, transform .35s; }
.reveal-enter-from { opacity: 0; transform: translateY(8px); }
@media (max-width: 1100px) {
.emperor-page { grid-template-columns: 230px minmax(0, 1fr); padding: 25px; gap: 25px; overflow: visible; }
.royal-profile { padding: 24px 20px; }
.palace-heading h2 { font-size: 26px; }
.palace-cards { gap: 10px; }
.name-plaque { gap: 8px; padding-left: 8px; padding-right: 8px; }
.flip-result { flex-wrap: wrap; }
}
@media (max-width: 700px) {
.emperor-page { display: flex; flex-direction: column; padding: 22px 16px; gap: 28px; }
.royal-profile { position: static; width: 100%; padding: 25px; }
.royal-emblem { margin-top: 22px; width: 70px; height: 70px; font-size: 42px; }
.royal-profile h1 { font-size: 25px; }
.royal-settings { display: grid; grid-template-columns: 1fr 1fr; column-gap: 15px; margin: 23px 0; }
.royal-settings label:first-child { grid-column: 1; grid-row: 1; }
.royal-settings label:nth-of-type(2) { grid-column: 2; grid-row: 1; }
.royal-settings .text-input { margin-bottom: 12px; min-width: 0; font-size: 12px; }
.royal-settings > p { grid-column: 1/-1; }
.palace-main { width: 100%; }
.palace-heading h2 { font-size: 25px; letter-spacing: 2px; }
.palace-heading .button { font-size: 10px; padding: 0 10px; }
.palace-heading p { font-size: 10px; max-width: 220px; }
.palace-toolbar { font-size: 9px; gap: 8px; }
.palace-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.palace-card { padding-top: 30px; }
.plaque-name { font-size: 26px; }
.flip-result { padding: 19px; }
.flip-result p strong { font-size: 16px; }
.flip-result .button { width: 100%; }
.draw-history { padding: 18px 16px; }
.draw-history time { font-size: 9px; }
.draw-history li { gap: 8px; }
.draw-history .text-button { font-size: 9px; }
.history-heading > span { font-size: 8px; }
}
</style>
