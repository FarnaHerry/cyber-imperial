import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/core/memorial.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
const { createMemorial, editMemorial, submitMemorial, reviewMemorial, restoreMemorials, memorialEdict } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const input = () => ({ title: '请拨粮赈济折', author: '谢知微', office: '太师', category: '户计', urgent: true, content: '臣谨奏：请查明灾情，拨粮赈济。' })
const restore = m => restoreMemorials(JSON.parse(JSON.stringify({ memorials: [m] }))).memorials

test('草稿上奏、发回修订、再奏和准奏留存每次朱批', () => {
  const m = createMemorial(input())
  assert.equal(m.status, 'draft')
  assert.equal(restore(m).length, 1)
  assert.equal(submitMemorial(m), '')
  assert.equal(m.revision, 1)
  assert.equal(restore(m).length, 1)
  assert.equal(reviewMemorial(m, 'returned', '补明粮数后再奏。', '景曜'), '')
  assert.equal(restore(m).length, 1)
  assert.equal(editMemorial(m, { ...input(), content: '核明灾情，拟请拨粮千石。' }), '')
  assert.equal(submitMemorial(m), '')
  assert.equal(m.revision, 2)
  assert.equal(restore(m).length, 1)
  assert.equal(reviewMemorial(m, 'approved', '准奏，依奏办理。', '景曜'), '')
  assert.deepEqual(m.reviews.map(r => [r.decision, r.revision]), [['returned', 1], ['approved', 2]])
  assert.equal(restore(m).length, 1)
  assert.match(memorialEdict(m), /准奏，依奏办理/)
})

test('待批与已批奏折禁止修改、重复上奏、重复批阅', () => {
  const m = createMemorial(input())
  assert.ok(reviewMemorial(m, 'approved', '准奏', '御批'))
  assert.equal(m.reviews.length, 0)
  submitMemorial(m)
  const before = JSON.stringify(m)
  assert.ok(submitMemorial(m))
  assert.ok(editMemorial(m, { ...input(), title: '改题' }))
  assert.ok(reviewMemorial(m, 'unknown', '准奏', '御批'))
  assert.ok(reviewMemorial(m, 'approved', '   ', '御批'))
  assert.ok(reviewMemorial(m, 'approved', '长'.repeat(401), '御批'))
  assert.equal(JSON.stringify(m), before)
  reviewMemorial(m, 'rejected', '所奏不准。', '御批')
  const closed = JSON.stringify(m)
  assert.ok(reviewMemorial(m, 'approved', '准奏', '御批'))
  assert.ok(editMemorial(m, input()))
  assert.ok(submitMemorial(m))
  assert.equal(JSON.stringify(m), closed)
  assert.equal(restore(m).length, 1)
})

test('超过输入上限或空白字段不能创建和修改奏折', () => {
  for (const change of [{ title: ' ' }, { title: '题'.repeat(25) }, { author: '' }, { office: '职'.repeat(25) }, { category: '非法' }, { urgent: 1 }, { content: '' }, { content: '文'.repeat(1201) }]) {
    assert.throws(() => createMemorial({ ...input(), ...change }))
    const m = createMemorial(input()), before = JSON.stringify(m)
    assert.ok(editMemorial(m, { ...input(), ...change }))
    assert.equal(JSON.stringify(m), before)
  }
})

test('具折人和朱批独立留档；拟旨限长且未批奏折不能拟批复', () => {
  const data = input(), m = createMemorial(data)
  data.author = '新姓名'
  assert.equal(m.author, '谢知微')
  assert.equal(memorialEdict(m), '')
  editMemorial(m, { ...input(), content: '𠮷'.repeat(600) })
  submitMemorial(m)
  assert.equal(memorialEdict(m), '')
  reviewMemorial(m, 'approved', '准'.repeat(400), '御批')
  const edict = memorialEdict(m)
  assert.ok(edict.length < 1200)
  assert.match(edict, /奏事摘录：.*…/)
  assert.equal(restore(m).length, 1)
})

test('批阅历史保留最近 20 次，修订轮次延续且仍能恢复', () => {
  const m = createMemorial(input())
  for (let i = 0; i < 23; i++) {
    assert.equal(submitMemorial(m), '')
    assert.equal(reviewMemorial(m, 'returned', `补报第 ${i + 1} 项`, '御批'), '')
  }
  assert.equal(m.reviews.length, 20)
  assert.equal(m.reviews[0].revision, 4)
  assert.equal(m.revision, 23)
  assert.equal(restore(m).length, 1)
})

test('损坏的状态、批阅记录、重复 ID 或超量档案独立恢复为空簿', () => {
  const valid = createMemorial(input())
  const cases = [null, { memorials: {} }, { memorials: [valid, valid] }, { memorials: Array.from({ length: 201 }, () => createMemorial(input())) }]
  for (const change of [{ status: '__proto__' }, { content: '文'.repeat(1201) }, { revision: -1 }, { updatedAt: 'bad' }, { status: 'approved' }, { reviews: [{}] }]) cases.push({ memorials: [{ ...valid, ...change }] })
  for (const value of cases) assert.deepEqual(restoreMemorials(value), { memorials: [] })
  const pending = createMemorial(input()); submitMemorial(pending)
  reviewMemorial(pending, 'approved', '准奏', '御批')
  const forged = JSON.parse(JSON.stringify(pending)); forged.reviews[0].revision = 2
  assert.equal(restore(forged).length, 0)
  assert.equal(restore({ ...pending, submittedAt: null }).length, 0)
})
