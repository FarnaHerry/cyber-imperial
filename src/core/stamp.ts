import { getSealTexture } from './seal'

/** 印痕以文档坐标存储，可序列化，窗口缩放不改变位置。 */
export interface Stamp {
  id: string
  x: number
  y: number
  size: number
  rotation: number
  ink: string
  force: number
  erosion: number
  text: string
  seed: number
  font: string
}

export function createStamp(o: Omit<Stamp, 'id' | 'rotation' | 'seed'> & { angle?: number }): Stamp {
  const { angle = 0, ...settings } = o
  return {
    ...settings,
    id: crypto.randomUUID(),
    x: o.x + (Math.random() - 0.5) * o.size * 0.015,
    y: o.y + (Math.random() - 0.5) * o.size * 0.015,
    rotation: angle * Math.PI / 180,
    seed: 1000 + Math.floor(Math.random() * 6) * 137,
  }
}

export function drawStamp(ctx: CanvasRenderingContext2D, s: Stamp, progress = 1): void {
  const t = Math.max(0, Math.min(1, progress))
  const u = t - 1
  const ease = 1 + 2.70158 * u ** 3 + 1.70158 * u ** 2
  const scale = 1 + 0.14 * (1 - ease)
  ctx.save()
  ctx.globalAlpha = (0.34 + s.force * 0.66) * Math.min(1, t / 0.35)
  ctx.translate(s.x, s.y)
  ctx.rotate(s.rotation)
  ctx.scale(scale, scale)
  ctx.drawImage(getSealTexture(s.ink, s.erosion, s.text, s.seed, s.font), -s.size / 2, -s.size / 2, s.size, s.size)
  ctx.restore()
}
