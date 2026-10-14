import { useRef, useState, type CSSProperties } from 'react'
import { EmpirePage } from '../components/EmpirePage'
import { StudioIcon } from '../components/StudioIcon'
import { RANKS, rankByKey, rankColor } from '../core/empire'
import type { Officer, OfficialRole } from '../core/empire'
import type { StudioApi } from '../state/useStudio'
import { Badge, Button, Card, Dialog, type DialogHandle, Dot, Empty, Form, FormActions, FormRow, Input, Label, Note, RestoreBar, Select, Summary, Tabs, Textarea, Warning } from '../components/ui'

export interface OfficialsPageProps {
  studio: StudioApi
  onNotice: (message: string) => void
  onEdict: (officer: Officer) => void
}

const TABLE_TH = 'font-normal text-(--muted) px-4 py-[13px] border-b border-(--line) whitespace-nowrap'
const TABLE_TD = 'px-4 py-[13px] border-b border-(--line)'
const COLOR_INPUT = 'w-full h-[46px] p-[4px] border border-(--line) rounded-sm bg-transparent cursor-pointer'

export function OfficialsPage({ studio, onNotice, onEdict }: OfficialsPageProps) {
  const state = studio.state
  const [view, setView] = useState<'ranks' | 'roster'>('ranks')
  const [roleFilter, setRoleFilter] = useState('all')
  const [rankFilter, setRankFilter] = useState('all')
  const [query, setQuery] = useState('')
  const editor = useRef<DialogHandle | null>(null)
  const titleEditor = useRef<DialogHandle | null>(null)
  const colorEditor = useRef<DialogHandle | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRank, setEditingRank] = useState('1-zheng')
  const [editingColorRank, setEditingColorRank] = useState('1-zheng')
  const [colorForm, setColorForm] = useState('#6d28d9')
  const [form, setForm] = useState<{ name: string; role: OfficialRole; rank: string; duty: string }>({ name: '', role: 'civil', rank: '9-zheng', duty: '' })
  const [titleForm, setTitleForm] = useState({ civil: '', military: '' })
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [removed, setRemoved] = useState<{ officer: Officer; index: number } | null>(null)
  const roleLabel = (role: OfficialRole) => role === 'civil' ? '文官' : '武官'
  const title = (o: Pick<Officer, 'rank' | 'role'>) => state.rankTitles[o.rank][o.role]
  const civilCount = state.officers.filter(o => o.role === 'civil').length
  const militaryCount = state.officers.filter(o => o.role === 'military').length
  const filtered = state.officers.filter(o => (roleFilter === 'all' || o.role === roleFilter) && (rankFilter === 'all' || o.rank === rankFilter) && `${o.name} ${o.duty} ${title(o)} ${rankByKey(o.rank).label}`.includes(query.trim())).sort((a, b) => rankByKey(a.rank).order - rankByKey(b.rank).order || a.role.localeCompare(b.role) || a.name.localeCompare(b.name, 'zh-CN'))
  const rankCount = (key: string, role: OfficialRole) => state.officers.filter(o => o.rank === key && o.role === role).length
  function edit(officer?: Officer) {
    setEditingId(officer?.id ?? null)
    setForm({ name: officer?.name ?? '', role: officer?.role ?? 'civil', rank: officer?.rank ?? '9-zheng', duty: officer?.duty ?? '' })
    setError('')
    editor.current?.showModal()
  }
  function submit() {
    const data = { ...form, name: form.name.trim(), duty: form.duty.trim() }
    if (!data.name || Array.from(data.name).length > 12 || Array.from(data.duty).length > 160 || !RANKS.some(r => r.key === data.rank) || !['civil', 'military'].includes(data.role)) { setError('请填写姓名，并选择文武类别和品级。'); return }
    const existing = state.officers.find(o => o.id === editingId)
    if (editingId && !existing) { setError('这位官员已移出官册。'); return }
    if (existing) studio.set({ officers: state.officers.map(o => o.id === editingId ? { ...o, ...data } : o) })
    else {
      if (state.officers.length >= 200) { setError('官册最多收录 200 人。'); return }
      studio.set({ officers: [...state.officers, { id: crypto.randomUUID(), ...data }] })
    }
    editor.current?.close()
    onNotice('官册已更新')
  }
  function remove() {
    const index = state.officers.findIndex(o => o.id === editingId)
    if (index < 0) return
    setRemoved({ officer: { ...state.officers[index] }, index })
    studio.set({ officers: state.officers.filter(o => o.id !== editingId) })
    editor.current?.close()
  }
  function restore() {
    if (!removed || state.officers.length >= 200) return
    studio.set({ officers: [...state.officers.slice(0, removed.index), removed.officer, ...state.officers.slice(removed.index)] })
    setRemoved(null)
  }
  function editTitles(key: string) {
    if (key === 'unranked') return
    setEditingRank(key)
    setTitleForm({ ...state.rankTitles[key] })
    setTitleError('')
    titleEditor.current?.showModal()
  }
  function submitTitles() {
    const civil = titleForm.civil.trim(), military = titleForm.military.trim()
    if (!civil || !military || Array.from(civil).length > 24 || Array.from(military).length > 24) { setTitleError('文官和武官职名均须填写，最多 24 字。'); return }
    if (civil === military) { setTitleError('文官与武官请设置不同的职名。'); return }
    studio.set({ rankTitles: { ...state.rankTitles, [editingRank]: { civil, military } } })
    titleEditor.current?.close()
    onNotice('文武职名已更新')
  }
  function editColor(key: string) {
    setEditingColorRank(key)
    setColorForm(rankColor(state.rankColors, key))
    colorEditor.current?.showModal()
  }
  function submitColor() {
    studio.set({ rankColors: { ...state.rankColors, [editingColorRank]: colorForm } })
    colorEditor.current?.close()
    onNotice(`已更新${rankByKey(editingColorRank).label}品色`)
  }
  function showRank(key: string, role: OfficialRole) {
    setRankFilter(key)
    setRoleFilter(role)
    setQuery('')
    setView('roster')
  }
  return (
    <>
      <EmpirePage title="文武百官" eyebrow="THE IMPERIAL COURT" description="文以治国，武以安邦。共用十九档品级，各有文武职名。" actions={<><span className="text-[12px] text-(--muted) whitespace-nowrap">文官 {civilCount} · 武官 {militaryCount}</span><Button variant="primary" disabled={state.officers.length >= 200} onClick={() => edit()}>＋ 录入官员</Button></>}>
        <Tabs className="mb-6" items={[{ key: 'ranks', label: '品级官制' }, { key: 'roster', label: '文武官册' }]} value={view} onChange={key => setView(key as 'ranks' | 'roster')} />
        {view === 'ranks'
          ? <Card aria-label="十九品级官制" className="[&_td]:py-[14px]">
            <div className="flex items-baseline gap-5 flex-wrap mb-[14px]">
              <h2 className="font-serif text-[18px] tracking-[2px] m-0">九品十八阶，另设不入流</h2>
              <p className="text-[11px] text-(--muted) leading-[1.9] m-0">正一品最高；同一品内，正品高于从品。文官与武官品级相同，职名分别设置。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-[560px]">
                <thead><tr><th className={TABLE_TH}>品级</th><th className={TABLE_TH}>文官职名</th><th className={TABLE_TH}>武官职名</th><th className={TABLE_TH}>职名设置</th></tr></thead>
                <tbody>{RANKS.map(rank => <tr key={rank.key} className="last:[&_td]:border-b-0">
                  <td className={`${TABLE_TD} font-serif text-(--accent) whitespace-nowrap`}>
                    <span className="text-[9px] text-(--muted) mr-4">{String(rank.order + 1).padStart(2, '0')}</span>
                    <button
                      className="inline-grid place-items-center size-[22px] mr-[10px] p-0 align-middle bg-transparent border border-[color-mix(in_srgb,var(--rank-color,var(--muted))_45%,transparent)] rounded-full cursor-pointer transition-transform hover:scale-[1.18] hover:border-(--rank-color)"
                      style={{ '--rank-color': rankColor(state.rankColors, rank.key) } as CSSProperties}
                      aria-label={`设置${rank.label}品色`}
                      title={`设置${rank.label}品色`}
                      onClick={() => editColor(rank.key)}
                    ><Dot className="size-[10px]" color="var(--rank-color)" /></button>
                    {rank.label}
                  </td>
                  <td className={TABLE_TD}><span>{state.rankTitles[rank.key].civil}</span>{rankCount(rank.key, 'civil') > 0 && <button className="bg-transparent border-0 text-(--accent) ml-[18px] p-0 text-[10px]" aria-label={`查看${rank.label}文官`} onClick={() => showRank(rank.key, 'civil')}>{rankCount(rank.key, 'civil')} 人 ↗</button>}</td>
                  <td className={TABLE_TD}><span>{state.rankTitles[rank.key].military}</span>{rankCount(rank.key, 'military') > 0 && <button className="bg-transparent border-0 text-(--accent) ml-[18px] p-0 text-[10px]" aria-label={`查看${rank.label}武官`} onClick={() => showRank(rank.key, 'military')}>{rankCount(rank.key, 'military')} 人 ↗</button>}</td>
                  <td className={TABLE_TD}>{rank.key !== 'unranked' ? <Button variant="text" aria-label={`设置${rank.label}职名`} onClick={() => editTitles(rank.key)}>设置职名</Button> : <Note>不入流小官</Note>}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </Card>
          : <section aria-label="文武官册">
            <div className="flex items-center gap-3 flex-wrap mb-[22px]">
              <Tabs items={[{ key: 'all', label: '文武总览' }, { key: 'civil', label: '文官' }, { key: 'military', label: '武官' }]} value={roleFilter} onChange={setRoleFilter} />
              <Select value={rankFilter} onChange={e => setRankFilter(e.target.value)} aria-label="筛选官员品级"><option value="all">所有品级</option>{RANKS.map(rank => <option key={rank.key} value={rank.key}>{rank.label}</option>)}</Select>
              <Input value={query} onChange={e => setQuery(e.target.value)} className="w-[230px] max-[700px]:w-full" aria-label="搜索官员" placeholder="搜索姓名、职名、职掌…" />
              <Summary>{filtered.length} 人</Summary>
            </div>
            {removed && <RestoreBar>已移出 {removed.officer.name}<Button variant="text" disabled={state.officers.length >= 200} onClick={restore}>恢复入册</Button></RestoreBar>}
            {filtered.length === 0
              ? <Empty>{state.officers.length ? '当前筛选没有匹配的官员。' : '朝堂待贤，录入第一位官员。'}</Empty>
              : <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[850px]:grid-cols-3 min-[1100px]:grid-cols-4">{filtered.map(officer => (
                <Card key={officer.id} color={rankColor(state.rankColors, officer.rank)}>
                  <div className="flex items-center justify-between gap-[10px]">
                    <Badge dot={rankColor(state.rankColors, officer.rank)}>{roleLabel(officer.role)} · {rankByKey(officer.rank).label}</Badge>
                    <Button variant="text" aria-label={`编辑官员${officer.name}`} onClick={() => edit(officer)}>编辑</Button>
                  </div>
                  <span className="block text-(--accent) font-serif text-[13px] tracking-[2px] mt-6 break-anywhere">{title(officer)}</span>
                  <h2 className="font-serif text-[25px] tracking-[4px] m-[12px_0] break-anywhere">{officer.name}</h2>
                  <p className="text-[11px] text-(--muted) leading-[1.9] min-h-[42px] break-anywhere">{officer.duty || '职掌待定'}</p>
                  <Button variant="text" className="mt-[15px]" aria-label={`为${officer.name}拟任命旨`} onClick={() => onEdict(officer)}><StudioIcon name="stamp" size={14} />拟任命旨 ↗</Button>
                </Card>
              ))}</div>}
          </section>}
      </EmpirePage>
      <Dialog ref={editor} wide eyebrow="COURT REGISTER" title={editingId ? '编辑官员' : '录入官员'} closeLabel="关闭官员编辑">
        <Form onSubmit={e => { e.preventDefault(); submit() }}>
          <Label>官员姓名<Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} sizeMd maxLength={12} required /></Label>
          <FormRow>
            <Label>文武类别<Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as OfficialRole })}><option value="civil">文官</option><option value="military">武官</option></Select></Label>
            <Label>官员品级<Select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}>{RANKS.map(rank => <option key={rank.key} value={rank.key}>{rank.label}</option>)}</Select></Label>
          </FormRow>
          <Note>职名：{title(form)} · {rankByKey(form.rank).label}</Note>
          <Label>职掌<Textarea value={form.duty} onChange={e => setForm({ ...form, duty: e.target.value })} maxLength={160} placeholder="写下职责与任职说明…" /></Label>
          {error && <Warning>{error}</Warning>}
          <FormActions>
            {editingId && <Button variant="text" className="mr-auto" type="button" onClick={remove}>移出官册</Button>}
            <Button variant="primary" type="submit">保存官员</Button>
          </FormActions>
        </Form>
      </Dialog>
      <Dialog ref={titleEditor} eyebrow="RANK TITLES" title={`${rankByKey(editingRank).label} · 文武职名`} closeLabel="关闭职名设置">
        <Form onSubmit={e => { e.preventDefault(); submitTitles() }}>
          <Label>文官职名<Input value={titleForm.civil} onChange={e => setTitleForm({ ...titleForm, civil: e.target.value })} sizeMd maxLength={24} required /></Label>
          <Label>武官职名<Input value={titleForm.military} onChange={e => setTitleForm({ ...titleForm, military: e.target.value })} sizeMd maxLength={24} required /></Label>
          <Note>职名修改会同步至该品级官员，品级顺序固定。</Note>
          {titleError && <Warning>{titleError}</Warning>}
          <FormActions><Button variant="primary" type="submit">保存职名</Button></FormActions>
        </Form>
      </Dialog>
      <Dialog ref={colorEditor} eyebrow="RANK COLORS" title={`${rankByKey(editingColorRank).label} · 品色`} closeLabel="关闭品色设置">
        <Form onSubmit={e => { e.preventDefault(); submitColor() }}>
          <Label>品阶颜色<input type="color" value={colorForm} onChange={e => setColorForm(e.target.value)} className={COLOR_INPUT} aria-label="品阶颜色" /></Label>
          <p className="flex items-center gap-[10px] m-0 text-[11px] text-(--muted) tracking-[1px]"><Dot color={colorForm} />{colorForm.toUpperCase()} · {rankByKey(editingColorRank).label}</p>
          <Note>品色依唐宋品色衣而定：三品以上紫、四五品绯、六七品绿、八九品青，不入流为灰；同品正品深、从品浅。每个品阶可独立换色。</Note>
          <FormActions>
            <Button variant="text" className="mr-auto" type="button" onClick={() => setColorForm(rankByKey(editingColorRank).color)}>恢复默认色</Button>
            <Button variant="primary" type="submit">保存品色</Button>
          </FormActions>
        </Form>
      </Dialog>
    </>
  )
}
