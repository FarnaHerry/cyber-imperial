import { useRef, useState } from 'react'
import { EmpirePage } from '../components/EmpirePage'
import { TREASURE_KINDS, stockBalance, treasureColor, warehouseOf, DEFAULT_TREASURE_COLORS, type StockRecord, type Treasure, type TreasureKind } from '../core/empire'
import type { StudioApi } from '../state/useStudio'
import { Badge, Button, Card, cx, Dialog, type DialogHandle, Dot, Empty, Eyebrow, Form, FormActions, FormRow, Input, Label, Note, Select, Summary, Textarea, Warning } from '../components/ui'

export interface TreasuryPageProps {
  studio: StudioApi
  onNotice: (message: string) => void
}

const TABLE_TH = 'font-normal text-(--muted) px-4 py-[13px] border-b border-(--line) whitespace-nowrap'
const TABLE_TD = 'px-4 py-[13px] border-b border-(--line)'
const ROYAL_VAULT = 'border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--accent)_4%,var(--panel)),var(--panel))]'

const format = (n: number) => n.toLocaleString('zh-CN')
const date = (at: string) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(at))
const makeRecord = (item: Treasure, delta: number, note: string): StockRecord => ({ id: crypto.randomUUID(), name: item.name, kind: item.kind, delta, unit: item.unit, at: new Date().toISOString(), reason: note })
const toNumber = (value: string) => value === '' ? Number.NaN : Number(value)
const pushRecord = (records: StockRecord[], item: Treasure, delta: number, note: string) => delta ? [makeRecord(item, delta, note), ...records].slice(0, 50) : records

