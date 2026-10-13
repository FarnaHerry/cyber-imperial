<script setup lang="ts">
import { computed, ref } from 'vue'
import EmpirePage from '../components/EmpirePage.vue'
import StudioIcon from '../components/StudioIcon.vue'
import { TREASURE_KINDS, stockBalance, warehouseOf, type EmpireState, type Treasure, type TreasureKind } from '../core/empire'
const props = defineProps<{ state: EmpireState }>()
const emit = defineEmits<{ notice: [string] }>()
const query = ref(''), kindFilter = ref('all')
const editor = ref<HTMLDialogElement | null>(null), stockDialog = ref<HTMLDialogElement | null>(null)
const editingId = ref<string | null>(null), stockId = ref(''), direction = ref<1 | -1>(1), amount = ref(1), reason = ref('')
const form = ref({ name: '', kind: '器物' as TreasureKind, quantity: 1, unit: '件', note: '' })
const error = ref(''), stockError = ref('')
const removed = ref<{ item: Treasure; index: number } | null>(null)
const selectedStock = computed(() => props.state.treasures.find(t => t.id === stockId.value))
const filtered = computed(() => props.state.treasures.filter(t => (kindFilter.value === 'all' || t.kind === kindFilter.value) && `${t.name} ${t.note} ${t.kind}`.includes(query.value.trim())))
const warehouses = computed(() => ['国库', '皇室宝库'].map(name => ({ name, royal: name === '皇室宝库', items: filtered.value.filter(t => warehouseOf(t.kind) === name), total: props.state.treasures.filter(t => warehouseOf(t.kind) === name).length })))
const totalKinds = computed(() => props.state.treasures.length)
const format = (n: number) => n.toLocaleString('zh-CN')
const date = (at: string) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(at))
function record(item: Treasure, delta: number, note: string) {
  if (!delta) return
  props.state.stockRecords.unshift({ id: crypto.randomUUID(), name: item.name, kind: item.kind, delta, unit: item.unit, at: new Date().toISOString(), reason: note })
  props.state.stockRecords = props.state.stockRecords.slice(0, 50)
}
function edit(item?: Treasure) {
  editingId.value = item?.id ?? null
  form.value = { name: item?.name ?? '', kind: item?.kind ?? '器物', quantity: item?.quantity ?? 1, unit: item?.unit ?? '件', note: item?.note ?? '' }
  error.value = ''; editor.value?.showModal()
}
function submit() {
  const data = { ...form.value, name: form.value.name.trim(), unit: form.value.unit.trim(), note: form.value.note.trim() }
  if (!data.name || !data.unit || Array.from(data.name).length > 24 || Array.from(data.unit).length > 6 || Array.from(data.note).length > 160 || !TREASURE_KINDS.includes(data.kind) || stockBalance(data.quantity, 0) === null) { error.value = '请填写藏品名称、单位和 0～10 亿之间的整数数量。'; return }
  const existing = props.state.treasures.find(t => t.id === editingId.value)
  if (editingId.value && !existing) { error.value = '这件藏品已移出，请关闭后重新选择。'; return }
  if (existing) {
    if (existing.kind !== data.kind || existing.unit !== data.unit) {
      record(existing, -existing.quantity, '编目调整：原库存转出')
      Object.assign(existing, data); record(existing, existing.quantity, '编目调整：转入新归库或单位')
    } else { const delta = data.quantity - existing.quantity; Object.assign(existing, data); record(existing, delta, '编目调整') }
  }
  else {
    if (props.state.treasures.length >= 200) { error.value = '两库合计最多收录 200 种藏品。'; return }
    const item = { id: crypto.randomUUID(), ...data }; props.state.treasures.push(item); record(item, item.quantity, '初始入库')
  }
  editor.value?.close(); emit('notice', `已归入${warehouseOf(data.kind)}`)
}
function remove() {
  const index = props.state.treasures.findIndex(t => t.id === editingId.value)
  if (index < 0) return
  const item = { ...props.state.treasures[index] }; removed.value = { item, index }; record(item, -item.quantity, '移出库藏')
  props.state.treasures.splice(index, 1); editor.value?.close()
}
function restore() {
  if (!removed.value || props.state.treasures.length >= 200) return
  props.state.treasures.splice(removed.value.index, 0, removed.value.item); record(removed.value.item, removed.value.item.quantity, '恢复库藏'); removed.value = null
}
function adjust(item: Treasure, mode: 1 | -1) { stockId.value = item.id; direction.value = mode; amount.value = 1; reason.value = ''; stockError.value = ''; stockDialog.value?.showModal() }
function submitStock() {
  const item = selectedStock.value, delta = amount.value * direction.value
  if (!item || !Number.isSafeInteger(amount.value) || amount.value <= 0 || stockBalance(item.quantity, delta) === null) { stockError.value = direction.value < 0 ? '出库数量须为正整数，且不能超过现有库存。' : '入库数量须为正整数，库存上限为 10 亿。'; return }
  if (Array.from(reason.value).length > 80) { stockError.value = '事由最多 80 字。'; return }
  item.quantity += delta; record(item, delta, reason.value.trim() || (direction.value > 0 ? '入库' : '出库')); stockDialog.value?.close(); emit('notice', `${item.name}已${direction.value > 0 ? '入库' : '出库'}`)
}
</script>
<template>
  <EmpirePage title="国库与皇室宝库" eyebrow="THE IMPERIAL TREASURIES" description="国用归国库，至宝入内藏。两库同页，各有所守。">
    <template #actions><button class="button management-primary" :disabled="totalKinds >= 200" @click="edit()">＋ 收录藏品</button></template>
    <div class="management-toolbar"><input v-model="query" class="text-input" aria-label="搜索藏品" placeholder="搜索藏品、备注…" /><select v-model="kindFilter" class="management-select" aria-label="藏品类别"><option value="all">全部类别</option><option v-for="kind in TREASURE_KINDS" :key="kind">{{ kind }}</option></select><span class="management-summary">两库共 {{ totalKinds }} 种藏品 · 至宝专藏皇室宝库</span></div>
    <div v-if="removed" class="management-restore" role="status">已移出 {{ removed.item.name }}<button class="text-button" :disabled="totalKinds >= 200" @click="restore">恢复入库</button></div>
    <div class="vaults"><section v-for="vault in warehouses" :key="vault.name" class="management-card vault" :class="{ royal: vault.royal }" :aria-label="vault.name"><div class="vault-heading"><span class="vault-mark" aria-hidden="true">{{ vault.royal ? '宝' : '库' }}</span><div><span class="eyebrow">{{ vault.royal ? 'THE ROYAL VAULT' : 'THE NATIONAL TREASURY' }}</span><h2>{{ vault.name }}</h2></div><span class="vault-count">{{ vault.total }} 种</span></div><p class="vault-rule">{{ vault.royal ? '仅存至宝，珍藏皇家重器。' : '金银、粮秣、军备、器物与贡品悉数入库。' }}</p><div v-if="!vault.items.length" class="management-empty">{{ vault.total ? '当前筛选没有匹配的藏品。' : '此库尚空，收录藏品后即可入藏。' }}</div><div v-else class="treasure-list"><article v-for="item in vault.items" :key="item.id" class="treasure"><div class="treasure-top"><span class="management-badge">{{ item.kind }}</span><button class="text-button" :aria-label="`编目${item.name}`" @click="edit(item)">编目</button></div><h3>{{ item.name }}</h3><p class="treasure-note">{{ item.note || '暂无备注' }}</p><div class="treasure-bottom"><span class="treasure-quantity"><b>{{ format(item.quantity) }}</b> {{ item.unit }}</span><div><button class="text-button" :aria-label="`为${item.name}入库`" @click="adjust(item, 1)">＋ 入库</button><button class="text-button" :aria-label="`为${item.name}出库`" :disabled="!item.quantity" @click="adjust(item, -1)">－ 出库</button></div></div></article></div></section></div>
    <section class="management-card stock-history"><div class="stock-heading"><h2>出入库簿</h2><span class="field-note">最近 50 笔 · 北京时间</span></div><p v-if="!state.stockRecords.length" class="management-empty">尚无出入库记录。每次收支，都有据可查。</p><div v-else class="management-table-wrap"><table class="management-table"><thead><tr><th>藏品</th><th>归库</th><th>收支</th><th>事由</th><th>时间</th></tr></thead><tbody><tr v-for="entry in state.stockRecords" :key="entry.id"><td>{{ entry.name }}</td><td>{{ warehouseOf(entry.kind) }}</td><td class="stock-delta">{{ entry.delta > 0 ? '+' : '' }}{{ format(entry.delta) }} {{ entry.unit }}</td><td>{{ entry.reason }}</td><td><time :datetime="entry.at">{{ date(entry.at) }}</time></td></tr></tbody></table></div></section>
  </EmpirePage>
  <dialog ref="editor" class="help-dialog management-dialog" aria-labelledby="treasure-title" @click="$event.target === editor && editor?.close()"><button class="icon-button dialog-close" aria-label="关闭藏品编目" @click="editor?.close()"><StudioIcon name="close" /></button><span class="eyebrow">TREASURY REGISTER</span><h2 id="treasure-title">{{ editingId ? '藏品编目' : '收录藏品' }}</h2><form class="management-form" @submit.prevent="submit"><label>藏品名称<input v-model="form.name" class="text-input" maxlength="24" required /></label><label>藏品类别<select v-model="form.kind" class="management-select"><option v-for="kind in TREASURE_KINDS" :key="kind">{{ kind }}</option></select></label><p class="field-note">归属：{{ warehouseOf(form.kind) }}。至宝自动存入皇室宝库。</p><div class="management-form-row"><label>库存数量<input v-model.number="form.quantity" class="text-input" type="number" min="0" max="1000000000" step="1" required /></label><label>计量单位<input v-model="form.unit" class="text-input" maxlength="6" required /></label></div><label>藏品备注<textarea v-model="form.note" class="text-input" maxlength="160" /></label><p v-if="error" class="overflow-warning" role="alert">{{ error }}</p><div class="management-form-actions"><button v-if="editingId" class="text-button" type="button" @click="remove">移出库藏</button><button class="button management-primary" type="submit">保存藏品</button></div></form></dialog>
  <dialog ref="stockDialog" class="help-dialog management-dialog" aria-labelledby="stock-title" @click="$event.target === stockDialog && stockDialog?.close()"><button class="icon-button dialog-close" aria-label="关闭出入库登记" @click="stockDialog?.close()"><StudioIcon name="close" /></button><span class="eyebrow">TREASURY ACCOUNT</span><h2 id="stock-title">{{ direction > 0 ? '入库' : '出库' }} · {{ selectedStock?.name }}</h2><p>现存 {{ format(selectedStock?.quantity ?? 0) }} {{ selectedStock?.unit }} · {{ selectedStock ? warehouseOf(selectedStock.kind) : '' }}</p><form class="management-form" @submit.prevent="submitStock"><label>{{ direction > 0 ? '入库数量' : '出库数量' }}<input v-model.number="amount" class="text-input" type="number" min="1" max="1000000000" step="1" required /></label><label>登记事由<input v-model="reason" class="text-input" maxlength="80" placeholder="例如：岁贡入藏、军粮调拨" /></label><p v-if="stockError" class="overflow-warning" role="alert">{{ stockError }}</p><div class="management-form-actions"><button class="button management-primary" type="submit">确认{{ direction > 0 ? '入库' : '出库' }}</button></div></form></dialog>
