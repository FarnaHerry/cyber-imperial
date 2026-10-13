export const PAGES = [
  { key: 'studio', label: '御制工坊' },
  { key: 'emperor', label: '赛博皇帝' },
  { key: 'treasury', label: '国库宝库' },
  { key: 'officials', label: '文武百官' },
  { key: 'memorials', label: '奏折批阅' },
  { key: 'palace', label: '宫殿地图' },
] as const
export type PageKey = typeof PAGES[number]['key']
export function pageFromHash(hash: string): PageKey { return PAGES.find(p => `#${p.key}` === hash)?.key ?? 'studio' }
