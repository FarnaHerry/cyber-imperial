export type OfficialRole = 'civil' | 'military'
export const TREASURE_KINDS = ['至宝', '金银', '粮秣', '军备', '器物', '贡品'] as const
export type TreasureKind = typeof TREASURE_KINDS[number]
export interface Treasure { id: string; name: string; kind: TreasureKind; quantity: number; unit: string; note: string }
export interface StockRecord { id: string; name: string; kind: TreasureKind; delta: number; unit: string; at: string; reason: string }
export interface Officer { id: string; name: string; role: OfficialRole; rank: string; duty: string }
export interface Hall { id: string; name: string; purpose: string }
export interface RankTitles { civil: string; military: string }
export interface EmpireState { treasures: Treasure[]; stockRecords: StockRecord[]; rankTitles: Record<string, RankTitles>; officers: Officer[]; halls: Hall[] }

const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const titles = [
  ['太师', '大将军'], ['太傅', '骠骑大将军'], ['尚书令', '镇国将军'], ['参知政事', '辅国将军'],
  ['六部尚书', '镇军将军'], ['六部侍郎', '征远将军'], ['佥都御史', '宣威将军'], ['太常寺少卿', '定远将军'],
  ['郎中', '武德将军'], ['员外郎', '昭武校尉'], ['主事', '振威校尉'], ['通判', '振武校尉'],
  ['知县', '奋武校尉'], ['县丞', '宣义校尉'], ['国子监学正', '御侮校尉'], ['训导', '守备'],
  ['主簿', '把总'], ['典史', '什长'], ['不入流小官', '不入流小官'],
]
/** 赛博官制的默认职名；品级固定，文武职名可分别自定义。 */
export const RANKS = [...numerals.flatMap((n, i) => ['正', '从'].map((prefix, j) => ({
  key: `${i + 1}-${j === 0 ? 'zheng' : 'cong'}`, label: `${prefix}${n}品`, order: i * 2 + j,
}))), { key: 'unranked', label: '不入流', order: 18 }].map((rank, i) => ({ ...rank, civil: titles[i][0], military: titles[i][1] }))
export const rankByKey = (key: string) => RANKS.find(rank => rank.key === key) ?? RANKS[18]
export const warehouseOf = (kind: TreasureKind) => kind === '至宝' ? '皇室宝库' : '国库'
export function stockBalance(quantity: number, delta: number): number | null {
  const next = quantity + delta
  return Number.isSafeInteger(quantity) && quantity >= 0 && Number.isSafeInteger(delta) && Number.isSafeInteger(next) && next >= 0 && next <= 1_000_000_000 ? next : null
}
export const DEFAULT_TREASURES: Treasure[] = [
  { id: 'treasure-seal', name: '传国玉玺', kind: '至宝', quantity: 1, unit: '方', note: '受命于天，既寿永昌。' },
  { id: 'treasure-map', name: '山河社稷图', kind: '至宝', quantity: 1, unit: '卷', note: '珍藏天下山川之形胜。' },
  { id: 'treasure-sword', name: '龙渊剑', kind: '至宝', quantity: 1, unit: '柄', note: '御赐镇国宝剑。' },
  { id: 'treasure-silver', name: '库银', kind: '金银', quantity: 500000, unit: '两', note: '用于朝廷支用。' },
  { id: 'treasure-grain', name: '储备粮', kind: '粮秣', quantity: 120000, unit: '石', note: '赈济与军粮储备。' },
  { id: 'treasure-horse', name: '战马', kind: '军备', quantity: 1500, unit: '匹', note: '供边军与禁军调拨。' },
  { id: 'treasure-silk', name: '绢帛', kind: '器物', quantity: 8000, unit: '匹', note: '礼仪、赏赐与宫用。' },
  { id: 'treasure-porcelain', name: '贡瓷', kind: '贡品', quantity: 120, unit: '件', note: '各地进献的精美瓷器。' },
]
export const DEFAULT_OFFICERS: Officer[] = [
  { id: 'official-1', name: '谢知微', role: 'civil', rank: '1-zheng', duty: '总领朝议，辅佐帝业' },
  { id: 'official-2', name: '顾怀章', role: 'civil', rank: '2-zheng', duty: '统筹政务与六部奏报' },
  { id: 'official-3', name: '沈砚秋', role: 'civil', rank: '3-zheng', duty: '掌礼制、诏书与典章' },
  { id: 'official-4', name: '陆景明', role: 'civil', rank: '7-zheng', duty: '治一方百姓，守地方安宁' },
  { id: 'official-5', name: '秦镇岳', role: 'military', rank: '1-zheng', duty: '总领军务，护国安邦' },
  { id: 'official-6', name: '萧定川', role: 'military', rank: '1-cong', duty: '统率边军，镇守山河' },
  { id: 'official-7', name: '程逐风', role: 'military', rank: '5-cong', duty: '领禁军巡防，守卫宫城' },
  { id: 'official-8', name: '韩守城', role: 'military', rank: 'unranked', duty: '巡视城门，传递军令' },
]
export const PALACE_ZONES = { court: '外朝', residence: '内廷', service: '宫务', garden: '苑囿' } as const
export type PalaceZone = keyof typeof PALACE_ZONES
export const PALACE_PLAN: { id: string; name: string; purpose: string; x: number; y: number; zone: PalaceZone }[] = [
  { id: 'garden', name: '御花园', purpose: '御苑赏月、游园与花朝宴。', x: 500, y: 85, zone: 'garden' },
  { id: 'cining', name: '慈宁宫', purpose: '奉养长辈，举行内廷家礼。', x: 215, y: 195, zone: 'residence' },
  { id: 'qianqing', name: '乾清宫', purpose: '皇帝起居、召见近臣与阅览奏章。', x: 500, y: 195, zone: 'residence' },
  { id: 'kunning', name: '坤宁宫', purpose: '皇后宫寝，统筹内廷事务。', x: 785, y: 195, zone: 'residence' },
  { id: 'qifeng', name: '栖凤宫', purpose: '宫眷居所，花笺雅集之地。', x: 215, y: 320, zone: 'residence' },
  { id: 'jiaotai', name: '交泰殿', purpose: '内廷礼仪、御玺交接与庆典。', x: 500, y: 310, zone: 'residence' },
  { id: 'changle', name: '长乐宫', purpose: '宫眷居所，丝竹宴饮之地。', x: 785, y: 320, zone: 'residence' },
  { id: 'qinzheng', name: '勤政殿', purpose: '听取奏报，处理日常朝政。', x: 215, y: 450, zone: 'court' },
  { id: 'baohe', name: '保和殿', purpose: '殿试、御宴与重大议政。', x: 500, y: 430, zone: 'court' },
  { id: 'wenyuan', name: '文渊阁', purpose: '典籍收藏、翰林修书与文官议事。', x: 785, y: 450, zone: 'court' },
  { id: 'wuying', name: '武英殿', purpose: '武官朝议、军务与阅兵筹备。', x: 215, y: 580, zone: 'court' },
  { id: 'zhonghe', name: '中和殿', purpose: '大典前整仪、休息与礼官奏报。', x: 500, y: 550, zone: 'court' },
  { id: 'royal-vault', name: '皇室宝库', purpose: '珍藏至宝，守护皇家重器。', x: 785, y: 580, zone: 'service' },
  { id: 'treasury', name: '国库', purpose: '收储金银、粮秣、军备与各地贡品。', x: 215, y: 710, zone: 'service' },
  { id: 'taihe', name: '太和殿', purpose: '登极、大朝会与国家庆典。', x: 500, y: 670, zone: 'court' },
  { id: 'kitchen', name: '御膳房', purpose: '御膳备办与宫廷宴席。', x: 785, y: 710, zone: 'service' },
  { id: 'gate', name: '午门', purpose: '宫城正门，百官依仪入朝。', x: 500, y: 810, zone: 'court' },
]
export function defaultEmpire(): EmpireState {
  return { treasures: DEFAULT_TREASURES.map(t => ({ ...t })), stockRecords: [], officers: DEFAULT_OFFICERS.map(o => ({ ...o })),
    rankTitles: Object.fromEntries(RANKS.map(r => [r.key, { civil: r.civil, military: r.military }])),
    halls: PALACE_PLAN.map(({ id, name, purpose }) => ({ id, name, purpose })) }
}
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && Array.from(v).length <= max && (!required || !!v.trim())
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function list<T extends { id: string }>(v: unknown, max: number, valid: (item: unknown) => item is T, fallback: T[]): T[] {
  return Array.isArray(v) && v.length <= max && v.every(valid) && new Set(v.map(x => x.id)).size === v.length ? v : fallback
}
/** 新领域按区块恢复；损坏的库藏或官册不会抹去已有圣旨。 */
export function restoreEmpire(value: unknown): EmpireState {
  const base = defaultEmpire(), d = object(value) ? value : {}
  base.treasures = list(d.treasures, 200, (t): t is Treasure => object(t) && text(t.id, 64, true) && text(t.name, 24, true)
    && TREASURE_KINDS.includes(t.kind as TreasureKind) && stockBalance(t.quantity as number, 0) !== null && text(t.unit, 6, true) && text(t.note, 160), base.treasures)
  base.officers = list(d.officers, 200, (o): o is Officer => object(o) && text(o.id, 64, true) && text(o.name, 12, true)
    && ['civil', 'military'].includes(o.role as string) && RANKS.some(r => r.key === o.rank) && text(o.duty, 160), base.officers)
  base.stockRecords = list(d.stockRecords, 50, (s): s is StockRecord => object(s) && text(s.id, 64, true) && text(s.name, 24, true)
    && TREASURE_KINDS.includes(s.kind as TreasureKind) && Number.isSafeInteger(s.delta) && Math.abs(s.delta as number) <= 1_000_000_000
    && text(s.unit, 6, true) && text(s.reason, 80) && text(s.at, 64) && Number.isFinite(Date.parse(s.at)), [])
  for (const r of RANKS) {
    if (r.key === 'unranked') continue
    const saved = object(d.rankTitles) ? d.rankTitles[r.key] : null
    if (object(saved) && text(saved.civil, 24, true) && text(saved.military, 24, true) && saved.civil !== saved.military) base.rankTitles[r.key] = { civil: saved.civil, military: saved.military }
  }
  if (Array.isArray(d.halls)) for (const hall of base.halls) {
    const matches = d.halls.filter(h => object(h) && h.id === hall.id)
    const saved = matches.length === 1 ? matches[0] : null
    if (object(saved) && text(saved.name, 12, true) && text(saved.purpose, 160)) { hall.name = saved.name; hall.purpose = saved.purpose }
  }
  return base
}