</template>
<style scoped>
.vaults { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.vault.royal { border-color: color-mix(in srgb, var(--accent) 32%, transparent); background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 4%, var(--panel)), var(--panel)); }
.vault-heading { display: flex; align-items: center; gap: 16px; }.vault-heading h2 { font: 22px var(--font-serif); letter-spacing: 4px; margin: 7px 0 0; }.vault-mark { font: 27px var(--font-serif); color: var(--accent); border: 1px solid var(--line); display: grid; place-items: center; width: 50px; height: 50px; }.royal .vault-mark { border-color: var(--accent); }.vault-count { margin-left: auto; color: var(--muted); font-size: 11px; }.vault-rule { color: var(--muted); font-size: 11px; margin: 20px 0; line-height: 1.8; }
.treasure-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.treasure { padding: 15px; border: 1px solid var(--line); border-radius: var(--radius); }.treasure-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }.treasure h3 { font: 17px var(--font-serif); margin: 15px 0 8px; overflow-wrap: anywhere; }.treasure-note { color: var(--muted); font-size: 10px; line-height: 1.8; min-height: 36px; margin: 0 0 20px; overflow-wrap: anywhere; }.treasure-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }.treasure-quantity { font-size: 10px; color: var(--muted); }.treasure-quantity b { font: 19px var(--font-serif); color: var(--text); }.treasure-bottom > div { display: flex; gap: 12px; }
.stock-history { margin-top: 24px; }.stock-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 12px; }.stock-heading h2 { font: 17px var(--font-serif); margin: 0; letter-spacing: 3px; }.stock-delta { white-space: nowrap; }.management-table time { white-space: nowrap; color: var(--muted); font-size: 10px; }
@media (max-width: 1000px) { .vaults { grid-template-columns: 1fr; } }
@media (max-width: 480px) { .treasure-list { grid-template-columns: 1fr; } }
</style>
