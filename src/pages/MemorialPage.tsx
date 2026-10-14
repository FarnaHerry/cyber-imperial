import { useEffect, useRef, useState } from 'react'
import { EmpirePage } from '../components/EmpirePage'
import { StudioIcon } from '../components/StudioIcon'
import type { StudioApi } from '../state/useStudio'
import { MEMORIAL_CATEGORIES, MEMORIAL_STATUSES, REVIEW_DECISIONS, canEditMemorial, createMemorial, editMemorial, submitMemorial, reviewMemorial, validateMemorialInput, type Memorial, type MemorialInput, type MemorialStatus, type ReviewDecision } from '../core/memorial'
import './MemorialPage.css'

export interface MemorialPageProps {
  studio: StudioApi
  onNotice: (message: string) => void
  onEdict: (memorial: Memorial) => void
}

const blankForm = (): MemorialInput => ({ title: '', author: '', office: '', category: '其他', urgent: false, content: '' })

export function MemorialPage({ studio, onNotice, onEdict }: MemorialPageProps) {
  const { state, set } = studio
  const [status, setStatus] = useState<MemorialStatus | 'all'>('pending')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const editorRef = useRef<HTMLDialogElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [officerId, setOfficerId] = useState('')
  const [form, setForm] = useState<MemorialInput>(blankForm)
  const [removed, setRemoved] = useState<Memorial | null>(null)

  const counts: Record<string, number> = Object.fromEntries(Object.keys(MEMORIAL_STATUSES).map(key => [key, state.memorials.filter(m => m.status === key).length]))
  const filtered = state.memorials.filter(m => (status === 'all' || m.status === status)
    && (category === 'all' || m.category === category)
    && `${m.title} ${m.author} ${m.office} ${m.content} ${m.reviews.map(r => r.comment).join(' ')}`.includes(query.trim()))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const selected = filtered.find(m => m.id === selectedId) ?? filtered[0] ?? null

  useEffect(() => {
    setComment('')
    setReviewError('')
  }, [selected?.id])

  const formatDate = (at: string) => new Date(at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  function openEditor(m?: Memorial) {
    setEditingId(m?.id ?? null)
    setForm(m ? { title: m.title, author: m.author, office: m.office, category: m.category, urgent: m.urgent, content: m.content } : blankForm())
    setOfficerId(''); setError('')
    editorRef.current?.showModal()
  }
  function chooseOfficer(id: string) {
    const officer = state.officers.find(o => o.id === id)
    if (officer) setForm(f => ({ ...f, author: officer.name, office: state.rankTitles[officer.rank][officer.role] }))
  }
  function applyTemplate(key: string) {
    const templates: Record<string, Pick<MemorialInput, 'title' | 'category' | 'content'>> = {
      relief: { title: '请拨粮赈济灾民折', category: '户计', content: '臣谨奏：近日连雨，地方农田受损，百姓生计艰难。臣已遣员核查灾情、登记受灾户数，拟请拨付储备粮，设棚赈济。\n\n所需粮数、转运路线与发放名册，将另附详单。恳请圣裁。' },
      defense: { title: '请修缮边防营垒折', category: '军务', content: '臣谨奏：边防营垒久经风雨，部分城防与军械亟待修整。臣拟先查勘险要、编列用度，再分段修缮，保留巡防兵力。\n\n请准组织勘验，核明工期与军需后另行奏报。恳请圣裁。' },
      talent: { title: '荐贤任官折', category: '吏治', content: '臣谨奏：治国之要，在于得人。今察地方有贤才，勤于政事、熟悉民情，拟荐其入朝考核。\n\n请准核查履历与实绩，择才授职，以备朝廷之用。恳请圣裁。' },
    }
    if (templates[key]) setForm(f => ({ ...f, ...templates[key] }))
  }
  function saveForm(send: boolean) {
    const validation = validateMemorialInput(form)
    setError(validation)
    if (validation) return
    const existing = state.memorials.find(item => item.id === editingId)
    if (editingId && !existing) { setError('这份奏折已不存在。'); return }
    if (!existing && state.memorials.length >= 200) { setError('奏折簿最多收录 200 份。'); return }
    let m: Memorial
    if (existing) {
      const editError = editMemorial(existing, form)
      setError(editError)
      if (editError) return
      m = existing
    } else {
      m = createMemorial(form)
    }
    if (send) {
      const submitError = submitMemorial(m)
      setError(submitError)
      if (submitError) return
    }
    set({ memorials: existing ? state.memorials.map(x => x.id === m.id ? { ...x } : x) : [...state.memorials, m] })
    setCategory('all'); setQuery(''); setStatus(m.status); setSelectedId(m.id)
    editorRef.current?.close()
    onNotice(send ? '奏折已上奏，等候朱批' : '奏折草稿已保存')
  }
  function sendSelected() {
    const m = selected
    if (!m) return
    const message = submitMemorial(m)
    if (message) { onNotice(message); return }
    set({ memorials: state.memorials.map(x => x.id === m.id ? { ...x } : x) })
    setStatus('pending'); setSelectedId(m.id); onNotice('奏折已上奏，等候朱批')
  }
  function review(decision: ReviewDecision) {
    const m = selected
    if (!m) return
    const message = reviewMemorial(m, decision, comment, state.emperor.trim() || '御批')
    setReviewError(message)
    if (message) return
    set({ memorials: state.memorials.map(x => x.id === m.id ? { ...x } : x) })
    setStatus(decision); setSelectedId(m.id); setComment('')
    onNotice(`朱批已登记：${REVIEW_DECISIONS[decision]}`)
  }
  function removeDraft() {
    const m = selected
    if (!m || m.status !== 'draft') return
    setRemoved(m)
    set({ memorials: state.memorials.filter(item => item.id !== m.id) })
    onNotice('草稿已移出，可恢复')
  }
  function restoreDraft() {
    if (!removed || state.memorials.length >= 200) return
    const m = removed
    set({ memorials: [...state.memorials, m] })
    setRemoved(null)
    setStatus('draft'); setCategory('all'); setQuery(''); setSelectedId(m.id)
  }

  return (
    <>
      <EmpirePage
        title="奏折批阅"
        eyebrow="THE IMPERIAL MEMORIALS"
        description="百官具折，御前朱批。一事一奏，留存每一次圣裁。"
        actions={
          <>
            <span className="field-note">已收录 {state.memorials.length} / 200 份</span>
            <button className="button management-primary" disabled={state.memorials.length >= 200} onClick={() => openEditor()}>＋ 具折上奏</button>
          </>
        }
      >
        <div className="memorial-stats" aria-label="奏折统计">
          {(['pending', 'approved', 'returned'] as const).map(key => (
            <button key={key} className="management-card" aria-pressed={status === key} onClick={() => setStatus(key)}>
              <span>{MEMORIAL_STATUSES[key]}</span>
              <strong>{counts[key]}</strong>
              <small>{key === 'pending' ? '御前待阅' : key === 'approved' ? '已准照办' : '修订后再奏'}</small>
            </button>
          ))}
        </div>
        <div className="management-toolbar memorial-toolbar">
          <div className="management-tabs" aria-label="奏折状态">
            <button aria-pressed={status === 'all'} onClick={() => setStatus('all')}>全部</button>
            {Object.entries(MEMORIAL_STATUSES).map(([key, label]) => (
              <button key={key} aria-pressed={status === key} onClick={() => setStatus(key as MemorialStatus)}>{label} {counts[key]}</button>
            ))}
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="management-select" aria-label="筛选奏折类别">
            <option value="all">所有类别</option>
            {MEMORIAL_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={query} onChange={e => setQuery(e.target.value)} className="text-input" aria-label="搜索奏折" placeholder="搜索题名、具折人、正文或朱批…" />
        </div>
        {removed && (
          <div className="management-restore" role="status">
            已移出草稿《{removed.title}》
            <button className="text-button" disabled={state.memorials.length >= 200} onClick={restoreDraft}>恢复草稿</button>
          </div>
        )}
        {!filtered.length ? (
          <div className="management-card management-empty">
            <p>{state.memorials.length ? '当前筛选没有匹配的奏折。' : '御前尚无奏折。从官册选一位具折人，奏陈第一件朝政。'}</p>
            {state.memorials.length
              ? <button className="text-button" onClick={() => { setStatus('all'); setCategory('all'); setQuery('') }}>查看全部奏折</button>
              : <button className="button management-secondary empty-compose" onClick={() => openEditor()}>具第一份奏折</button>}
          </div>
        ) : (
          <div className="memorial-workspace">
            <section className="management-card memorial-list" aria-label="奏折簿">
              <div className="register-heading"><h2>奏折簿</h2><span>{filtered.length} 份 · 急奏优先</span></div>
              {filtered.map(m => (
                <button key={m.id} className="memorial-entry" aria-pressed={selected?.id === m.id} onClick={() => setSelectedId(m.id)}>
                  <span className="entry-meta"><span>{m.category}{m.urgent && <b>急奏</b>}</span><span>{MEMORIAL_STATUSES[m.status]}</span></span>
                  <strong>{m.title}</strong><span className="entry-author">{m.office} {m.author}</span><small>{formatDate(m.updatedAt)} · {m.revision ? `第 ${m.revision} 次上奏` : '尚未上奏'}</small>
                </button>
              ))}
            </section>
            {selected && (
              <article className="management-card memorial-detail" aria-label={`${selected.title}详情`}>
                <header className="memorial-heading">
                  <div>
                    <span className="eyebrow">MEMORIAL · {selected.category}</span>
                    <h2>{selected.title}</h2>
                    <p>{selected.office} {selected.author} 谨奏</p>
                  </div>
                  <span className={['management-badge', selected.urgent && 'urgent'].filter(Boolean).join(' ')}>{selected.urgent ? '急奏 · ' : ''}{MEMORIAL_STATUSES[selected.status]}</span>
                </header>
                <p className="memorial-body">{selected.content}</p>
                <div className="memorial-dates">
                  <span>具折 {formatDate(selected.createdAt)}</span>
                  {selected.submittedAt && <span>上奏 {formatDate(selected.submittedAt)} · 第 {selected.revision} 次</span>}
                </div>
                {canEditMemorial(selected) && (
                  <div className="memorial-actions">
                    <button className="button management-secondary" onClick={() => openEditor(selected)}>{selected.status === 'returned' ? '修订奏折' : '编辑草稿'}</button>
                    <button className="button management-primary" onClick={sendSelected}>{selected.status === 'returned' ? '再次上奏' : '上奏御前'}</button>
                    {selected.status === 'draft' && <button className="text-button remove-draft" onClick={removeDraft}>移出草稿</button>}
                  </div>
                )}
                {selected.status === 'pending' && (
                  <section className="review-panel" aria-label="御前批阅">
                    <span className="eyebrow">THE VERMILION RESCRIPT</span>
                    <h3>御前朱批</h3>
                    <form onSubmit={e => { e.preventDefault(); review('approved') }}>
                      <label htmlFor="review-comment">批复意见 <span>{comment.length} / 400</span></label>
                      <textarea id="review-comment" value={comment} onChange={e => setComment(e.target.value)} className="text-input" maxLength={400} placeholder="写下圣裁、办理要求或发回修改的缘由…" required />
                      <div className="review-shortcuts">
                        <span>常用朱批</span>
                        <button type="button" className="text-button" onClick={() => setComment('准奏。着依所奏办理，事毕具折回报。')}>依奏办理</button>
                        <button type="button" className="text-button" onClick={() => setComment('所奏尚欠详实，着补明缘由与用度后再奏。')}>补明再奏</button>
                      </div>
                      {reviewError && <p className="overflow-warning" role="alert">{reviewError}</p>}
                      <div className="memorial-actions">
                        <button className="button approval-button" type="submit">朱批准奏</button>
                        <button className="button management-secondary" type="button" onClick={() => review('rejected')}>驳回所奏</button>
                        <button className="button management-secondary" type="button" onClick={() => review('returned')}>发回修改</button>
                      </div>
                    </form>
                    <p className="field-note">朱批记录圣裁。涉及库藏或任命时，请前往对应页面办理。</p>
                  </section>
                )}
                {selected.reviews.length > 0 && (
                  <section className="review-history" aria-label="批阅记录">
                    <div className="register-heading"><h3>朱批留档</h3><span>最近 20 次批阅</span></div>
                    <ol>
                      {[...selected.reviews].reverse().map(r => (
                        <li key={r.id}>
                          <div className="review-meta">
                            <strong>{REVIEW_DECISIONS[r.decision]}</strong>
                            <span>第 {r.revision} 次上奏 · {r.reviewer} · {formatDate(r.at)}</span>
                          </div>
                          <p>{r.comment}</p>
                        </li>
                      ))}
                    </ol>
                    {selected.status !== 'pending' && (
                      <button className="text-button" onClick={() => onEdict(selected)}>
                        <StudioIcon name="stamp" size={15} />
                        将本次批复送入工坊拟旨 ↗
                      </button>
                    )}
                  </section>
                )}
              </article>
            )}
          </div>
        )}
      </EmpirePage>
      <dialog
        ref={editorRef}
        className="help-dialog management-dialog memorial-editor"
        aria-labelledby="memorial-editor-title"
        onClick={e => { if (e.target === editorRef.current) editorRef.current?.close() }}
      >
        <button className="icon-button dialog-close" aria-label="关闭奏折编辑" onClick={() => editorRef.current?.close()}>
          <StudioIcon name="close" />
        </button>
        <span className="eyebrow">A PETITION TO THE THRONE</span>
        <h2 id="memorial-editor-title">{editingId ? '修订奏折' : '具折上奏'}</h2>
        <form className="management-form" onSubmit={e => { e.preventDefault(); saveForm(true) }}>
          {!editingId && (
            <label>
              起草题笺
              <select className="management-select" aria-label="选择奏折题笺" onChange={e => applyTemplate(e.target.value)}>
                <option value="">自由具折</option>
                <option value="relief">赈济灾民</option>
                <option value="defense">边防修缮</option>
                <option value="talent">荐贤任官</option>
              </select>
            </label>
          )}
          <label>
            奏折题名
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="text-input" maxLength={24} required placeholder="一事一奏，简明题名" />
          </label>
          <label>
            从文武官册选取
            <select value={officerId} className="management-select" onChange={e => { setOfficerId(e.target.value); chooseOfficer(e.target.value) }}>
              <option value="">手填具折人</option>
              {state.officers.map(o => <option key={o.id} value={o.id}>{o.name} · {state.rankTitles[o.rank][o.role]}</option>)}
            </select>
          </label>
          <div className="management-form-row">
            <label>具折人<input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className="text-input" maxLength={12} required /></label>
            <label>职名<input value={form.office} onChange={e => setForm({ ...form, office: e.target.value })} className="text-input" maxLength={24} /></label>
          </div>
          <div className="management-form-row">
            <label>
              奏折类别
              <select value={form.category} className="management-select" onChange={e => setForm({ ...form, category: e.target.value as MemorialInput['category'] })}>
                {MEMORIAL_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="urgency-control">
              <input checked={form.urgent} onChange={e => setForm({ ...form, urgent: e.target.checked })} type="checkbox" /> 急奏 · 御前优先阅览
            </label>
          </div>
          <label>
            奏折正文 · {form.content.length} / 1200
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="text-input" maxLength={1200} required placeholder="臣谨奏：…" />
          </label>
          {error && <p className="overflow-warning" role="alert">{error}</p>}
          <p className="field-note">具折人和职名随奏折留档。上奏后待圣裁；发回后可修订再奏。</p>
          <div className="management-form-actions">
            <button className="button management-secondary" type="button" onClick={() => saveForm(false)}>保存草稿</button>
            <button className="button management-primary" type="submit">上奏御前</button>
          </div>
        </form>
      </dialog>
    </>
  )
}
