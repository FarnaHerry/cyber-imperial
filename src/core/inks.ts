export type InkKey = 'cinnabar' | 'gold' | 'cyan' | 'violet' | 'jade'

export interface InkDef {
  key: InkKey
  label: string
  /** 印面颜色 */
  color: string
  /** UI 上的辉光色 */
  glow: string
}

export const INKS: readonly InkDef[] = [
  { key: 'cinnabar', label: '朱砂', color: '#e0453a', glow: 'rgba(224, 69, 58, 0.9)' },
  { key: 'gold', label: '鎏金', color: '#e8b13c', glow: 'rgba(232, 177, 60, 0.9)' },
  { key: 'cyan', label: '青霓', color: '#3fd6e0', glow: 'rgba(63, 214, 224, 0.9)' },
  { key: 'violet', label: '紫宸', color: '#a97cf2', glow: 'rgba(169, 124, 242, 0.9)' },
  { key: 'jade', label: '素玉', color: '#e6ded0', glow: 'rgba(230, 222, 208, 0.9)' },
]

export function inkByKey(key: InkKey): InkDef {
  return INKS.find((i) => i.key === key) ?? INKS[0]
}
