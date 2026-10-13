/**
 * 盖印音效：全部用 WebAudio 现场合成，不依赖任何音频文件。
 * 三层叠加 —— 低频闷响（撞击）+ 带通噪声（印泥吃纸）+ 高频滑音（赛博味）。
 */

let ac: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ac) ac = new Ctor()
  if (ac.state === 'suspended') void ac.resume()
  return ac
}

/** 首次用户手势时调用，解锁移动端/Chrome 的音频策略。 */
export function unlockAudio(): void {
  context()
}

export function playStamp(force = 0.7): void {
  const ctx = context()
  if (!ctx) return

  const t = ctx.currentTime
  const amp = 0.35 + force * 0.6

  const master = ctx.createGain()
  master.gain.value = amp
  master.connect(ctx.destination)

  // 1. 低频闷响
  const thud = ctx.createOscillator()
  const thudGain = ctx.createGain()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(190 + force * 60, t)
  thud.frequency.exponentialRampToValueAtTime(46, t + 0.24)
  thudGain.gain.setValueAtTime(0.0001, t)
  thudGain.gain.exponentialRampToValueAtTime(0.95, t + 0.006)
  thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
  thud.connect(thudGain).connect(master)
  thud.start(t)
  thud.stop(t + 0.32)

  // 2. 印泥吃纸的噪声
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.09))
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1250
  band.Q.value = 0.7
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.4
  noise.connect(band).connect(noiseGain).connect(master)
  noise.start(t)

  // 3. 赛博滑音
  const blip = ctx.createOscillator()
  blip.type = 'triangle'
  blip.frequency.setValueAtTime(2600, t)
  blip.frequency.exponentialRampToValueAtTime(680, t + 0.13)
  const blipGain = ctx.createGain()
  blipGain.gain.setValueAtTime(0.0001, t)
  blipGain.gain.exponentialRampToValueAtTime(0.1, t + 0.008)
  blipGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17)
  blip.connect(blipGain).connect(master)
  blip.start(t)
  blip.stop(t + 0.19)
}

/** 打字机推进的轻响。 */
export function playKey(): void {
  const ctx = context()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = 1400 + Math.random() * 900
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.035, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.06)
}
