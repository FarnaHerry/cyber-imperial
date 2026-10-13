/**
 * 确定性随机与平滑值噪声。
 * 印章的做旧/侵蚀效果需要「可复现的斑驳感」——同一枚印章每次盖出来
 * 的缺损纹理应当一致，所以全部走 seed 化的伪随机，而不是 Math.random。
 */

/** mulberry32：小、快、够用的确定性 PRNG。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Noise2D = (u: number, v: number) => number

/** 在一个随机格点上做双线性插值，得到平滑的「云絮」噪声。u/v 取值 [0,1)。 */
export function makeValueNoise(rand: () => number, cells: number): Noise2D {
  const n = cells + 1
  const grid = new Float32Array(n * n)
  for (let i = 0; i < grid.length; i++) grid[i] = rand()

  const smooth = (t: number) => t * t * (3 - 2 * t)

  return (u, v) => {
    const x = Math.min(Math.max(u, 0), 0.9999) * cells
    const y = Math.min(Math.max(v, 0), 0.9999) * cells
    const x0 = x | 0
    const y0 = y | 0
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const a = grid[y0 * n + x0]
    const b = grid[y0 * n + x0 + 1]
    const c = grid[(y0 + 1) * n + x0]
    const d = grid[(y0 + 1) * n + x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
  }
}

/** 多倍频叠加，越大越粗糙，越小越成片。 */
export function fbm(octaves: Noise2D[], weights: number[]): Noise2D {
  const total = weights.reduce((s, w) => s + w, 0) || 1
  return (u, v) => {
    let sum = 0
    for (let i = 0; i < octaves.length; i++) sum += octaves[i](u, v) * weights[i]
    return sum / total
  }
}
