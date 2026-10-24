<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EmpirePage from '../components/EmpirePage.vue'
import StudioIcon from '../components/StudioIcon.vue'
import type { StudioState } from '../composables/useStudio'
import { MEMORIAL_CATEGORIES, MEMORIAL_STATUSES, REVIEW_DECISIONS, canEditMemorial, createMemorial, editMemorial, submitMemorial, reviewMemorial, validateMemorialInput, type Memorial, type MemorialInput, type MemorialStatus, type ReviewDecision } from '../core/memorial'

const props = defineProps<{ state: StudioState }>()
const emit = defineEmits<{ notice: [string]; edict: [Memorial] }>()
const status = ref<MemorialStatus | 'all'>('pending'), category = ref('all'), query = ref('')
const selectedId = ref(''), comment = ref(''), reviewError = ref('')
const editor = ref<HTMLDialogElement | null>(null), editingId = ref<string | null>(null), error = ref(''), officerId = ref('')
const blankForm = (): MemorialInput => ({ title: '', author: '', office: '', category: '其他', urgent: false, content: '' })
const form = ref<MemorialInput>(blankForm())
const removed = ref<Memorial | null>(null)
const counts = computed(() => Object.fromEntries(Object.keys(MEMORIAL_STATUSES).map(key => [key, props.state.memorials.filter(m => m.status === key).length])))
const filtered = computed(() => props.state.memorials.filter(m => (status.value === 'all' || m.status === status.value)
  && (category.value === 'all' || m.category === category.value)
  && `${m.title} ${m.author} ${m.office} ${m.content} ${m.reviews.map(r => r.comment).join(' ')}`.includes(query.value.trim()))
  .sort((a, b) => Number(b.urgent) - Number(a.urgent) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
const selected = computed(() => filtered.value.find(m => m.id === selectedId.value) ?? filtered.value[0] ?? null)
watch(() => selected.value?.id, () => { comment.value = ''; reviewError.value = '' })
const formatDate = (at: string) => new Date(at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
function openEditor(m?: Memorial) {
  editingId.value = m?.id ?? null
  form.value = m ? { title: m.title, author: m.author, office: m.office, category: m.category, urgent: m.urgent, content: m.content } : blankForm()
  officerId.value = ''; error.value = ''; editor.value?.showModal()
}
function chooseOfficer() {
  const officer = props.state.officers.find(o => o.id === officerId.value)
  if (officer) { form.value.author = officer.name; form.value.office = props.state.rankTitles[officer.rank][officer.role] }
}
function applyTemplate(key: string) {
  const templates: Record<string, Pick<MemorialInput, 'title' | 'category' | 'content'>> = {
    relief: { title: '请拨粮赈济灾民折', category: '户计', content: '臣谨奏：近日连雨，地方农田受损，百姓生计艰难。臣已遣员核查灾情、登记受灾户数，拟请拨付储备粮，设棚赈济。\n\n所需粮数、转运路线与发放名册，将另附详单。恳请圣裁。' },
    defense: { title: '请修缮边防营垒折', category: '军务', content: '臣谨奏：边防营垒久经风雨，部分城防与军械亟待修整。臣拟先查勘险要、编列用度，再分段修缮，保留巡防兵力。\n\n请准组织勘验，核明工期与军需后另行奏报。恳请圣裁。' },
    talent: { title: '荐贤任官折', category: '吏治', content: '臣谨奏：治国之要，在于得人。今察地方有贤才，勤于政事、熟悉民情，拟荐其入朝考核。\n\n请准核查履历与实绩，择才授职，以备朝廷之用。恳请圣裁。' },
  }
  if (templates[key]) Object.assign(form.value, templates[key])
}
function saveForm(send: boolean) {
  error.value = validateMemorialInput(form.value)
  if (error.value) return
  let m = props.state.memorials.find(item => item.id === editingId.value)
  if (editingId.value && !m) { error.value = '这份奏折已不存在。'; return }
  if (m) { error.value = editMemorial(m, form.value); if (error.value) return }
  else {
    if (props.state.memorials.length >= 200) { error.value = '奏折簿最多收录 200 份。'; return }
    m = createMemorial(form.value); props.state.memorials.push(m)
  }
  if (send) { error.value = submitMemorial(m); if (error.value) return }
  category.value = 'all'; query.value = ''; status.value = m.status; selectedId.value = m.id
  editor.value?.close(); emit('notice', send ? '奏折已上奏，等候朱批' : '奏折草稿已保存')
}
function sendSelected() {
  const m = selected.value
  if (!m) return
  const message = submitMemorial(m)
  if (message) { emit('notice', message); return }
  status.value = 'pending'; selectedId.value = m.id; emit('notice', '奏折已上奏，等候朱批')
}
function review(decision: ReviewDecision) {
  const m = selected.value
  if (!m) return
  reviewError.value = reviewMemorial(m, decision, comment.value, props.state.emperor.trim() || '御批')
  if (reviewError.value) return
  status.value = decision; selectedId.value = m.id; comment.value = ''; emit('notice', `朱批已登记：${REVIEW_DECISIONS[decision]}`)
}
function removeDraft() {
  const m = selected.value
  if (!m || m.status !== 'draft') return
  removed.value = m; props.state.memorials = props.state.memorials.filter(item => item.id !== m.id)
  emit('notice', '草稿已移出，可恢复')
}
function restoreDraft() {
  if (!removed.value || props.state.memorials.length >= 200) return
  const m = removed.value; props.state.memorials.push(m); removed.value = null
  status.value = 'draft'; category.value = 'all'; query.value = ''; selectedId.value = m.id
}
</script>

<template>
  <EmpirePage title="奏折批阅" eyebrow="THE IMPERIAL MEMORIALS" description="百官具折，御前朱批。一事一奏，留存每一次圣裁。">
    <template #actions><span class="field-note">已收录 {{ state.memorials.length }} / 200 份</span><button class="button management-primary" :disabled="state.memorials.length >= 200" @click="openEditor()">＋ 具折上奏</button></template>
    <div class="memorial-stats" aria-label="奏折统计">
      <button v-for="key in (['pending', 'approved', 'returned'] as const)" :key="key" class="management-card" :aria-pressed="status === key" @click="status = key"><span>{{ MEMORIAL_STATUSES[key] }}</span><strong>{{ counts[key] }}</strong><small>{{ key === 'pending' ? '御前待阅' : key === 'approved' ? '已准照办' : '修订后再奏' }}</small></button>
    </div>
    <div class="management-toolbar memorial-toolbar">
      <div class="management-tabs" aria-label="奏折状态"><button :aria-pressed="status === 'all'" @click="status = 'all'">全部</button><button v-for="(label, key) in MEMORIAL_STATUSES" :key="key" :aria-pressed="status === key" @click="status = key">{{ label }} {{ counts[key] }}</button></div>
      <select v-model="category" class="management-select" aria-label="筛选奏折类别"><option value="all">所有类别</option><option v-for="item in MEMORIAL_CATEGORIES" :key="item">{{ item }}</option></select>
      <input v-model="query" class="text-input" aria-label="搜索奏折" placeholder="搜索题名、具折人、正文或朱批…" />
    </div>
    <div v-if="removed" class="management-restore" role="status">已移出草稿《{{ removed.title }}》<button class="text-button" :disabled="state.memorials.length >= 200" @click="restoreDraft">恢复草稿</button></div>
    <div v-if="!filtered.length" class="management-card management-empty"><p>{{ state.memorials.length ? '当前筛选没有匹配的奏折。' : '御前尚无奏折。从官册选一位具折人，奏陈第一件朝政。' }}</p><button v-if="!state.memorials.length" class="button management-secondary empty-compose" @click="openEditor()">具第一份奏折</button><button v-else class="text-button" @click="status = 'all'; category = 'all'; query = ''">查看全部奏折</button></div>
    <div v-else class="memorial-workspace">
      <section class="management-card memorial-list" aria-label="奏折簿">
        <div class="register-heading"><h2>奏折簿</h2><span>{{ filtered.length }} 份 · 急奏优先</span></div>
        <button v-for="m in filtered" :key="m.id" class="memorial-entry" :aria-pressed="selected?.id === m.id" @click="selectedId = m.id">
          <span class="entry-meta"><span>{{ m.category }}<b v-if="m.urgent">急奏</b></span><span>{{ MEMORIAL_STATUSES[m.status] }}</span></span>
          <strong>{{ m.title }}</strong><span class="entry-author">{{ m.office }} {{ m.author }}</span><small>{{ formatDate(m.updatedAt) }} · {{ m.revision ? `第 ${m.revision} 次上奏` : '尚未上奏' }}</small>
        </button>
      </section>
      <article v-if="selected" class="management-card memorial-detail" :aria-label="`${selected.title}详情`">
        <header class="memorial-heading"><div><span class="eyebrow">MEMORIAL · {{ selected.category }}</span><h2>{{ selected.title }}</h2><p>{{ selected.office }} {{ selected.author }} 谨奏</p></div><span class="management-badge" :class="{ urgent: selected.urgent }">{{ selected.urgent ? '急奏 · ' : '' }}{{ MEMORIAL_STATUSES[selected.status] }}</span></header>
        <p class="memorial-body">{{ selected.content }}</p>
        <div class="memorial-dates"><span>具折 {{ formatDate(selected.createdAt) }}</span><span v-if="selected.submittedAt">上奏 {{ formatDate(selected.submittedAt) }} · 第 {{ selected.revision }} 次</span></div>
        <div v-if="canEditMemorial(selected)" class="memorial-actions"><button class="button management-secondary" @click="openEditor(selected)">{{ selected.status === 'returned' ? '修订奏折' : '编辑草稿' }}</button><button class="button management-primary" @click="sendSelected">{{ selected.status === 'returned' ? '再次上奏' : '上奏御前' }}</button><button v-if="selected.status === 'draft'" class="text-button remove-draft" @click="removeDraft">移出草稿</button></div>
        <section v-if="selected.status === 'pending'" class="review-panel" aria-label="御前批阅"><span class="eyebrow">THE VERMILION RESCRIPT</span><h3>御前朱批</h3><form @submit.prevent="review('approved')"><label for="review-comment">批复意见 <span>{{ comment.length }} / 400</span></label><textarea id="review-comment" v-model="comment" class="text-input" maxlength="400" placeholder="写下圣裁、办理要求或发回修改的缘由…" required /><div class="review-shortcuts"><span>常用朱批</span><button type="button" class="text-button" @click="comment = '准奏。着依所奏办理，事毕具折回报。'">依奏办理</button><button type="button" class="text-button" @click="comment = '所奏尚欠详实，着补明缘由与用度后再奏。'">补明再奏</button></div><p v-if="reviewError" class="overflow-warning" role="alert">{{ reviewError }}</p><div class="memorial-actions"><button class="button approval-button" type="submit">朱批准奏</button><button class="button management-secondary" type="button" @click="review('rejected')">驳回所奏</button><button class="button management-secondary" type="button" @click="review('returned')">发回修改</button></div></form><p class="field-note">朱批记录圣裁。涉及库藏或任命时，请前往对应页面办理。</p></section>
        <section v-if="selected.reviews.length" class="review-history" aria-label="批阅记录"><div class="register-heading"><h3>朱批留档</h3><span>最近 20 次批阅</span></div><ol><li v-for="r in [...selected.reviews].reverse()" :key="r.id"><div class="review-meta"><strong>{{ REVIEW_DECISIONS[r.decision] }}</strong><span>第 {{ r.revision }} 次上奏 · {{ r.reviewer }} · {{ formatDate(r.at) }}</span></div><p>{{ r.comment }}</p></li></ol><button v-if="selected.status !== 'pending'" class="text-button" @click="emit('edict', selected)"><StudioIcon name="stamp" :size="15" />将本次批复送入工坊拟旨 ↗</button></section>
      </article>
    </div>
  </EmpirePage>
  <dialog ref="editor" class="help-dialog management-dialog memorial-editor" aria-labelledby="memorial-editor-title" @click="$event.target === editor && editor?.close()"><button class="icon-button dialog-close" aria-label="关闭奏折编辑" @click="editor?.close()"><StudioIcon name="close" /></button><span class="eyebrow">A PETITION TO THE THRONE</span><h2 id="memorial-editor-title">{{ editingId ? '修订奏折' : '具折上奏' }}</h2>
    <form class="management-form" @submit.prevent="saveForm(true)">
      <label v-if="!editingId">起草题笺<select class="management-select" aria-label="选择奏折题笺" @change="applyTemplate(($event.target as HTMLSelectElement).value)"><option value="">自由具折</option><option value="relief">赈济灾民</option><option value="defense">边防修缮</option><option value="talent">荐贤任官</option></select></label>
      <label>奏折题名<input v-model="form.title" class="text-input" maxlength="24" required placeholder="一事一奏，简明题名" /></label>
      <label>从文武官册选取<select v-model="officerId" class="management-select" @change="chooseOfficer"><option value="">手填具折人</option><option v-for="o in state.officers" :key="o.id" :value="o.id">{{ o.name }} · {{ state.rankTitles[o.rank][o.role] }}</option></select></label>
      <div class="management-form-row"><label>具折人<input v-model="form.author" class="text-input" maxlength="12" required /></label><label>职名<input v-model="form.office" class="text-input" maxlength="24" /></label></div>
      <div class="management-form-row"><label>奏折类别<select v-model="form.category" class="management-select"><option v-for="item in MEMORIAL_CATEGORIES" :key="item">{{ item }}</option></select></label><label class="urgency-control"><input v-model="form.urgent" type="checkbox" /> 急奏 · 御前优先阅览</label></div>
      <label>奏折正文 · {{ form.content.length }} / 1200<textarea v-model="form.content" class="text-input" maxlength="1200" required placeholder="臣谨奏：…" /></label>
      <p v-if="error" class="overflow-warning" role="alert">{{ error }}</p><p class="field-note">具折人和职名随奏折留档。上奏后待圣裁；发回后可修订再奏。</p>
      <div class="management-form-actions"><button class="button management-secondary" type="button" @click="saveForm(false)">保存草稿</button><button class="button management-primary" type="submit">上奏御前</button></div>
    </form>
  </dialog>
</template>

<style scoped>
.memorial-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.memorial-stats button { display: grid; grid-template-columns: 1fr auto; gap: 9px; text-align: left; color: var(--text); }
.memorial-stats button:hover { border-color: var(--accent-border); background: var(--accent-soft); }
.memorial-stats button[aria-pressed='true'] { color: var(--accent-strong); background: var(--panel-raised); border-color: var(--accent-border); box-shadow: var(--shadow-sm); }
.memorial-stats button[aria-pressed='true']:hover { background: var(--panel-raised); }
.memorial-stats span { font: 16px var(--font-serif); letter-spacing: 2px; }
.memorial-stats strong { grid-row: span 2; font: 32px var(--font-serif); color: var(--accent-strong); }
.memorial-stats small { color: var(--muted); font-size: 10px; }
.memorial-toolbar { gap: 10px; }
.memorial-toolbar .text-input { flex: 1; min-width: 200px; }
.memorial-workspace { display: grid; grid-template-columns: 310px minmax(0, 1fr); gap: 24px; align-items: start; }
.register-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.register-heading h2, .register-heading h3 { margin: 0; font: 17px var(--font-serif); letter-spacing: 2px; }
.register-heading span { color: var(--muted); font-size: 10px; }
.memorial-list { padding: 20px 0 0; overflow: hidden; }
.memorial-list .register-heading { padding: 0 20px; }
.memorial-entry { display: grid; gap: 10px; width: 100%; padding: 20px; text-align: left; color: var(--text); background: transparent; border: 0; border-top: 1px solid var(--line); border-left: 3px solid transparent; overflow-wrap: anywhere; }
.memorial-entry:hover { background: var(--accent-soft); }
.memorial-entry[aria-pressed='true'] { background: var(--accent-soft); border-left-color: var(--accent); }
.memorial-entry strong { font: 17px var(--font-serif); line-height: 1.6; }
.entry-meta { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--accent-strong); }
.entry-meta b { font-weight: 400; margin-left: 8px; color: var(--vermillion); }
.entry-author, .memorial-entry small { font-size: 11px; color: var(--muted); }
.memorial-heading { display: flex; align-items: start; justify-content: space-between; gap: 18px; }
.memorial-heading h2 { margin: 15px 0 10px; font: 26px var(--font-serif); line-height: 1.7; overflow-wrap: anywhere; }
.memorial-heading p { margin: 0; font-size: 12px; color: var(--muted); }
.urgent { color: var(--vermillion); border-color: color-mix(in srgb, var(--vermillion) 35%, transparent); }
.memorial-body { white-space: pre-wrap; overflow-wrap: anywhere; font: 16px / 2.3 var(--font-serif); padding: 26px 0; margin: 24px 0 0; border-top: 1px solid var(--line-strong); }
.memorial-dates { display: flex; flex-wrap: wrap; gap: 12px; color: var(--muted); font-size: 10px; margin-bottom: 22px; }
.memorial-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
.remove-draft { margin-left: auto; }
.review-panel, .review-history { border-top: 1px solid var(--line-strong); padding-top: 24px; margin-top: 24px; }
.review-panel h3 { font: 20px var(--font-serif); color: var(--vermillion); margin: 12px 0 20px; letter-spacing: 3px; }
.review-panel label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; }
.review-panel label span { color: var(--muted); font-size: 10px; }
.review-panel textarea { min-height: 110px; resize: vertical; line-height: 1.9; font-size: 13px; }
.review-shortcuts { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 10px; }
.review-shortcuts span { color: var(--muted); font-size: 10px; }
.approval-button { background: var(--vermillion); color: #261b17; }
.approval-button:hover:not(:disabled) { background: color-mix(in srgb, var(--vermillion) 85%, var(--panel-raised)); box-shadow: var(--shadow-sm); }
.review-history ol { list-style: none; padding: 0; margin: 0; }
.review-history li { border-left: 2px solid color-mix(in srgb, var(--vermillion) 40%, transparent); padding: 0 0 0 16px; margin: 20px 0; }
.review-meta { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.review-meta strong { color: var(--vermillion); font: 16px var(--font-serif); }
.review-meta span { color: var(--muted); font-size: 10px; }
.review-history li p { white-space: pre-wrap; overflow-wrap: anywhere; font: 15px / 1.9 var(--font-serif); color: var(--vermillion); margin-bottom: 0; }
.memorial-editor { max-width: 600px; max-height: calc(100dvh - 40px); overflow-y: auto; }
.memorial-editor textarea { min-height: 150px; }
.management-form .urgency-control { display: flex; align-items: center; gap: 8px; padding-top: 20px; }
.urgency-control input { accent-color: var(--accent); }
.empty-compose { margin: 16px auto 0; }
:global([data-theme='light']) .approval-button { color: #fff8ed; }
@media (max-width: 900px) { .memorial-workspace { grid-template-columns: 245px minmax(0, 1fr); gap: 16px; } }
@media (max-width: 700px) {
  .memorial-stats { gap: 10px; }
  .memorial-stats button { grid-template-columns: 1fr; padding: 14px 12px; gap: 7px; }
  .memorial-stats span { font-size: 13px; letter-spacing: 1px; }
  .memorial-stats strong { grid-row: auto; font-size: 25px; }
  .memorial-workspace { grid-template-columns: 1fr; }
  .memorial-list { max-height: 340px; overflow-y: auto; }
  .memorial-entry { padding: 16px; gap: 7px; }
  .memorial-heading { flex-wrap: wrap; }
  .memorial-heading h2 { font-size: 22px; }
  .memorial-body { font-size: 15px; }
  .memorial-toolbar .text-input { flex-basis: 100%; }
  .memorial-actions .button { padding: 0 12px; }
}
</style>
