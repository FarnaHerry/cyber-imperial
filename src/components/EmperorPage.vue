<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { StudioState } from '../composables/useStudio'
import type { DrawRecord, PalaceMember } from '../core/palace'
import StudioIcon from './StudioIcon.vue'
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
