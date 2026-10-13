/** 原创八字鸟虫篆风格线稿：保留字骨，加入鸟首与回旋笔势。不是完整的历史篆书字库。 */
const GLYPHS: Record<string, string[]> = {
  受: ['M18 13Q48 5 82 12M25 20Q30 28 25 35M48 16V34M72 19Q64 28 70 34', 'M12 49V38H88V49', 'M24 54H76Q70 73 27 91M29 60Q41 82 83 92'],
  命: ['M8 39Q30 25 50 8Q68 28 92 39', 'M29 37H72', 'M16 52H43V82H16ZM58 49H82V78Q82 92 67 84M58 49V94'],
  于: ['M20 13Q50 7 81 13', 'M10 39Q48 32 89 39', 'M55 13V82Q55 96 34 85'],
  天: ['M19 12Q48 7 81 12', 'M9 37Q49 31 91 37', 'M50 12Q57 63 13 92M48 52Q65 80 90 92'],
  既: ['M9 15H40V44H9ZM9 29H39', 'M9 45V79Q27 71 39 68M27 59Q42 74 44 84', 'M52 14H89M61 14Q57 42 51 52H89', 'M79 26Q77 65 49 92M75 54V83Q75 97 92 84'],
  寿: ['M23 14H78M13 32H87M7 50H94', 'M55 5Q59 62 10 88', 'M17 68H90M70 54V89Q70 98 53 88M30 76Q39 83 40 89'],
  永: ['M47 8Q53 11 56 17', 'M31 29H56V85Q55 98 38 86', 'M10 47H36Q31 71 8 85', 'M83 33Q65 51 58 54M60 57Q72 77 94 86'],
  昌: ['M23 8H77V40H23ZM24 24H76', 'M16 54H84V92H16ZM17 73H83'],
}
export function drawBirdGlyph(ctx: CanvasRenderingContext2D, ch: string, width: number, height: number): boolean {
  const paths = GLYPHS[ch]
  if (!paths) return false
  ctx.save()
  ctx.scale(width / 100, height / 100)
  ctx.translate(-50, -50)
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const path of paths) ctx.stroke(new Path2D(path))
  // 鸟首的喙与眼，以及虫书的卷尾。
  ctx.lineWidth = 2.7
  ctx.stroke(new Path2D('M12 14Q2 3 10 2Q18 2 17 9L24 7M86 80Q99 74 97 89Q95 101 83 95Q76 91 84 87'))
  ctx.beginPath(); ctx.arc(11, 6, 1, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  return true
}
