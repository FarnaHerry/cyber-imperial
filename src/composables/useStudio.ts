import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { DEFAULT_EDICT, randomEdict } from '../core/edict'
import { INKS, type InkKey } from '../core/inks'
import { PAPERS, type PaperKey } from '../core/paper'
import type { Stamp } from '../core/stamp'
import { isFontKey } from '../core/fonts'
import { DEFAULT_MEMBERS, drawPalaceMember, royalEdict, type PalaceMember, type DrawRecord } from '../core/palace'

export const TEMPLATES = [
  { key: 'imperial', label: '敕封圣旨', hint: '奉天承运 · 加官进爵', mark: '诏', create: (who: string) => DEFAULT_EDICT.replace('今有卿', () => `今有${who || '卿'}`) },
  { key: 'release', label: '上线大吉', hint: '代码入世 · 万事皆宜', mark: '吉', create: (who: string) => `奉天承运，赛博皇帝诏曰：今有${who || '卿'}，潜心打磨，终成佳作。代码已过千重试炼，版本今朝正式上线。\n\n愿服务长稳，流量长红，告警寂静，用户欢喜。赐咖啡一盏，许今夜安眠。上线大吉，钦此。` },
  { key: 'holiday', label: '准予休沐', hint: '暂别案牍 · 山海相见', mark: '闲', create: (who: string) => `制曰：朕闻劳逸相济，方能行远。今准${who || '卿'}暂离案牍，休沐三日。\n\n其间无需应召，不必看群。可游山川，可卧听雨，可与亲友共饮。凡有急事，待归来再议。好好休息，钦此。` },
  { key: 'blank', label: '自由创作', hint: '一纸素笺 · 自由落笔', mark: '书', create: () => '' },
] as const

export interface StudioState {
  text: string
  subject: string
  sealText: string
  inkKey: InkKey
  force: number
  erosion: number
  sealSize: number
  paper: PaperKey
  sound: boolean
  stamps: Stamp[]
  theme: 'dark' | 'light'
  sealFont: string
  edictFont: string
  sealAngle: number
  kingdom: string
  emperor: string
  members: PalaceMember[]
  draws: DrawRecord[]
  avoidRepeat: boolean
}
const STORAGE_KEY = 'cyber-imperial-studio:v2'
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const string = (v: unknown, max: number): v is string => typeof v === 'string' && Array.from(v).length <= max
function validStamp(value: unknown): value is Stamp {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return string(s.id, 64) && finite(s.x, -300, 1500) && finite(s.y, -300, 1100) && finite(s.size, 60, 260)
    && finite(s.rotation, -Math.PI, Math.PI) && (s.font === undefined || isFontKey(s.font)) && typeof s.ink === 'string' && /^#[0-9a-f]{6}$/i.test(s.ink)
    && finite(s.force, .15, 1) && finite(s.erosion, 0, .92) && string(s.text, 8) && finite(s.seed, 0, 10000)
}
function validMember(value: unknown): value is PalaceMember {
  if (!value || typeof value !== 'object') return false
  const m = value as PalaceMember
  return string(m.id, 64) && string(m.name, 12) && !!m.name.trim() && string(m.title, 12) && string(m.palace, 12) && typeof m.enabled === 'boolean'
}
function validDraw(value: unknown): value is DrawRecord {
  if (!value || typeof value !== 'object') return false
  const d = value as DrawRecord
  return string(d.id, 64) && string(d.memberId, 64) && string(d.name, 12) && string(d.title, 12) && string(d.palace, 12) && typeof d.at === 'string' && Number.isFinite(Date.parse(d.at))
}
function readDraft(): Partial<StudioState> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const s = JSON.parse(stored)
    if (![2, 3].includes(s?.version) || !s.state) return null
    const d = s.state
    if (!string(d.text, 1200) || !string(d.subject, 12) || !string(d.sealText, 8)
      || !INKS.some(i => i.key === d.inkKey) || !PAPERS.some(p => p.key === d.paper)
      || !finite(d.force, .15, 1) || !finite(d.erosion, 0, .92) || !finite(d.sealSize, 60, 260)
      || typeof d.sound !== 'boolean' || !Array.isArray(d.stamps) || d.stamps.length > 500 || !d.stamps.every(validStamp)) return null
    if (s.version === 3 && (!['dark', 'light'].includes(d.theme) || !isFontKey(d.sealFont) || !isFontKey(d.edictFont)
      || !finite(d.sealAngle, -180, 180) || !string(d.kingdom, 12) || !string(d.emperor, 12)
      || !Array.isArray(d.members) || d.members.length > 24 || !d.members.every(validMember)
      || new Set(d.members.map((m: PalaceMember) => m.id)).size !== d.members.length
      || !Array.isArray(d.draws) || d.draws.length > 50 || !d.draws.every(validDraw) || typeof d.avoidRepeat !== 'boolean')) return null
    return { ...d, stamps: d.stamps.map((stamp: Stamp) => ({ ...stamp, font: stamp.font ?? 'serif' })) }
  } catch { return null }
}

