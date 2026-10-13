export interface PalaceMember { id: string; name: string; title: string; palace: string; enabled: boolean }
export interface DrawRecord { id: string; memberId: string; name: string; title: string; palace: string; at: string }
export const DEFAULT_MEMBERS: PalaceMember[] = [
  { id: 'palace-1', name: '云裳', title: '贵妃', palace: '栖凤宫', enabled: true },
  { id: 'palace-2', name: '清月', title: '淑妃', palace: '听雪阁', enabled: true },
  { id: 'palace-3', name: '星萝', title: '贤妃', palace: '观星台', enabled: true },
  { id: 'palace-4', name: '锦瑟', title: '昭仪', palace: '长乐宫', enabled: true },
  { id: 'palace-5', name: '知微', title: '婕妤', palace: '望舒殿', enabled: true },
  { id: 'palace-6', name: '南枝', title: '美人', palace: '落英轩', enabled: true },
]
/** 使用拒绝采样避免取模偏差，每位可选人物等概率。 */
export function drawPalaceMember(members: PalaceMember[], avoidId?: string): PalaceMember | null {
  let pool = members.filter(m => m.enabled)
  if (avoidId && pool.length > 1) pool = pool.filter(m => m.id !== avoidId)
  if (!pool.length) return null
  const range = 0x100000000
  const cutoff = range - range % pool.length
  const random = new Uint32Array(1)
  do { crypto.getRandomValues(random) } while (random[0] >= cutoff)
  return pool[random[0] % pool.length]
}
export function royalEdict(text: string, kingdom: string, emperor: string): string {
  return text.replace(/赛博皇帝/g, () => `${kingdom.trim() || '赛博'}皇帝${emperor.trim() ? `「${emperor.trim()}」` : ''}`)
}
export function palaceEdict(member: Pick<PalaceMember, 'name' | 'title' | 'palace'>, kingdom: string, emperor: string): string {
  return royalEdict(`奉天承运，赛博皇帝诏曰：今有${member.title}${member.name}，居于${member.palace}，温雅端方，才情可嘉。\n\n今夜翻牌，特邀于御苑赏月，共论诗书。赐花笺一卷，玉露一盏。愿此良辰，长留心间。钦此。`, kingdom, emperor)
}
