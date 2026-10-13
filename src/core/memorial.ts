export const MEMORIAL_CATEGORIES = ['吏治', '户计', '礼仪', '军务', '刑狱', '工务', '其他'] as const
export const MEMORIAL_STATUSES = { draft: '草稿', pending: '待批', approved: '准奏', rejected: '驳回', returned: '发回修改' } as const
export const REVIEW_DECISIONS = { approved: '准奏', rejected: '驳回', returned: '发回修改' } as const
export type MemorialCategory = typeof MEMORIAL_CATEGORIES[number]
export type MemorialStatus = keyof typeof MEMORIAL_STATUSES
export type ReviewDecision = keyof typeof REVIEW_DECISIONS
export interface MemorialInput { title: string; author: string; office: string; category: MemorialCategory; urgent: boolean; content: string }
export interface MemorialReview { id: string; decision: ReviewDecision; comment: string; reviewer: string; at: string; revision: number }
export interface Memorial extends MemorialInput {
  id: string; status: MemorialStatus; createdAt: string; updatedAt: string; submittedAt: string | null; revision: number; reviews: MemorialReview[]
}
export interface MemorialState { memorials: Memorial[] }
const owns = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
export const canEditMemorial = (m: Memorial) => m.status === 'draft' || m.status === 'returned'

export function validateMemorialInput(data: MemorialInput): string {
  if (!data.title.trim() || Array.from(data.title).length > 24) return '奏折题名须为 1–24 字。'
  if (!data.author.trim() || Array.from(data.author).length > 12) return '请填写具折人，最多 12 字。'
  if (Array.from(data.office).length > 24) return '具折人职名最多 24 字。'
  if (!MEMORIAL_CATEGORIES.includes(data.category) || typeof data.urgent !== 'boolean') return '请选择奏折类别。'
  if (!data.content.trim() || data.content.length > 1200) return '请填写奏折正文，最多 1200 字。'
  return ''
}
const clean = (data: MemorialInput): MemorialInput => ({ title: data.title.trim(), author: data.author.trim(), office: data.office.trim(), category: data.category, urgent: data.urgent, content: data.content.trim() })
export function createMemorial(data: MemorialInput): Memorial {
  const error = validateMemorialInput(data)
  if (error) throw new Error(error)
  const now = new Date().toISOString()
  return { ...clean(data), id: crypto.randomUUID(), status: 'draft', createdAt: now, updatedAt: now, submittedAt: null, revision: 0, reviews: [] }
}
export function editMemorial(m: Memorial, data: MemorialInput): string {
  if (!canEditMemorial(m)) return '只有草稿或发回修改的奏折可以编辑。'
  const error = validateMemorialInput(data)
  if (error) return error
  Object.assign(m, clean(data), { updatedAt: new Date().toISOString() })
  return ''
}
export function submitMemorial(m: Memorial): string {
  if (!canEditMemorial(m)) return '这份奏折已经上奏。'
  const error = validateMemorialInput(m)
  if (error) return error
  m.status = 'pending'; m.revision += 1; m.submittedAt = m.updatedAt = new Date().toISOString()
  return ''
}
export function reviewMemorial(m: Memorial, decision: ReviewDecision, comment: string, reviewer: string): string {
  if (m.status !== 'pending') return '只有待批奏折可以批阅。'
  if (!owns(REVIEW_DECISIONS, decision)) return '请选择批阅结果。'
  if (!comment.trim() || comment.length > 400) return '请填写朱批，最多 400 字。'
  if (!reviewer.trim() || Array.from(reviewer).length > 24) return '批阅人须为 1–24 字。'
  const at = new Date().toISOString()
  m.reviews = [...m.reviews.slice(-19), { id: crypto.randomUUID(), decision, comment: comment.trim(), reviewer: reviewer.trim(), at, revision: m.revision }]
  m.status = decision; m.updatedAt = at
  return ''
}
/** 工坊正文留出批复与落款空间，长奏折仅摘录前 240 字。 */
export function memorialEdict(m: Memorial): string {
  const review = m.reviews[m.reviews.length - 1]
  if (!review || m.status === 'pending' || m.status === 'draft' || review.revision !== m.revision) return ''
  const excerpt = Array.from(m.content).slice(0, 240).join('') + (Array.from(m.content).length > 240 ? '…' : '')
  return `奉天承运，赛博皇帝诏曰：今阅${m.office}${m.author}所奏《${m.title}》。\n\n奏事摘录：${excerpt}\n\n御批·${REVIEW_DECISIONS[review.decision]}：${review.comment}\n\n着依批复办理。钦此。`
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && Array.from(v).length <= max && (!required || !!v.trim())
const date = (v: unknown): v is string => text(v, 64, true) && Number.isFinite(Date.parse(v))
function validMemorial(value: unknown): value is Memorial {
  if (!object(value)) return false
  const m = value
  if (!text(m.id, 64, true) || !text(m.title, 24, true) || !text(m.author, 12, true) || !text(m.office, 24)
    || !MEMORIAL_CATEGORIES.includes(m.category as MemorialCategory) || typeof m.urgent !== 'boolean'
    || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 1200
    || typeof m.status !== 'string' || !owns(MEMORIAL_STATUSES, m.status)
    || !date(m.createdAt) || !date(m.updatedAt) || Date.parse(m.updatedAt) < Date.parse(m.createdAt)
    || !Number.isSafeInteger(m.revision) || (m.revision as number) < 0
    || !Array.isArray(m.reviews) || m.reviews.length > 20) return false
  const reviews = m.reviews
  if (!reviews.every(r => object(r) && text(r.id, 64, true) && typeof r.decision === 'string' && owns(REVIEW_DECISIONS, r.decision)
    && typeof r.comment === 'string' && !!r.comment.trim() && r.comment.length <= 400 && text(r.reviewer, 24, true) && date(r.at)
    && Number.isSafeInteger(r.revision) && (r.revision as number) > 0 && (r.revision as number) <= (m.revision as number))) return false
  if (new Set(reviews.map(r => r.id)).size !== reviews.length || reviews.some((r, i) => i > 0 && r.revision <= reviews[i - 1].revision)) return false
  if (m.status === 'draft') return m.revision === 0 && m.submittedAt === null && !reviews.length
  if (!date(m.submittedAt) || (m.revision as number) < 1 || Date.parse(m.submittedAt) < Date.parse(m.createdAt) || Date.parse(m.submittedAt) > Date.parse(m.updatedAt)) return false
  const last = reviews[reviews.length - 1]
  if (m.status === 'pending') return !last || last.decision === 'returned' && last.revision < (m.revision as number)
  return !!last && last.decision === m.status && last.revision === m.revision && Date.parse(last.at) >= Date.parse(m.submittedAt) && Date.parse(last.at) <= Date.parse(m.updatedAt)
}
/** 奏折数据单独校验；损坏时不影响圣旨、宫册与库藏。 */
export function restoreMemorials(value: unknown): MemorialState {
  const items = object(value) ? value.memorials : undefined
  return { memorials: Array.isArray(items) && items.length <= 200 && items.every(validMemorial) && new Set(items.map(m => m.id)).size === items.length ? items : [] }
}
