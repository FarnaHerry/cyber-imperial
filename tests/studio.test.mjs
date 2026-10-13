import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createRenderer, nextTick } from 'vue'
import ts from 'typescript'

const modules = new Map()
async function compileFile(url) {
  if (modules.has(url.href)) return modules.get(url.href)
  let output = ts.transpileModule(await readFile(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  for (const match of [...output.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
    const specifier = match[1]
    const resolved = specifier.startsWith('.') ? await compileFile(new URL(`${specifier}.ts`, url)) : import.meta.resolve(specifier)
    output = output.replace(match[0], `from ${JSON.stringify(resolved)}`)
  }
  const compiled = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
  modules.set(url.href, compiled)
  return compiled
}
const { useStudio } = await import(await compileFile(new URL('../src/composables/useStudio.ts', import.meta.url)))
const storage = new Map()
globalThis.window = new EventTarget()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
}
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, patchProp() {}, setText() {}, setElementText() {},
  parentNode: () => null, nextSibling: () => null,
})
function mount() {
  let studio
  const app = renderer.createApp({ setup() { studio = useStudio(); return () => null } })
  app.mount({})
  return { studio, stop: () => app.unmount() }
}
const stamp = id => ({ id, x: 400, y: 500, size: 148, rotation: 0, ink: '#e0453a', force: .76, erosion: .38, text: '受命于天既寿永昌', seed: 1000, font: 'serif' })

test('清空全部印痕可撤销，也可重做', () => {
  storage.clear()
  const { studio, stop } = mount()
  try {
    studio.addStamp(stamp('a')); studio.addStamp(stamp('b')); studio.clear()
    assert.equal(studio.state.stamps.length, 0)
    studio.undo()
    assert.deepEqual(studio.state.stamps.map(s => s.id), ['a', 'b'])
    studio.redo()
    assert.equal(studio.state.stamps.length, 0)
  } finally { stop() }
})

test('撤销后继续盖印会丢弃原来的重做分支', () => {
  storage.clear()
  const { studio, stop } = mount()
  try {
    studio.addStamp(stamp('a')); studio.addStamp(stamp('b')); studio.undo(); studio.addStamp(stamp('c'))
    assert.equal(studio.canRedo.value, false)
    studio.redo()
    assert.deepEqual(studio.state.stamps.map(s => s.id), ['a', 'c'])
  } finally { stop() }
})

test('离开页面前保存，草稿完整恢复印文、正文和印痕', async () => {
  storage.clear()
  const first = mount()
  first.studio.state.sealText = '山海皆可平'
  first.studio.state.text = '这是草稿'
  first.studio.state.paper = 'night'
  first.studio.addStamp(stamp('a'))
  await nextTick()
  window.dispatchEvent(new Event('pagehide'))
  assert.equal(first.studio.saveStatus.value, 'saved')
  first.stop()
  const second = mount()
  try {
    assert.equal(second.studio.restored, true)
    assert.equal(second.studio.state.text, '这是草稿')
    assert.equal(second.studio.state.sealText, '山海皆可平')
    assert.equal(second.studio.state.paper, 'night')
    assert.equal(second.studio.state.stamps[0].id, 'a')
  } finally { second.stop() }
})

test('损坏或越界的本地草稿不会阻止启动', () => {
  storage.clear()
  storage.set('cyber-imperial-studio:v2', '{broken')
  const broken = mount()
  assert.equal(broken.studio.restored, false)
  broken.stop()
  const draft = JSON.parse(storage.get('cyber-imperial-studio:v2'))
  draft.state.stamps = [{ ...stamp('bad'), size: 999999 }]
  storage.set('cyber-imperial-studio:v2', JSON.stringify(draft))
  const invalid = mount()
  try {
    assert.equal(invalid.studio.restored, false)
    assert.equal(invalid.studio.state.stamps.length, 0)
  } finally { invalid.stop() }
})

test('本地存储不可用时仍然可以创作', () => {
  const original = localStorage.setItem
  localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  const { studio, stop } = mount()
  try {
    assert.equal(studio.saveStatus.value, 'unavailable')
    assert.equal(studio.addStamp(stamp('offline')), true)
    assert.equal(studio.state.stamps.length, 1)
  } finally { stop(); localStorage.setItem = original }
})

const { drawPalaceMember, royalEdict } = await import(await compileFile(new URL('../src/core/palace.ts', import.meta.url)))
const { createStamp } = await import(await compileFile(new URL('../src/core/stamp.ts', import.meta.url)))

