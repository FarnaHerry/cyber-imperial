import { useEffect, useRef, useState } from 'react'
import { AppLayout } from './layouts/AppLayout'
import { StudioPage, type StudioPageHandle } from './pages/StudioPage'
import { EmperorPage } from './pages/EmperorPage'
import { TreasuryPage } from './pages/TreasuryPage'
import { OfficialsPage } from './pages/OfficialsPage'
import { PalaceMapPage } from './pages/PalaceMapPage'
import { MemorialPage } from './pages/MemorialPage'
import { StudioIcon } from './components/StudioIcon'
import { useStudio } from './state/useStudio'
import { Button, Select } from './components/ui'
import { palaceEdict, royalEdict, type DrawRecord } from './core/palace'
import { rankByKey, type Officer } from './core/empire'
import { pageFromHash, type PageKey } from './core/navigation'
import { memorialEdict, type Memorial } from './core/memorial'

function Toast({ message }: { message: string }) {
  const [display, setDisplay] = useState(message)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (message) {
      setLeaving(false)
      setDisplay(message)
      return
    }
    if (!display) return
    setLeaving(true)
    const timer = window.setTimeout(() => { setDisplay(''); setLeaving(false) }, 200)
    return () => window.clearTimeout(timer)
  }, [message])
  if (!display) return null
  const cls = leaving ? 'toast-leave-active toast-leave-to' : 'toast-enter-active toast-enter-from'
  return (
    <div className={`toast-message ${cls}`} role="status">
      <StudioIcon name="check" size={16} />
      <span>{display}</span>
    </div>
  )
}

export function App() {
  const studio = useStudio()
  const { state, set } = studio
  const [page, setPage] = useState<PageKey>(() => pageFromHash(window.location.hash))
  const studioPage = useRef<StudioPageHandle | null>(null)
  const [exportScale, setExportScale] = useState<2 | 4>(2)
  const [exporting, setExporting] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(0)

  function notify(message: string) {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2800)
  }
  function navigate(target: PageKey) { window.location.hash = target }
  function onPageChange() { setPage(pageFromHash(window.location.hash)) }
  function fromPalace(record: DrawRecord) {
    set({ subject: record.name, text: palaceEdict(record, state.kingdom, state.emperor) })
    studioPage.current?.resetTemplate()
    navigate('studio')
    notify(`已为${record.name}拟旨，原有印痕保留`)
  }
  function fromOfficer(officer: Officer) {
    set({ subject: officer.name })
    const title = state.rankTitles[officer.rank][officer.role]
    set({
      text: royalEdict(`奉天承运，赛博皇帝诏曰：今有${officer.name}，${officer.role === 'civil' ? '学识笃厚，勤于政事' : '忠勇果毅，善守山河'}。兹${officer.rank === 'unranked' ? '录为不入流小官' : `授${rankByKey(officer.rank).label}品级，任${title}之职`}。${officer.duty ? `命其${officer.duty}。` : ''}\n\n望卿恪尽职守，不负所托。钦此。`, state.kingdom, state.emperor),
    })
    studioPage.current?.resetTemplate()
    navigate('studio')
    notify(`已为${officer.name}拟任命旨`)
  }
  function fromMemorial(memorial: Memorial) {
    const text = memorialEdict(memorial)
    if (!text) return
    set({ subject: memorial.author, text: royalEdict(text, state.kingdom, state.emperor) })
    studioPage.current?.resetTemplate()
    navigate('studio')
    notify('已将奏折批复送入工坊，原有印痕保留')
  }

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])
  useEffect(() => {
    window.addEventListener('hashchange', onPageChange)
    if (studio.restored) notify('已恢复上次的作品，继续落笔吧')
    return () => {
      window.removeEventListener('hashchange', onPageChange)
      window.clearTimeout(toastTimer.current)
    }
  }, [])

  return (
    <AppLayout
      page={page}
      theme={state.theme}
      onToggleTheme={() => set({ theme: state.theme === 'dark' ? 'light' : 'dark' })}
      actions={page === 'studio' ? (
        <div className="flex items-center gap-2">
          <Select value={exportScale} onChange={e => setExportScale(Number(e.target.value) as 2 | 4)} aria-label="导出分辨率" className="!bg-transparent !border-0 text-[10px] text-(--muted) !px-[3px] !py-[6px]">
            <option value={2}>2× 高清</option>
            <option value={4}>4× 超清</option>
          </Select>
          <Button variant="export" disabled={exporting || overflow} onClick={() => studioPage.current?.exportImage()}>
            <StudioIcon name="download" size={16} />
            {exporting ? '导出中…' : '导出作品'}
          </Button>
        </div>
      ) : undefined}
      overlays={<Toast message={toast} />}
    >
      <StudioPage
        ref={studioPage}
        studio={studio}
        active={page === 'studio'}
        exportScale={exportScale}
        onExportScaleChange={setExportScale}
        exporting={exporting}
        onExportingChange={setExporting}
        overflow={overflow}
        onOverflowChange={setOverflow}
        onNotice={notify}
      />
      {page === 'emperor' && <EmperorPage studio={studio} onEdict={fromPalace} onStudio={() => navigate('studio')} />}
      {page === 'treasury' && <TreasuryPage studio={studio} onNotice={notify} />}
      {page === 'officials' && <OfficialsPage studio={studio} onNotice={notify} onEdict={fromOfficer} />}
      {page === 'memorials' && <MemorialPage studio={studio} onNotice={notify} onEdict={fromMemorial} />}
      {page === 'palace' && <PalaceMapPage studio={studio} onNotice={notify} onNavigate={navigate} />}
    </AppLayout>
  )
}
