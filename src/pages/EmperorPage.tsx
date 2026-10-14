import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DrawRecord, PalaceMember } from '../core/palace'
import { memberColor } from '../core/palace'
import type { StudioApi } from '../state/useStudio'
import { StudioIcon } from '../components/StudioIcon'
import './EmperorPage.css'

export interface EmperorPageProps {
  studio: StudioApi
  onEdict: (record: DrawRecord) => void
  onStudio: () => void
}

function time(at: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(at))
}

export function EmperorPage({ studio, onEdict, onStudio }: EmperorPageProps) {
  const state = studio.state
  const [drawing, setDrawing] = useState(false)
  const editor = useRef<HTMLDialogElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftId, setDraftId] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState({ name: '', title: '', palace: '', color: '' })
  const [formError, setFormError] = useState('')
  const [removed, setRemoved] = useState<{ member: PalaceMember; index: number } | null>(null)
  const timer = useRef(0)
  const activeCount = state.members.filter(m => m.enabled).length
  const selected = state.draws[0] ?? null

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function flipCard() {
    if (drawing || !activeCount) return
    setDrawing(true)
    timer.current = window.setTimeout(() => { studio.flip(); setDrawing(false) }, 850)
  }
  function edit(member?: PalaceMember) {
    setEditingId(member?.id ?? null)
    setForm({ name: member?.name ?? '', title: member?.title ?? '美人', palace: member?.palace ?? '未央宫', color: member?.color ?? '' })
    setFormError('')
    editor.current?.showModal()
  }
  function submit() {
    const name = form.name.trim(), title = form.title.trim(), palace = form.palace.trim()
    if (!name || !title || !palace) { setFormError('请填写姓名、位份与宫苑'); return }
    if ([name, title, palace].some(v => Array.from(v).length > 12)) { setFormError('每项最多 12 字'); return }
    const color = form.color.trim() || undefined
    if (editingId) {
      const member = state.members.find(m => m.id === editingId)
      if (member) studio.set({ members: state.members.map(m => m.id === editingId ? { ...m, name, title, palace, color } : m) })
    } else {
      if (state.members.length >= 24) { setFormError('宫册最多容纳 24 位人物'); return }
      studio.set({ members: [...state.members, { id: draftId, name, title, palace, enabled: true, color }] })
      setDraftId(crypto.randomUUID())
    }
    editor.current?.close()
  }
  function remove(member: PalaceMember) {
    const index = state.members.findIndex(m => m.id === member.id)
    if (index < 0) return
    setRemoved({ member: { ...member }, index })
    studio.set({ members: state.members.filter(m => m.id !== member.id) })
    editor.current?.close()
  }
  function restoreMember() {
    if (!removed || state.members.length >= 24) return
    const { member, index } = removed
    studio.set({ members: [...state.members.slice(0, index), member, ...state.members.slice(index)] })
    setRemoved(null)
  }

  return (
    <main className="emperor-page">
      <section className="royal-profile palace-panel">
        <span className="eyebrow">THE CYBER EMPEROR</span><div className="royal-emblem" aria-hidden="true">帝</div>
        <p className="royal-overline">{state.kingdom.trim() || '赛博'} · 御极于云端</p>
        <h1>{state.emperor.trim() || '赛博皇帝'}</h1><p className="royal-description">一朝一号，一字一旨。<br />此间天地，由你落笔。</p>
        <div className="royal-settings">
          <label htmlFor="kingdom-name">国号<span>最多 12 字</span></label>
          <input id="kingdom-name" value={state.kingdom} onChange={e => studio.set({ kingdom: e.target.value })} className="text-input" maxLength={12} placeholder="赛博" />
          <label htmlFor="emperor-name">皇帝名讳<span>可留空</span></label>
          <input id="emperor-name" value={state.emperor} onChange={e => studio.set({ emperor: e.target.value })} className="text-input" maxLength={12} placeholder="写下朕的名讳" />
          <p className="field-note">用于新拟圣旨的称谓，以及卷轴上的御制落款。</p>
        </div>
        <button className="button signature-button" onClick={onStudio}><StudioIcon name="stamp" size={16} /> 移驾御制工坊 <span>↗</span></button>
      </section>
      <section className="palace-main">
        <div className="palace-heading"><div><span className="eyebrow">THE INNER COURT</span><h2>今夜，翻谁的牌？</h2><p>一方名牌，一场良辰。宫册由你定，缘分交给天意。</p></div><button className="button subtle-button" disabled={drawing || state.members.length >= 24} onClick={() => edit()}>＋ 添入宫册</button></div>
        <div className="palace-toolbar"><span><b>{activeCount}</b> 位可翻 · {state.members.length} 位入册</span><label className="repeat-setting"><input checked={state.avoidRepeat} onChange={e => studio.set({ avoidRepeat: e.target.checked })} type="checkbox" disabled={drawing} /> 避免连续翻中同一人</label></div>
        {!!state.members.length && (
          <div className={`palace-cards${drawing ? ' drawing' : ''}`}>
            {state.members.map((member, i) => (
              <article key={member.id} className={`palace-card${member.enabled ? '' : ' inactive'}${selected?.memberId === member.id && !drawing ? ' chosen' : ''}`} style={{ '--card-index': i, '--member-color': memberColor(member) } as CSSProperties}>
                <button className="card-edit" aria-label={`编辑${member.name}`} disabled={drawing} onClick={() => edit(member)}>编辑</button>
                <div className="name-plaque"><span className="plaque-palace">{member.palace}</span><span className="plaque-name">{member.name}</span><span className="plaque-title">{member.title}</span><span className="plaque-knot" aria-hidden="true">◇</span></div>
                <button className="card-eligibility" aria-label={`${member.name}参与翻牌`} aria-pressed={member.enabled} disabled={drawing} onClick={() => studio.set({ members: state.members.map(m => m.id === member.id ? { ...m, enabled: !m.enabled } : m) })}><span className="status-light" />{member.enabled ? '参与翻牌' : '暂不参与'}</button>
              </article>
            ))}
          </div>
        )}
        {!state.members.length && <div className="palace-empty"><span>宫册尚空</span><p>添入一位人物，再开启今夜的故事。</p><button className="button subtle-button" onClick={() => edit()}>＋ 添入宫册</button></div>}
        {removed && <div className="restore-member" role="status">已移出 {removed.member.name} <button className="text-button" disabled={state.members.length >= 24} onClick={restoreMember}>恢复入册</button></div>}
        <div className="flip-action"><button className="button flip-button" disabled={drawing || !activeCount} onClick={flipCard}><span aria-hidden="true">✧</span>{drawing ? '天意流转，候旨片刻…' : '随机翻牌'}<span aria-hidden="true">✧</span></button><p>{!activeCount ? '请先启用一位人物参与翻牌' : state.avoidRepeat && activeCount > 1 ? '等概率抽取，跳过上次翻中的人物' : '在参与翻牌的人物中等概率抽取'}</p></div>
        {selected && !drawing && <FlipResult key={selected.id} record={selected} onEdict={onEdict} />}
        <section className="draw-history palace-panel">
          <div className="history-heading"><h3>翻牌簿</h3><span>保留最近 50 次 · 北京时间</span></div>
          {!state.draws.length
            ? <p className="field-note">今夜尚未落笔，第一份缘分正等着你。</p>
            : (
              <ol>
                {state.draws.slice(0, 8).map(record => (
                  <li key={record.id}><span className="record-mark">翻</span><span><strong>{record.name}</strong><small>{record.title} · {record.palace}</small></span><time dateTime={record.at}>{time(record.at)}</time><button className="text-button" aria-label={`为${record.name}拟旨`} onClick={() => onEdict(record)}>拟旨 ↗</button></li>
                ))}
              </ol>
            )}
          {state.draws.length > 8 && (
            <details>
              <summary>查看更早的 {state.draws.length - 8} 次翻牌</summary>
              <ol>
                {state.draws.slice(8).map(record => (
                  <li key={record.id}><span className="record-mark">翻</span><span><strong>{record.name}</strong><small>{record.title} · {record.palace}</small></span><time dateTime={record.at}>{time(record.at)}</time><button className="text-button" aria-label={`为${record.name}拟旨`} onClick={() => onEdict(record)}>拟旨 ↗</button></li>
                ))}
              </ol>
            </details>
          )}
        </section>
      </section>
      <dialog
        ref={editor}
        className="help-dialog member-dialog"
        aria-labelledby="member-dialog-title"
        onClick={e => { if (e.target === editor.current) editor.current?.close() }}
      >
        <button className="icon-button dialog-close" aria-label="关闭宫册编辑" onClick={() => editor.current?.close()}><StudioIcon name="close" /></button>
        <span className="eyebrow">PALACE REGISTER</span>
        <h2 id="member-dialog-title">{editingId ? '编辑宫册' : '添入宫册'}</h2>
        <form onSubmit={e => { e.preventDefault(); submit() }}>
          <label htmlFor="member-name">姓名</label>
          <input id="member-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="text-input" maxLength={12} required />
          <label htmlFor="member-title">位份</label>
          <input id="member-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="text-input" maxLength={12} required />
          <label htmlFor="member-palace">宫苑</label>
          <input id="member-palace" value={form.palace} onChange={e => setForm(f => ({ ...f, palace: e.target.value }))} className="text-input" maxLength={12} required />
          <label htmlFor="member-color">名牌颜色</label>
          <div className="member-color-row">
            <i className="rank-dot" style={{ background: form.color || memberColor({ id: editingId ?? draftId }) }} />
            <input id="member-color" type="color" value={form.color || memberColor({ id: editingId ?? draftId })} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="rank-color-input" aria-label="名牌颜色" />
            <button className="text-button" type="button" onClick={() => setForm(f => ({ ...f, color: '' }))}>自动配色</button>
          </div>
          <p className="field-note">留空则按名册自动配色，颜色显示为名牌边框。</p>
          {!!formError && <p className="overflow-warning" role="alert">{formError}</p>}
          <div className="member-dialog-actions">
            {editingId && <button className="text-button" type="button" onClick={() => remove(state.members.find(m => m.id === editingId)!)}>移出宫册</button>}
            <button className="button signature-button" type="submit">保存宫册</button>
          </div>
        </form>
      </dialog>
    </main>
  )
}

function FlipResult({ record, onEdict }: { record: DrawRecord; onEdict: (record: DrawRecord) => void }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setEntered(true)) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [])
  return (
    <section className={`flip-result reveal-enter-active${entered ? '' : ' reveal-enter-from'}`} aria-live="polite">
      <div><span className="eyebrow">TONIGHT’S DESTINY</span><p>今夜翻中 <strong>{record.title} · {record.name}</strong><span>{record.palace}</span></p></div>
      <button className="button signature-button" onClick={() => onEdict(record)}><StudioIcon name="stamp" size={16} /> 为{record.name}拟旨 <span>↗</span></button>
    </section>
  )
}
