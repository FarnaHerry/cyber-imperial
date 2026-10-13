export const PAGES = [
  { key: 'studio', label: '御制工坊', hint: '圣旨与印痕自动保存至本机' },
  { key: 'emperor', label: '赛博皇帝', hint: '宫册与翻牌簿自动保存至本机' },
  { key: 'treasury', label: '国库宝库', hint: '两库藏品与出入库簿自动保存至本机' },
  { key: 'officials', label: '文武百官', hint: '官册与品级职名自动保存至本机' },
  { key: 'memorials', label: '奏折批阅', hint: '奏折与朱批记录自动保存至本机' },
  { key: 'palace', label: '宫殿地图', hint: '殿名与宫殿用途自动保存至本机' },
] as const
export type PageKey = typeof PAGES[number]['key']
export function pageFromHash(hash: string): PageKey { return PAGES.find(p => `#${p.key}` === hash)?.key ?? 'studio' }