export function TreasuryPage({ studio, onNotice }: TreasuryPageProps) {
  const state = studio.state
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const editor = useRef<DialogHandle | null>(null)
  const stockDialog = useRef<DialogHandle | null>(null)
  const colorsDialog = useRef<DialogHandle | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockId, setStockId] = useState('')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [form, setForm] = useState({ name: '', kind: '器物' as TreasureKind, quantity: 1, unit: '件', note: '' })
  const [error, setError] = useState('')
  const [stockError, setStockError] = useState('')
  const [removed, setRemoved] = useState<{ item: Treasure; index: number } | null>(null)
  const selectedStock = state.treasures.find(t => t.id === stockId)
  const filtered = state.treasures.filter(t => (kindFilter === 'all' || t.kind === kindFilter) && `${t.name} ${t.note} ${t.kind}`.includes(query.trim()))
  const warehouses = ['国库', '皇室宝库'].map(name => ({ name, royal: name === '皇室宝库', items: filtered.filter(t => warehouseOf(t.kind) === name), total: state.treasures.filter(t => warehouseOf(t.kind) === name).length }))
  const totalKinds = state.treasures.length
  function edit(item?: Treasure) {
    setEditingId(item?.id ?? null)
    setForm({ name: item?.name ?? '', kind: item?.kind ?? '器物', quantity: item?.quantity ?? 1, unit: item?.unit ?? '件', note: item?.note ?? '' })
    setError('')
    editor.current?.showModal()
  }
  function submit() {
    const data = { ...form, name: form.name.trim(), unit: form.unit.trim(), note: form.note.trim() }
    if (!data.name || !data.unit || Array.from(data.name).length > 24 || Array.from(data.unit).length > 6 || Array.from(data.note).length > 160 || !TREASURE_KINDS.includes(data.kind) || stockBalance(data.quantity, 0) === null) { setError('请填写藏品名称、单位和 0～10 亿之间的整数数量。'); return }
    const treasures = studio.state.treasures
    const existing = treasures.find(t => t.id === editingId)
    if (editingId && !existing) { setError('这件藏品已移出，请关闭后重新选择。'); return }
    if (existing) {
      const updated: Treasure = { ...existing, ...data }
      let records = studio.state.stockRecords
      if (existing.kind !== data.kind || existing.unit !== data.unit) {
        records = pushRecord(records, existing, -existing.quantity, '编目调整：原库存转出')
        records = pushRecord(records, updated, updated.quantity, '编目调整：转入新归库或单位')
      } else records = pushRecord(records, updated, data.quantity - existing.quantity, '编目调整')
      studio.set({ treasures: treasures.map(t => t.id === existing.id ? updated : t), stockRecords: records })
    }
    else {
      if (treasures.length >= 200) { setError('两库合计最多收录 200 种藏品。'); return }
      const item: Treasure = { id: crypto.randomUUID(), ...data }
      studio.set({ treasures: [...treasures, item], stockRecords: pushRecord(studio.state.stockRecords, item, item.quantity, '初始入库') })
    }
    editor.current?.close(); onNotice(`已归入${warehouseOf(data.kind)}`)
  }
  function remove() {
    const treasures = studio.state.treasures
    const index = treasures.findIndex(t => t.id === editingId)
    if (index < 0) return
    const item = { ...treasures[index] }
    setRemoved({ item, index })
    studio.set({ treasures: [...treasures.slice(0, index), ...treasures.slice(index + 1)], stockRecords: pushRecord(studio.state.stockRecords, item, -item.quantity, '移出库藏') })
    editor.current?.close()
  }
  function restore() {
    if (!removed || studio.state.treasures.length >= 200) return
    const treasures = studio.state.treasures
    const item = removed.item
    studio.set({ treasures: [...treasures.slice(0, removed.index), item, ...treasures.slice(removed.index)], stockRecords: pushRecord(studio.state.stockRecords, item, item.quantity, '恢复库藏') })
    setRemoved(null)
  }
  function adjust(item: Treasure, mode: 1 | -1) { setStockId(item.id); setDirection(mode); setAmount(1); setReason(''); setStockError(''); stockDialog.current?.showModal() }
  function setKindColor(kind: TreasureKind, color: string) {
    studio.set({ treasureColors: { ...studio.state.treasureColors, [kind]: color } })
  }
  function submitStock() {
    const treasures = studio.state.treasures
    const item = treasures.find(t => t.id === stockId)
    const delta = amount * direction
    if (!item || !Number.isSafeInteger(amount) || amount <= 0 || stockBalance(item.quantity, delta) === null) { setStockError(direction < 0 ? '出库数量须为正整数，且不能超过现有库存。' : '入库数量须为正整数，库存上限为 10 亿。'); return }
    if (Array.from(reason).length > 80) { setStockError('事由最多 80 字。'); return }
    const updated: Treasure = { ...item, quantity: item.quantity + delta }
    studio.set({ treasures: treasures.map(t => t.id === item.id ? updated : t), stockRecords: pushRecord(studio.state.stockRecords, updated, delta, reason.trim() || (direction > 0 ? '入库' : '出库')) })
    stockDialog.current?.close(); onNotice(`${item.name}已${direction > 0 ? '入库' : '出库'}`)
  }
  return (
    <>
      <EmpirePage title="国库与皇室宝库" eyebrow="THE IMPERIAL TREASURIES" description="国用归国库，至宝入内藏。两库同页，各有所守。"
        actions={<><Button variant="default" onClick={() => colorsDialog.current?.showModal()}>类别颜色</Button><Button variant="primary" disabled={totalKinds >= 200} onClick={() => edit()}>＋ 收录藏品</Button></>}>
        <div className="flex items-center gap-3 flex-wrap mb-[22px]">
          <Input value={query} onChange={e => setQuery(e.target.value)} className="w-[230px] max-[700px]:w-full" aria-label="搜索藏品" placeholder="搜索藏品、备注…" />
          <Select value={kindFilter} onChange={e => setKindFilter(e.target.value)} aria-label="藏品类别"><option value="all">全部类别</option>{TREASURE_KINDS.map(kind => <option key={kind}>{kind}</option>)}</Select>
          <Summary>两库共 {totalKinds} 种藏品 · 至宝专藏皇室宝库</Summary>
        </div>
        {removed && <div role="status" className="flex items-center gap-[14px] mb-5 text-[12px] text-(--muted)">已移出 {removed.item.name}<Button variant="text" disabled={totalKinds >= 200} onClick={restore}>恢复入库</Button></div>}
        <div className="grid grid-cols-1 gap-6 items-start min-[1000px]:grid-cols-2">
          {warehouses.map(vault => (
            <section key={vault.name} aria-label={vault.name}>
              <Card className={vault.royal ? ROYAL_VAULT : undefined}>
                <div className="flex items-center gap-4">
                  <span className={cx('font-serif font-normal text-[27px] text-(--accent) border border-(--line) grid place-items-center size-[50px]', vault.royal && 'border-accent')} aria-hidden="true">{vault.royal ? '宝' : '库'}</span>
                  <div>
                    <Eyebrow>{vault.royal ? 'THE ROYAL VAULT' : 'THE NATIONAL TREASURY'}</Eyebrow>
                    <h2 className="font-serif font-normal text-[22px] tracking-[4px] mt-[7px] mb-0">{vault.name}</h2>
                  </div>
                  <span className="ml-auto text-[11px] text-(--muted)">{vault.total} 种</span>
                </div>
                <p className="text-(--muted) text-[11px] my-5 leading-[1.8]">{vault.royal ? '仅存至宝，珍藏皇家重器。' : '金银、粮秣、军备、器物与贡品悉数入库。'}</p>
                {!vault.items.length
                  ? <Empty>{vault.total ? '当前筛选没有匹配的藏品。' : '此库尚空，收录藏品后即可入藏。'}</Empty>
                  : <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                    {vault.items.map(item => (
                      <Card key={item.id} color={treasureColor(state.treasureColors, item.kind)} className="!p-[15px]">
                        <div className="flex justify-between items-center gap-[10px]">
                          <Badge dot={treasureColor(state.treasureColors, item.kind)}>{item.kind}</Badge>
                          <Button variant="text" aria-label={`编目${item.name}`} onClick={() => edit(item)}>编目</Button>
                        </div>
                        <h3 className="font-serif font-normal text-[17px] my-[15px_8px] break-anywhere">{item.name}</h3>
                        <p className="text-(--muted) text-[10px] leading-[1.8] min-h-[36px] m-[0_0_20px] break-anywhere">{item.note || '暂无备注'}</p>
                        <div className="flex flex-wrap justify-between items-center gap-[10px]">
                          <span className="text-[10px] text-(--muted)"><b className="font-serif font-normal text-[19px] text-(--text)">{format(item.quantity)}</b> {item.unit}</span>
                          <div className="flex gap-3">
                            <Button variant="text" aria-label={`为${item.name}入库`} onClick={() => adjust(item, 1)}>＋ 入库</Button>
                            <Button variant="text" aria-label={`为${item.name}出库`} disabled={!item.quantity} onClick={() => adjust(item, -1)}>－ 出库</Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>}
              </Card>
            </section>
          ))}
        </div>
        <Card className="mt-6">
          <div className="flex flex-wrap justify-between gap-[10px] items-center mb-3">
            <h2 className="font-serif font-normal text-[17px] tracking-[3px] m-0">出入库簿</h2>
            <Note>最近 50 笔 · 北京时间</Note>
          </div>
          {!state.stockRecords.length
            ? <Empty>尚无出入库记录。每次收支，都有据可查。</Empty>
            : <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse">
                <thead><tr><th className={TABLE_TH}>藏品</th><th className={TABLE_TH}>归库</th><th className={TABLE_TH}>收支</th><th className={TABLE_TH}>事由</th><th className={TABLE_TH}>时间</th></tr></thead>
                <tbody>{state.stockRecords.map(entry => (
                  <tr key={entry.id} className="last:[&_td]:border-b-0">
                    <td className={`${TABLE_TD} font-serif text-(--accent) whitespace-nowrap`}>{entry.name}</td>
                    <td className={TABLE_TD}>{warehouseOf(entry.kind)}</td>
                    <td className={`${TABLE_TD} whitespace-nowrap`}>{entry.delta > 0 ? '+' : ''}{format(entry.delta)} {entry.unit}</td>
                    <td className={TABLE_TD}>{entry.reason}</td>
                    <td className={TABLE_TD}><time className="whitespace-nowrap text-(--muted) text-[10px]" dateTime={entry.at}>{date(entry.at)}</time></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
        </Card>
      </EmpirePage>
      <Dialog ref={editor} wide eyebrow="TREASURY REGISTER" title={editingId ? '藏品编目' : '收录藏品'} closeLabel="关闭藏品编目">
        <Form onSubmit={e => { e.preventDefault(); submit() }}>
          <Label>藏品名称<Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} sizeMd maxLength={24} required /></Label>
          <Label>藏品类别<Select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as TreasureKind })}>{TREASURE_KINDS.map(kind => <option key={kind}>{kind}</option>)}</Select></Label>
          <Note>归属：{warehouseOf(form.kind)}。至宝自动存入皇室宝库。</Note>
          <FormRow>
            <Label>库存数量<Input value={form.quantity} onChange={e => setForm({ ...form, quantity: toNumber(e.target.value) })} sizeMd type="number" min={0} max={1000000000} step={1} required /></Label>
            <Label>计量单位<Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} sizeMd maxLength={6} required /></Label>
          </FormRow>
          <Label>藏品备注<Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={160} /></Label>
          {error && <Warning>{error}</Warning>}
          <FormActions>
            {editingId && <Button variant="text" className="mr-auto" type="button" onClick={remove}>移出库藏</Button>}
            <Button variant="primary" type="submit">保存藏品</Button>
          </FormActions>
        </Form>
      </Dialog>
      <Dialog ref={stockDialog} wide eyebrow="TREASURY ACCOUNT" title={`${direction > 0 ? '入库' : '出库'} · ${selectedStock?.name}`} closeLabel="关闭出入库登记">
        <p>现存 {format(selectedStock?.quantity ?? 0)} {selectedStock?.unit} · {selectedStock ? warehouseOf(selectedStock.kind) : ''}</p>
        <Form onSubmit={e => { e.preventDefault(); submitStock() }}>
          <Label>{direction > 0 ? '入库数量' : '出库数量'}<Input value={amount} onChange={e => setAmount(toNumber(e.target.value))} sizeMd type="number" min={1} max={1000000000} step={1} required /></Label>
          <Label>登记事由<Input value={reason} onChange={e => setReason(e.target.value)} sizeMd maxLength={80} placeholder="例如：岁贡入藏、军粮调拨" /></Label>
          {stockError && <Warning>{stockError}</Warning>}
          <FormActions><Button variant="primary" type="submit">确认{direction > 0 ? '入库' : '出库'}</Button></FormActions>
        </Form>
      </Dialog>
      <Dialog ref={colorsDialog} wide eyebrow="TREASURY COLORS" title="藏品类别颜色" closeLabel="关闭类别颜色">
        <div className="grid gap-[10px] my-[18px]">
          {TREASURE_KINDS.map(kind => (
            <div key={kind} className="flex items-center gap-3">
              <Dot color={treasureColor(state.treasureColors, kind)} />
              <span className="text-[12px] tracking-[2px]">{kind}</span>
              <input type="color" value={treasureColor(state.treasureColors, kind)} onChange={e => setKindColor(kind, e.target.value)} className="w-[52px] h-[30px] ml-auto" aria-label={`${kind}颜色`} />
              <Button variant="text" onClick={() => setKindColor(kind, DEFAULT_TREASURE_COLORS[kind])}>恢复默认</Button>
            </div>
          ))}
        </div>
        <Note>类别颜色会显示为库藏卡片的边框与徽记；修改即时生效并随草稿保存。</Note>
      </Dialog>
    </>
  )
}
