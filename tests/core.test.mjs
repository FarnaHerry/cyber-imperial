import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/core/text.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
const { layoutVertical } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const options = { right: 200, top: 0, bottom: 48, fontSize: 20 }

test('中文按右起竖读顺序分栏，文字无丢失', () => {
  const layout = layoutVertical('一二三四五', options)
  assert.equal(layout.glyphs.map(g => g.ch).join(''), '一二三四五')
  assert.equal(layout.glyphs[0].x, layout.glyphs[1].x)
  assert.ok(layout.glyphs[2].x < layout.glyphs[1].x)
  assert.ok(layout.glyphs[1].y > layout.glyphs[0].y)
})

test('末尾句号悬挂在前列，避免独占一列影响落款', () => {
  const layout = layoutVertical('钦此。', options)
  assert.equal(layout.cols, 1)
  assert.equal(layout.glyphs[2].col, layout.glyphs[1].col)
  assert.ok(layout.glyphs[2].y <= options.bottom)
})

test('悬挂标点之后的正文仍正确换列', () => {
  const layout = layoutVertical('钦此。下一道', options)
  assert.equal(layout.glyphs.map(g => g.ch).join(''), '钦此。下一道')
  assert.equal(layout.glyphs[3].col, 1)
  assert.ok(layout.glyphs.every(g => g.y <= options.bottom))
})

test('显式段落留空列，括号保留竖排旋转', () => {
  const layout = layoutVertical('甲\n\n「乙」', { ...options, bottom: 200 })
  assert.equal(layout.glyphs[1].col, 2)
  assert.equal(layout.glyphs[1].rotated, true)
  assert.equal(layout.glyphs[3].rotated, true)
})

test('Unicode 字符以完整码点排版', () => {
  const layout = layoutVertical('山𠮷海', options)
  assert.equal(layout.glyphs.length, 3)
  assert.equal(layout.glyphs[1].ch, '𠮷')
})

test('限制分栏时不在纸面之外绘制文字', () => {
  const layout = layoutVertical('一二三四五六七八九', { ...options, maxCols: 2 })
  assert.equal(layout.glyphs.length, 4)
  assert.ok(layout.glyphs.every(g => g.col < 2))
})
