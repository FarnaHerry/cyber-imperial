export const FONT_OPTIONS = [
  { key: 'bird', label: '鸟虫篆 · 八字印面', family: '"Noto Serif SC", "KaiTi", "SimSun", serif' },
  { key: 'brush', label: '毛笔行楷', family: '"Ma Shan Zheng", "KaiTi", "STKaiti", serif' },
  { key: 'kai', label: '楷体', family: '"KaiTi", "STKaiti", "Noto Serif SC", serif' },
  { key: 'serif', label: '宋体', family: '"Noto Serif SC", "SimSun", serif' },
  { key: 'hei', label: '黑体', family: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { key: 'li', label: '隶书', family: '"LiSu", "STLiti", "Noto Serif SC", serif' },
] as const
export const isFontKey = (v: unknown): v is string => typeof v === 'string' && (FONT_OPTIONS.some(f => f.key === v) || /^custom-[0-9a-f-]{36}$/.test(v))
export function fontFamily(key: string) {
  const known = FONT_OPTIONS.find(f => f.key === key)
  return known?.family ?? (isFontKey(key) ? `"${key}", "Noto Serif SC", "KaiTi", serif` : FONT_OPTIONS[3].family)
}
export const birdUnsupported = (text: string) => [...new Set(Array.from(text.replace(/\s/g, '')))].filter(ch => !'受命于天既寿永昌'.includes(ch))