test('迁移 2.0 草稿时保留已有印痕的宋体，新增玉玺默认鸟虫篆风格', () => {
  storage.clear()
  const initial = mount()
  initial.studio.addStamp(stamp('legacy'))
  initial.stop()
  const old = JSON.parse(storage.get('cyber-imperial-studio:v2'))
  old.version = 2
  for (const key of ['theme', 'sealFont', 'edictFont', 'sealAngle', 'kingdom', 'emperor', 'members', 'draws', 'avoidRepeat']) delete old.state[key]
  delete old.state.stamps[0].font
  storage.set('cyber-imperial-studio:v2', JSON.stringify(old))
  const { studio, stop } = mount()
  try {
    assert.equal(studio.restored, true)
    assert.equal(studio.state.stamps[0].font, 'serif')
    assert.equal(studio.state.sealFont, 'bird')
    assert.equal(studio.state.sealAngle, 0)
    assert.equal(studio.state.members.length, 6)
  } finally { stop() }
})

test('180 度印痕正确记录角度和字体，后续设置不会修改旧印痕', () => {
  const created = createStamp({ ...stamp('angle'), angle: 180, font: 'kai' })
  assert.equal(created.rotation, Math.PI)
  assert.equal(created.font, 'kai')
  assert.equal('angle' in created, false)
})

test('停用人物不会被抽中，单人宫册允许再次翻中同一人', () => {
  const members = [{ id: 'a', name: '甲', title: '妃', palace: '甲宫', enabled: false }, { id: 'b', name: '乙', title: '妃', palace: '乙宫', enabled: true }]
  for (let i = 0; i < 30; i++) assert.equal(drawPalaceMember(members, 'b').id, 'b')
  members[1].enabled = false
  assert.equal(drawPalaceMember(members), null)
})

test('多人抽签在启用防重复时跳过上次人物', () => {
  const members = ['a', 'b', 'c'].map(id => ({ id, name: id, title: '妃', palace: '宫', enabled: true }))
  for (let i = 0; i < 100; i++) assert.notEqual(drawPalaceMember(members, 'b').id, 'b')
})

test('主题、国号、名讳、字体、旋转、宫册与翻牌历史均可恢复', () => {
  storage.clear()
  const first = mount()
  Object.assign(first.studio.state, { theme: 'light', kingdom: '大玄', emperor: '景曜', edictFont: 'li', sealFont: 'kai', sealAngle: 135 })
  const record = first.studio.flip()
  first.studio.regenerate()
  assert.ok(first.studio.state.text.includes('大玄皇帝「景曜」') || first.studio.state.text.startsWith('制曰'))
  first.stop()
  const { studio, stop } = mount()
  try {
    assert.equal(studio.restored, true)
    assert.equal(studio.state.theme, 'light')
    assert.equal(studio.state.kingdom, '大玄')
    assert.equal(studio.state.emperor, '景曜')
    assert.equal(studio.state.sealFont, 'kai')
    assert.equal(studio.state.edictFont, 'li')
    assert.equal(studio.state.sealAngle, 135)
    assert.equal(studio.state.draws[0].id, record.id)
    assert.equal(studio.state.members.length, 6)
  } finally { stop() }
})

test('翻牌簿只保留 50 次，历史记录不随宫册改名而改变', () => {
  storage.clear()
  const { studio, stop } = mount()
  try {
    studio.state.members = [{ id: 'only', name: '旧名', title: '妃', palace: '旧宫', enabled: true }]
    for (let i = 0; i < 55; i++) studio.flip()
    studio.state.members[0].name = '新名'
    assert.equal(studio.state.draws.length, 50)
    assert.ok(studio.state.draws.every(d => d.name === '旧名'))
  } finally { stop() }
})

test('皇帝称谓使用字面替换，美元符号不会触发替换字符串语法', () => {
  assert.equal(royalEdict('赛博皇帝诏曰', '$&', '$`'), '$&皇帝「$`」诏曰')
})

const { clampSealPoint, sealHalfExtent } = await import(await compileFile(new URL('../src/core/geometry.ts', import.meta.url)))

test('旋转 45 度的印章在四角落印时仍保持完整边界', () => {
  const size = 260
  const extent = sealHalfExtent(size, 45)
  for (const point of [{x:0,y:0},{x:1200,y:0},{x:0,y:800},{x:1200,y:800}]) {
    const p = clampSealPoint(point, size, 45)
    assert.ok(p.x >= extent && p.x <= 1200 - extent)
    assert.ok(p.y >= extent && p.y <= 800 - extent)
  }
})

test('180 度旋转的占地与 0 度一致，45 度需要更大的边界', () => {
  assert.ok(Math.abs(sealHalfExtent(148, 180) - sealHalfExtent(148, 0)) < 1e-9)
  assert.ok(sealHalfExtent(148, 45) > sealHalfExtent(148, 0))
})

const { RANKS, TREASURE_KINDS, warehouseOf, stockBalance, PALACE_PLAN } = await import(await compileFile(new URL('../src/core/empire.ts', import.meta.url)))

