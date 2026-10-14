import { useEffect, useState } from 'react'
import { EmpirePage } from '../components/EmpirePage'
import { PALACE_PLAN, PALACE_ZONES, type PalaceZone } from '../core/empire'
import type { PageKey } from '../core/navigation'
import type { StudioApi } from '../state/useStudio'
import './PalaceMapPage.css'

export interface PalaceMapPageProps {
  studio: StudioApi
  onNotice: (message: string) => void
  onNavigate: (page: PageKey) => void
}

export function PalaceMapPage({ studio, onNotice, onNavigate }: PalaceMapPageProps) {
  const { state } = studio
  const [selectedId, setSelectedId] = useState('taihe')
  const [zone, setZone] = useState<PalaceZone | 'all'>('all')
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState('')
  const selected = state.halls.find(h => h.id === selectedId)!
  const selectedPlan = PALACE_PLAN.find(h => h.id === selectedId)!
  const halls = PALACE_PLAN.map(plan => ({ ...plan, ...state.halls.find(h => h.id === plan.id)! }))
  const visibleHalls = halls.filter(h => zone === 'all' || h.zone === zone)

  function hallLines(value: string) {
    const chars = Array.from(value)
    return chars.length > 6 ? [chars.slice(0, 6).join(''), chars.slice(6).join('')] : [value]
  }

  useEffect(() => {
    const hall = state.halls.find(h => h.id === selectedId)!
    setName(hall.name)
    setPurpose(hall.purpose)
    setError('')
  }, [selectedId, state.halls])

  function select(id: string) {
    setSelectedId(id)
  }

  function filter(value: PalaceZone | 'all') {
    setZone(value)
    if (value !== 'all' && selectedPlan.zone !== value) setSelectedId(PALACE_PLAN.find(h => h.zone === value)!.id)
  }

  function submit() {
    const nextName = name.trim(), nextPurpose = purpose.trim()
    if (!nextName || Array.from(nextName).length > 12 || Array.from(nextPurpose).length > 160) {
      setError('殿名不能为空，最多 12 字；用途最多 160 字。')
      return
    }
    studio.set({ halls: state.halls.map(h => h.id === selectedId ? { ...h, name: nextName, purpose: nextPurpose } : h) })
    setError('')
    onNotice('宫殿图已更新')
  }

  return (
    <EmpirePage
      title="宫殿地图"
      eyebrow="THE IMPERIAL PALACE"
      description="中轴贯南北，宫阙列东西。点击一座宫殿，查看与题写殿名。"
      actions={<span className="map-summary">{halls.length} 处宫阙 · 北上南下</span>}
    >
      <div className="management-toolbar">
        <div className="management-tabs" aria-label="宫殿分区">
          <button aria-pressed={zone === 'all'} onClick={() => filter('all')}>全宫</button>
          {Object.entries(PALACE_ZONES).map(([key, label]) => (
            <button key={key} aria-pressed={zone === key} onClick={() => filter(key as PalaceZone)}>{label}</button>
          ))}
        </div>
        <span className="management-summary">外朝议政 · 内廷起居 · 宫务收储 · 苑囿游赏</span>
      </div>
      <div className="palace-layout">
        <section className="management-card map-panel" aria-label="宫殿平面图">
          <svg className="palace-map" viewBox="0 0 1000 900" role="group" aria-label="宫城建筑位置图">
            <defs>
              <pattern id="map-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M25 0H0V25" className="map-grid-line" fill="none" />
              </pattern>
            </defs>
            <rect x="30" y="25" width="940" height="845" rx="2" className="map-ground" />
            <rect x="30" y="25" width="940" height="845" fill="url(#map-grid)" />
            <rect x="60" y="45" width="880" height="810" rx="2" className="palace-wall" />
            <rect x="80" y="125" width="840" height="255" className="inner-court" />
            <path d="M500 120V840M100 380H900M100 770H900" className="palace-axis" />
            <path d="M145 245H855M145 360H855M145 490H855M145 625H855M145 755H855" className="palace-path" />
            <text x="92" y="100" className="map-direction">北 ↑</text>
            <text x="920" y="842" textAnchor="end" className="map-direction">南 · 入朝</text>
            <text x="895" y="360" textAnchor="end" className="zone-label">内廷</text>
            <text x="895" y="760" textAnchor="end" className="zone-label">外朝</text>
            <g aria-hidden="true" className="garden-trees">
              {[330, 370, 630, 670].map(x => <circle key={x} cx={x} cy={85} r={18} />)}
            </g>
            {halls.map(hall => (
              <g
                key={hall.id}
                className={['map-hall', hall.id === selectedId && 'selected', zone !== 'all' && hall.zone !== zone && 'dimmed', hall.zone === 'garden' && 'garden'].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                aria-label={`${hall.name}，${PALACE_ZONES[hall.zone]}`}
                aria-pressed={hall.id === selectedId}
                transform={`translate(${hall.x}, ${hall.y})`}
                onClick={() => select(hall.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(hall.id)
                  }
                }}
              >
                <rect x="-80" y="-34" width="160" height="75" rx="2" className="hall-courtyard" />
                <path d="M-77-21-57-40H57L77-21Z" className="hall-roof" />
                <path d="M-70-21H70M-52-32H52" className="roof-lines" />
                <rect x="-62" y="-15" width="124" height="42" className="hall-body" />
                <path d="M-70 30H70M-60 35H60" className="hall-steps" />
                <text textAnchor="middle" fontSize={hallLines(hall.name).length > 1 ? 12 : 16}>
                  {hallLines(hall.name).map((line, i) => (
                    <tspan key={i} x="0" y={hallLines(hall.name).length > 1 ? i * 16 : 11}>{line}</tspan>
                  ))}
                </text>
              </g>
            ))}
          </svg>
          <p className="map-footnote">宫城示意 · 沿中轴自午门入朝，至御花园游赏</p>
        </section>
        <aside className="hall-sidebar">
          <section className="management-card hall-details" aria-label={`${selected.name}详情`}>
            <span className="management-badge">{PALACE_ZONES[selectedPlan.zone]}</span>
            <h2>{selected.name}</h2>
            <p>{selected.purpose || '用途待定'}</p>
            <form className="management-form" onSubmit={e => { e.preventDefault(); submit() }}>
              <label>宫殿名称<input value={name} onChange={e => setName(e.target.value)} className="text-input" maxLength={12} required /></label>
              <label>宫殿用途<textarea value={purpose} onChange={e => setPurpose(e.target.value)} className="text-input" maxLength={160} /></label>
              {error && <p className="overflow-warning" role="alert">{error}</p>}
              <button className="button management-secondary" type="submit">保存殿名与用途</button>
            </form>
            {['treasury', 'royal-vault'].includes(selected.id) && (
              <button className="text-button hall-link" onClick={() => onNavigate('treasury')}>查看国库与皇室宝库 ↗</button>
            )}
            {selected.id === 'wuying' || selected.id === 'wenyuan' ? (
              <button className="text-button hall-link" onClick={() => onNavigate('officials')}>查看文武百官 ↗</button>
            ) : null}
            {selected.id === 'qinzheng' || selected.id === 'qianqing' ? (
              <button className="text-button hall-link" onClick={() => onNavigate('memorials')}>移驾御前批阅奏折 ↗</button>
            ) : null}
            {selectedPlan.zone === 'residence' && (
              <button className="text-button hall-link" onClick={() => onNavigate('emperor')}>移驾赛博皇帝 ↗</button>
            )}
          </section>
          <section className="management-card hall-directory">
            <h3>宫阙名录</h3>
            {visibleHalls.map(hall => (
              <button key={hall.id} aria-pressed={selectedId === hall.id} onClick={() => select(hall.id)}>
                <span>{hall.name}</span>
                <small>{PALACE_ZONES[hall.zone]}</small>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </EmpirePage>
  )
}
