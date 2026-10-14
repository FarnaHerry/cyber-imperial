import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { ImperialCanvas, type ImperialCanvasHandle } from '../components/ImperialCanvas'
import { FloatingSeal } from '../components/FloatingSeal'
import { StudioIcon } from '../components/StudioIcon'
import { useFontLibrary } from '../state/fontLibrary'
import { FONT_OPTIONS, birdUnsupported } from '../core/fonts'
import { TEMPLATES, type StudioTemplate } from '../state/studioStore'
import { INKS, inkByKey } from '../core/inks'
import { PAPERS } from '../core/paper'
import { clampSealPoint } from '../core/geometry'
import { createStamp } from '../core/stamp'
import { sealCharacters } from '../core/seal'
import { playStamp, unlockAudio } from '../core/audio'
import type { StudioApi } from '../state/useStudio'
import type { Point } from '../core/types'
import './StudioPage.css'

export interface StudioPageProps {
  studio: StudioApi
  active: boolean
  exportScale: 2 | 4
  onExportScaleChange: (v: 2 | 4) => void
  exporting: boolean
  onExportingChange: (v: boolean) => void
  overflow: boolean
  onOverflowChange: (v: boolean) => void
  onNotice: (message: string) => void
}

export interface StudioPageHandle {
  exportImage(): void
  resetTemplate(): void
}