export function useStudio() {
  const draft = readDraft()
  const state = reactive<StudioState>({
    text: DEFAULT_EDICT, subject: '', sealText: '受命于天既寿永昌', inkKey: 'cinnabar',
    force: .76, erosion: .38, sealSize: 148, paper: 'parchment', sound: true, stamps: [], ...draft,
    theme: draft?.theme ?? 'dark', sealFont: draft?.sealFont ?? 'bird', edictFont: draft?.edictFont ?? 'brush',
    sealAngle: draft?.sealAngle ?? 0, kingdom: draft?.kingdom ?? '赛博', emperor: draft?.emperor ?? '',
    members: draft?.members ?? DEFAULT_MEMBERS.map(m => ({ ...m })), draws: draft?.draws ?? [], avoidRepeat: draft?.avoidRepeat ?? true,
  })
  const restored = !!draft
  const saveStatus = ref<'saved' | 'saving' | 'unavailable'>('saved')
  const past = ref<Stamp[][]>([])
  const future = ref<Stamp[][]>([])
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const snapshot = () => state.stamps.map(s => ({ ...s }))
  function commit(stamps: Stamp[]) {
    past.value = [...past.value.slice(-49), snapshot()]
    future.value = []
    state.stamps = stamps
  }
  function undo() {
    const stamps = past.value.pop()
    if (!stamps) return
    future.value.push(snapshot())
    state.stamps = stamps
  }
  function redo() {
    const stamps = future.value.pop()
    if (!stamps) return
    past.value.push(snapshot())
    state.stamps = stamps
  }
  function addStamp(stamp: Stamp): boolean {
    if (state.stamps.length >= 500) return false
    commit([...state.stamps, stamp])
    return true
  }
  function clear() { if (state.stamps.length) commit([]) }
  function regenerate() { state.text = royalEdict(randomEdict(state.subject), state.kingdom, state.emperor) }
  function createFromTemplate(template: typeof TEMPLATES[number]) {
    state.text = royalEdict(template.create(state.subject.trim()), state.kingdom, state.emperor)
  }
  function flip(): DrawRecord | null {
    const member = drawPalaceMember(state.members, state.avoidRepeat ? state.draws[0]?.memberId : undefined)
    if (!member) return null
    const record: DrawRecord = { id: crypto.randomUUID(), memberId: member.id, name: member.name, title: member.title, palace: member.palace, at: new Date().toISOString() }
    state.draws = [record, ...state.draws].slice(0, 50)
    return record
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, state }))
      saveStatus.value = 'saved'
    } catch { saveStatus.value = 'unavailable' }
  }
  watch(state, () => {
    saveStatus.value = 'saving'
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  }, { deep: true })
  onBeforeUnmount(() => { clearTimeout(timer); save(); window.removeEventListener('pagehide', save) })
  window.addEventListener('pagehide', save)
  save()
  return { state, restored, saveStatus, canUndo, canRedo, addStamp, undo, redo, clear, regenerate, createFromTemplate, flip }
}