test('文武共用十九档品级，正一品最高、从品低于同级正品、不入流最低', () => {
  assert.equal(RANKS.length, 19)
  assert.equal(RANKS[0].label, '正一品')
  assert.equal(RANKS[1].label, '从一品')
  assert.equal(RANKS[17].label, '从九品')
  assert.equal(RANKS[18].label, '不入流')
  assert.equal(new Set(RANKS.map(r => r.key)).size, 19)
  for (let i = 0; i < 18; i += 2) {
    assert.ok(RANKS[i].order < RANKS[i + 1].order)
    assert.notEqual(RANKS[i].civil, RANKS[i].military)
    assert.notEqual(RANKS[i + 1].civil, RANKS[i + 1].military)
  }
  assert.equal(RANKS[18].civil, '不入流小官')
  assert.equal(RANKS[18].military, '不入流小官')
})

test('至宝专入皇室宝库；库存不允许超支、负数、小数或超过上限', () => {
  for (const kind of TREASURE_KINDS) assert.equal(warehouseOf(kind), kind === '至宝' ? '皇室宝库' : '国库')
  assert.equal(stockBalance(10, -10), 0)
  assert.equal(stockBalance(10, 5), 15)
  for (const [quantity, delta] of [[10, -11], [-1, 2], [10, .5], [NaN, 0], [1000000000, 1], [10, Infinity]]) assert.equal(stockBalance(quantity, delta), null)
})

test('3.0 草稿迁移后保留圣旨与印痕，补全双库、官制和宫殿图', () => {
  storage.clear()
  const first = mount()
  first.studio.state.text = '旧朝圣旨'
  first.studio.addStamp(stamp('migration'))
  first.stop()
  const old = JSON.parse(storage.get('cyber-imperial-studio:v2'))
  old.version = 3
  for (const key of ['treasures', 'stockRecords', 'officers', 'rankTitles', 'halls']) delete old.state[key]
  storage.set('cyber-imperial-studio:v2', JSON.stringify(old))
  const { studio, stop } = mount()
  try {
    assert.equal(studio.restored, true)
    assert.equal(studio.state.text, '旧朝圣旨')
    assert.equal(studio.state.stamps[0].id, 'migration')
    assert.equal(Object.keys(studio.state.rankTitles).length, 19)
    assert.equal(studio.state.halls.length, PALACE_PLAN.length)
    assert.ok(studio.state.treasures.some(t => t.kind === '至宝'))
    assert.equal(JSON.parse(storage.get('cyber-imperial-studio:v2')).version, 4)
  } finally { stop() }
})

test('双库数量、出入库簿、文武职名与官员品级、殿名在刷新后恢复', () => {
  storage.clear()
  const first = mount(), s = first.studio.state
  s.treasures[0].kind = '器物'; s.treasures[0].quantity = 12
  s.rankTitles['1-cong'] = { civil: '内阁首辅', military: '镇国上将' }
  s.officers[0].rank = '1-cong'; s.officers[0].role = 'military'
  s.halls[0].name = '上林御苑'; s.halls[0].purpose = '游赏'
  s.stockRecords = [{ id: 'stock-test', name: '库银', kind: '金银', delta: -10, unit: '两', at: new Date().toISOString(), reason: '调拨' }]
  first.stop()
  const { studio, stop } = mount()
  try {
    assert.equal(studio.state.treasures[0].quantity, 12)
    assert.equal(warehouseOf(studio.state.treasures[0].kind), '国库')
    assert.deepEqual(studio.state.rankTitles['1-cong'], { civil: '内阁首辅', military: '镇国上将' })
    assert.equal(studio.state.officers[0].rank, '1-cong')
    assert.equal(studio.state.officers[0].role, 'military')
    assert.equal(studio.state.halls[0].name, '上林御苑')
    assert.equal(studio.state.stockRecords[0].delta, -10)
  } finally { stop() }
})

test('损坏的新领域单独恢复，不入流职名固定，既有圣旨不被清空', () => {
  storage.clear()
  const first = mount(); first.studio.state.text = '留下这道旨'; first.studio.addStamp(stamp('safe')); first.stop()
  const data = JSON.parse(storage.get('cyber-imperial-studio:v2'))
  data.state.treasures[0].quantity = -1
  data.state.officers[0].rank = '10-zheng'
  data.state.rankTitles.unranked = { civil: '太师', military: '大将军' }
  data.state.halls[0].name = ''
  storage.set('cyber-imperial-studio:v2', JSON.stringify(data))
  const { studio, stop } = mount()
  try {
    assert.equal(studio.state.text, '留下这道旨')
    assert.equal(studio.state.stamps[0].id, 'safe')
    assert.ok(studio.state.treasures.every(t => t.quantity >= 0))
    assert.ok(studio.state.officers.every(o => RANKS.some(r => r.key === o.rank)))
    assert.equal(studio.state.rankTitles.unranked.civil, '不入流小官')
    assert.ok(studio.state.halls[0].name)
  } finally { stop() }
})