export const StudioPage = forwardRef<StudioPageHandle, StudioPageProps>(function StudioPage(
  { studio, active, exportScale, exporting, onExportingChange, overflow, onOverflowChange, onNotice },
  ref,
) {
  const { state, restored, canUndo, canRedo, addStamp, clear, undo, redo, regenerate, createFromTemplate, set } = studio
  const { fonts: customFonts, ready: fontLibraryReady, importing, importFont } = useFontLibrary()
  const fontInput = useRef<HTMLInputElement | null>(null)
  const fontTarget = useRef<'sealFont' | 'edictFont'>('sealFont')
  const stage = useRef<ImperialCanvasHandle | null>(null)
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null)
  const [revealKey, setRevealKey] = useState(0)
  const [folded, setFolded] = useState(false)
  const [scrollMoving, setScrollMoving] = useState(false)
  const [ghost, setGhost] = useState<Point | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>(restored ? '' : 'imperial')
  const [focusMode, setFocusMode] = useState(false)

  const ink = inkByKey(state.inkKey)
  const sealText = sealCharacters(state.sealText).join('') || '受命于天既寿永昌'
  const characterCount = Array.from(state.text.replace(/\s/g, '')).length
  const forceLabel = state.force < .35 ? '轻触' : state.force < .7 ? '适中' : state.force < .9 ? '重按' : '全力'
  const missingBirdChars = birdUnsupported(sealText)
  function missingFont(key: string) { return key.startsWith('custom-') && !customFonts.some(f => f.key === key) }
  function notify(message: string) { onNotice(message) }

  function chooseFontFile(target: 'sealFont' | 'edictFont') { fontTarget.current = target; fontInput.current?.click() }
  async function onFontFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    try {
      const imported = await importFont(file)
      if (fontTarget.current === 'sealFont') set({ sealFont: imported.key })
      else set({ edictFont: imported.key })
      notify(imported.persisted ? '字体已导入并保存至本机' : '字体已导入，本次会话有效')
    } catch (error) { notify(error instanceof Error ? error.message : '字体导入失败') }
    finally { input.value = '' }
  }

  function stampAt(p: Point, signature = false) {
    if (folded || scrollMoving) return
    const force = signature ? Math.min(1, state.force + .12) : state.force
    const point = clampSealPoint(p, state.sealSize, state.sealAngle)
    const ok = addStamp(createStamp({
      x: point.x,
      y: point.y,
      size: state.sealSize, ink: ink.color, force, erosion: state.erosion, text: sealText,
      font: state.sealFont, angle: state.sealAngle,
    }))
    if (!ok) { notify('印痕已达 500 枚，请清空后继续'); return }
    if (state.sound) { unlockAudio(); playStamp(force) }
  }
  function signature() {
    if (folded || scrollMoving) { notify('先展开圣旨，再落款用印'); return }
    const p = stage.current?.signature()
    if (!p) { notify('先写下正文，再落款用印'); return }
    stampAt(p, true)
    notify('落款已用印')
  }
  function selectTemplate(template: StudioTemplate) {
    setSelectedTemplate(template.key)
    createFromTemplate(template)
    notify(`已切换「${template.label}」`)
  }
  function randomize() { regenerate(); setSelectedTemplate(''); notify('新诏书已拟好') }
  function toggleScroll() { setGhost(null); setFolded(!folded) }
  function replayWriting() { setFolded(false); setRevealKey(revealKey + 1) }
  async function exportImage() {
    if (!stage.current || exporting || !active) return
    if (overflow) { notify('正文超出纸面，请减少换行或缩短正文后导出'); return }
    onExportingChange(true)
    try {
      await stage.current.download(exportScale, `赛博玉玺-${state.subject.trim() || '御制'}-${new Date().toISOString().slice(0, 10)}`)
      notify('作品已导出为 PNG')
    } catch { notify('导出失败，请重试') }
    finally { onExportingChange(false) }
  }
  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    const editing = target?.closest('input, textarea, select, [contenteditable="true"]')
    const meta = e.ctrlKey || e.metaKey
    if (!active) return
    if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); void exportImage(); return }
    if (editing || target?.closest('dialog')) return
    if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    else if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    else if (e.key === 'Enter' && (meta || e.altKey)) { e.preventDefault(); randomize() }
    else if (e.key === 'Escape') setFocusMode(false)
  }
  useEffect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
  useEffect(() => { setFocusMode(false); setGhost(null) }, [active])

  function resetTemplate() { setSelectedTemplate('') }
  useImperativeHandle(ref, () => ({
    exportImage: () => void exportImage(),
    resetTemplate,
  }))

  return (
    <>
      <main
        className={`workspace${focusMode ? ' focus-mode' : ''}`}
        aria-label="御制工坊"
        style={{ display: active ? undefined : 'none', '--ink': ink.color } as CSSProperties}
      >
        <aside className="editor side-panel" aria-label="诏书编辑">
          <div className="panel-heading"><span className="section-index">01</span><h2>拟一道诏书</h2><span className="micro">EDICT</span></div>
          <section className="panel-section template-section">
            <div className="field-heading"><h3>选择题笺</h3><span>四种灵感起笔</span></div>
            <div className="template-list">
              {TEMPLATES.map(template => (
                <button
                  key={template.key}
                  className={`template-card${selectedTemplate === template.key ? ' selected' : ''}`}
                  aria-pressed={selectedTemplate === template.key}
                  onClick={() => selectTemplate(template)}
                >
                  <span className="template-mark">{template.mark}</span>
                  <span className="template-copy"><strong>{template.label}</strong><small>{template.hint}</small></span>
                  {selectedTemplate === template.key && <span className="template-check"><StudioIcon name="check" size={14} /></span>}
                </button>
              ))}
            </div>
          </section>
          <section className="panel-section writing-section">
            <label className="field-heading" htmlFor="subject"><span>受封者</span><span>可选</span></label>
            <input id="subject" value={state.subject} onChange={e => set({ subject: e.target.value })} className="text-input" maxLength={12} placeholder="写下一个名字" />
            <div className="font-control">
              <label htmlFor="edict-font">圣旨字体</label>
              <select id="edict-font" value={state.edictFont} onChange={e => set({ edictFont: e.target.value })} className="font-select">
                {missingFont(state.edictFont) && <option value={state.edictFont} disabled>{fontLibraryReady ? '本地字体未能载入，请重新导入' : '正在载入本地字体…'}</option>}
                {FONT_OPTIONS.filter(f => f.key !== 'bird').map(font => <option key={font.key} value={font.key}>{font.label}</option>)}
                {customFonts.map(font => <option key={font.key} value={font.key}>{font.label}</option>)}
              </select>
              <button className="text-button" disabled={importing} onClick={() => chooseFontFile('edictFont')}>{importing ? '正在导入…' : '＋ 导入本地字体'}</button>
            </div>
            <div className="field-heading body-label"><label htmlFor="edict">诏书正文</label><span>{characterCount} 字</span></div>
            <textarea
              id="edict"
              value={state.text}
              onChange={e => { set({ text: e.target.value }); setSelectedTemplate('') }}
              className="edict-input"
              maxLength={1200}
              spellCheck={false}
              placeholder="从右至左，写下你想说的话…"
            />
            {overflow && <p className="overflow-warning" role="alert">正文分栏超出纸面，请减少换行或缩短正文后导出。</p>}
            <div className="writing-actions">
              <button className="text-button" onClick={randomize}><StudioIcon name="shuffle" size={15} /> 随机拟旨</button>
              <button className="text-button" disabled={!characterCount} onClick={replayWriting}><StudioIcon name="replay" size={14} /> 重放书写</button>
            </div>
          </section>
          <div className="editor-foot"><span className="small-seal">御</span><p>文字有温度，落印有分量。<br /><span>把这一刻，留在纸上。</span></p></div>
        </aside>

        <section className="canvas-workspace" aria-label="作品预览">
          <div className="canvas-toolbar">
            <div className="paper-picker" aria-label="纸张材质">
              {PAPERS.map(paper => (
                <button
                  key={paper.key}
                  className={state.paper === paper.key ? 'active' : ''}
                  aria-pressed={state.paper === paper.key}
                  onClick={() => set({ paper: paper.key })}
                >
                  <span style={{ background: paper.color }} />
                  {paper.label}
                </button>
              ))}
            </div>
            <div className="scroll-tools">
              <button className="scroll-toggle" aria-controls="edict-scroll" aria-expanded={!folded} onClick={toggleScroll}>
                <StudioIcon name={folded ? 'unfold' : 'fold'} size={15} />
                {folded ? '展开圣旨' : '收起圣旨'}
              </button>
              <button
                className="icon-button"
                aria-label={focusMode ? '退出专注模式' : '专注模式'}
                title={focusMode ? '退出专注模式 · Esc' : '专注模式'}
                aria-pressed={focusMode}
                onClick={() => setFocusMode(!focusMode)}
              >
                <StudioIcon name={focusMode ? 'close' : 'expand'} size={16} />
              </button>
            </div>
          </div>
          <div className="canvas-surface">
            <div className="paper-holder">
              <ImperialCanvas
                ref={stage}
                rolling={scrollMoving}
                onRollingChange={setScrollMoving}
                folded={folded}
                text={state.text}
                revealKey={revealKey}
                ink={ink.color}
                force={state.force}
                erosion={state.erosion}
                sealSize={state.sealSize}
                sealText={sealText}
                ghost={ghost}
                paper={state.paper}
                stamps={state.stamps}
                sealFont={state.sealFont}
                edictFont={state.edictFont}
                sealAngle={state.sealAngle}
                onStamp={stampAt}
                onOverflow={onOverflowChange}
                onUnfold={() => setFolded(false)}
              />
            </div>
          </div>
          <div className="canvas-bottom">
            <div className="history-tools">
              <button className="icon-button" disabled={!canUndo} aria-label="撤销" title="撤销 · Ctrl / ⌘ Z" onClick={undo}><StudioIcon name="undo" size={16} /></button>
              <button className="icon-button" disabled={!canRedo} aria-label="重做" title="重做 · Ctrl / ⌘ Shift Z" onClick={redo}><StudioIcon name="redo" size={16} /></button>
              <span className="tool-divider" />
              <button className="text-button clear-button" disabled={!state.stamps.length} onClick={clear}><StudioIcon name="trash" size={14} /> 清空印痕</button>
            </div>
          </div>
        </section>

        <aside className="seal-panel side-panel" aria-label="玉玺设置">
          <div className="panel-heading"><span className="section-index">02</span><h2>琢一方玉玺</h2><span className="micro">SEAL</span></div>
          <section className="seal-preview">
            <div className="seal-orbit">
              <span className="orbit-corner tl" />
              <span className="orbit-corner tr" />
              <span className="orbit-corner bl" />
              <span className="orbit-corner br" />
              <div ref={setDockEl} className="seal-dock" />
            </div>
            <span className="preview-name">{sealText === '受命于天既寿永昌' ? '传国玉玺' : '私人藏印'}</span>
          </section>
          <section className="panel-section seal-settings">
            <label className="field-heading" htmlFor="seal-text"><span>印文</span><span>1–8 字 · 右起竖读</span></label>
            <input id="seal-text" value={state.sealText} onChange={e => set({ sealText: e.target.value })} className="text-input seal-text-input" maxLength={8} placeholder="受命于天既寿永昌" />
            <div className="font-control">
              <label htmlFor="seal-font">玉玺字体</label>
              <select id="seal-font" value={state.sealFont} onChange={e => set({ sealFont: e.target.value })} className="font-select">
                {missingFont(state.sealFont) && <option value={state.sealFont} disabled>{fontLibraryReady ? '本地字体未能载入，请重新导入' : '正在载入本地字体…'}</option>}
                {FONT_OPTIONS.map(font => <option key={font.key} value={font.key}>{font.label}</option>)}
                {customFonts.map(font => <option key={font.key} value={font.key}>{font.label}</option>)}
              </select>
              <button className="text-button" disabled={importing} onClick={() => chooseFontFile('sealFont')}>{importing ? '正在导入…' : '＋ 导入本地字体'}</button>
              {state.sealFont === 'bird' && (
                <p className="field-note">
                  内置原创八字鸟虫篆风格印面。
                  {missingBirdChars.length > 0 && <>「{missingBirdChars.join('')}」使用宋体补字，可切换或导入字体。</>}
                </p>
              )}
            </div>
            <div className="slider-field angle-field">
              <label htmlFor="seal-angle">盖章角度<span>{state.sealAngle > 0 ? '+' : ''}<b>{state.sealAngle}°</b></span></label>
              <input
                id="seal-angle"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={state.sealAngle}
                onChange={e => set({ sealAngle: Number(e.target.value) })}
                style={{ '--progress': `${(state.sealAngle + 180) / 360 * 100}%` } as CSSProperties}
              />
              <div className="angle-presets">
                {[-45, 0, 45, 90].map(angle => (
                  <button key={angle} className="text-button" aria-pressed={state.sealAngle === angle} onClick={() => set({ sealAngle: angle })}>
                    {angle === 0 ? '归正' : `${angle}°`}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-heading ink-heading"><h3>印泥色泽</h3><span>{ink.label}</span></div>
            <div className="ink-picker">
              {INKS.map(item => (
                <button
                  key={item.key}
                  aria-label={item.label}
                  aria-pressed={state.inkKey === item.key}
                  className={state.inkKey === item.key ? 'active' : ''}
                  style={{ '--swatch': item.color } as CSSProperties}
                  onClick={() => set({ inkKey: item.key })}
                >
                  <span />
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
            <div className="slider-field">
              <label htmlFor="force">落印力度<span>{forceLabel} <b>{Math.round(state.force * 100)}%</b></span></label>
              <input
                id="force"
                type="range"
                min={0.15}
                max={1}
                step={0.01}
                value={state.force}
                onChange={e => set({ force: Number(e.target.value) })}
                style={{ '--progress': `${(state.force - .15) / .85 * 100}%` } as CSSProperties}
              />
              <div className="range-labels"><span>轻触</span><span>重按</span></div>
            </div>
            <div className="slider-field">
              <label htmlFor="erosion">岁月痕迹<span><b>{Math.round(state.erosion * 100)}%</b></span></label>
              <input
                id="erosion"
                type="range"
                min={0}
                max={0.92}
                step={0.01}
                value={state.erosion}
                onChange={e => set({ erosion: Number(e.target.value) })}
                style={{ '--progress': `${state.erosion / .92 * 100}%` } as CSSProperties}
              />
              <div className="range-labels"><span>新刻</span><span>斑驳</span></div>
            </div>
            <div className="slider-field">
              <label htmlFor="seal-size">印面尺寸<span><b>{state.sealSize}</b> px</span></label>
              <input
                id="seal-size"
                type="range"
                min={60}
                max={260}
                step={1}
                value={state.sealSize}
                onChange={e => set({ sealSize: Number(e.target.value) })}
                style={{ '--progress': `${(state.sealSize - 60) / 200 * 100}%` } as CSSProperties}
              />
              <div className="range-labels"><span>小巧</span><span>恢宏</span></div>
            </div>
          </section>
          <div className="seal-actions">
            <button className="button signature-button" disabled={!characterCount || folded || scrollMoving} onClick={signature}>
              <StudioIcon name="stamp" size={17} /> 落款用印<span>↗</span>
            </button>
            <button className="sound-toggle" aria-pressed={state.sound} onClick={() => set({ sound: !state.sound })}>
              <StudioIcon name={state.sound ? 'volume' : 'mute'} size={15} />
              <span>落印音效</span>
              <span className={`toggle-track${state.sound ? ' on' : ''}`}><i /></span>
            </button>
          </div>
        </aside>
      </main>
      {!focusMode && active && (
        <FloatingSeal
          ink={ink.color}
          text={sealText}
          font={state.sealFont}
          angle={state.sealAngle}
          erosion={state.erosion}
          size={128}
          dock={dockEl}
          toCanvas={(x, y) => stage.current?.toCanvas(x, y) ?? null}
          onDrop={({ clientX, clientY }) => { const p = stage.current?.toCanvas(clientX, clientY); if (p) stampAt(p) }}
          onHover={setGhost}
        />
      )}
      <input ref={fontInput} className="font-file-input" type="file" accept=".ttf,.otf,.woff,.woff2" aria-label="导入字体文件" onChange={onFontFile} />
    </>
  )
})
