import { useRef, type ReactNode } from 'react'
import { StudioIcon } from '../components/StudioIcon'
import { PAGES, type PageKey } from '../core/navigation'
import { Button, cx, Dialog, type DialogHandle } from '../components/ui'
import './AppLayout.css'

export interface AppLayoutProps {
  page: PageKey
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  actions?: ReactNode
  overlays?: ReactNode
  children?: ReactNode
}

export function AppLayout({ page, theme, onToggleTheme, actions, overlays, children }: AppLayoutProps) {
  const helpDialog = useRef<DialogHandle | null>(null)
  const pageInfo = PAGES.find(p => p.key === page)!
  const help = {
    emperor: '设置国号与名讳，维护宫册，再随机翻牌。翻牌结果可送入工坊拟旨。',
    treasury: '至宝自动归入皇室宝库，其他藏品归入国库。编目可修改类别与数量；入库和出库都会记入库簿，出库不能超过库存。',
    officials: '品级从正一品、从一品依次降至从九品，另设不入流。文武共用顺序、分别设置职名。在官册中选择文武与品级，还可为官员拟任命旨。',
    memorials: '具折人可从官册选取，也可手填。草稿上奏后进入待批队列，填写朱批并准奏、驳回或发回修改；发回的奏折可修订再奏，保留最近 20 次批阅记录。批复可送入工坊拟旨，库藏与官册由你另行办理。',
    palace: '点击地图建筑或宫阙名录，查看宫殿详情。题写名称与用途后保存，地图会同步更新。库藏与文武议事殿可直接前往相应页面。',
    studio: '',
  }[page]

  return (
    <div className="app-layout h-[100dvh] min-h-[480px] flex flex-col max-[1100px]:h-auto max-[1100px]:min-h-[100dvh]">
      <header className="h-[86px] flex-none flex items-center justify-between gap-5 px-[30px] border-b border-(--line) max-[1100px]:px-[22px] min-[701px]:max-[1200px]:h-auto min-[701px]:max-[1200px]:min-h-[130px] min-[701px]:max-[1200px]:flex-wrap min-[701px]:max-[1200px]:pt-[14px] min-[701px]:max-[1200px]:pb-3 min-[701px]:max-[1200px]:gap-y-[10px] max-[700px]:h-auto max-[700px]:min-h-[75px] max-[700px]:flex-wrap max-[700px]:pt-4 max-[700px]:pb-3 max-[700px]:px-4 max-[700px]:gap-x-[10px] max-[700px]:gap-y-[14px]">
        <a className="flex items-center gap-[13px] no-underline text-inherit" href="#studio" aria-label="赛博玉玺首页"><span className="brand-mark font-serif text-[29px] grid place-items-center size-[43px] border border-[#c58566] text-[#e9ac8c] light:text-[#a06444] light:border-[#a0644470] relative [&::after]:content-[''] [&::after]:absolute [&::after]:inset-[3px] [&::after]:border [&::after]:border-[#c5856645] max-[700px]:size-[35px] max-[700px]:text-[24px]">帝</span></a>
        <nav className="flex items-center gap-[6px] min-[701px]:max-[1200px]:order-3 min-[701px]:max-[1200px]:w-full min-[701px]:max-[1200px]:justify-center min-[701px]:max-[1200px]:border-t min-[701px]:max-[1200px]:border-(--line) min-[701px]:max-[1200px]:pt-[10px] max-[700px]:order-3 max-[700px]:w-full max-[700px]:justify-start max-[700px]:overflow-x-auto max-[700px]:border-t max-[700px]:border-(--line) max-[700px]:pt-[11px]" aria-label="页面导航">{PAGES.map(item => <a key={item.key} href={`#${item.key}`} className={cx('px-2.5 py-[9px] text-(--muted) text-[12px] tracking-[1px] no-underline border border-transparent rounded-sm whitespace-nowrap flex-none max-[1100px]:px-3 max-[1100px]:py-2 max-[700px]:px-3.5 max-[700px]:text-center', page === item.key && 'text-(--accent) bg-accent/10 border-accent/30')} aria-current={page === item.key ? 'page' : undefined}>{item.label}</a>)}</nav>
        <div className="flex items-center gap-[18px] max-[1200px]:ml-auto max-[700px]:gap-[6px]">
          <Button variant="icon" className="max-[700px]:hidden" aria-label="使用说明" title="使用说明" onClick={() => helpDialog.current?.showModal()}><StudioIcon name="help" /></Button>
          <Button variant="icon" className="max-[700px]:w-[26px]" aria-label={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'} title={theme === 'dark' ? '浅色模式' : '深色模式'} onClick={onToggleTheme}><StudioIcon name={theme === 'dark' ? 'sun' : 'moon'} /></Button>
          {actions}
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <Dialog
        ref={helpDialog}
        eyebrow="THE IMPERIAL GUIDE"
        title={page === 'studio' ? '一方玉玺，怎样用？' : `${pageInfo.label}，怎样用？`}
        closeLabel="关闭说明"
      >
        {page === 'studio' ? (
          <>
            <p>选择题笺，编辑正文，再选一方属于你的印。点击纸面即可落印，也可以从印盒拖动玉玺。落款用印会自动盖在正文末尾。</p>
            <dl className="grid grid-cols-[100px_1fr] gap-y-[15px] text-[11px] border-y border-(--line) py-5 my-6 max-[700px]:grid-cols-[90px_1fr] max-[700px]:text-[10px]">
              <dt className="text-[#d7b18d]">撤销 / 重做</dt><dd className="m-0 text-[#b3bea8]">Ctrl / ⌘ Z · Ctrl / ⌘ Shift Z</dd>
              <dt className="text-[#d7b18d]">导出作品</dt><dd className="m-0 text-[#b3bea8]">Ctrl / ⌘ S · 2× 或 4× PNG</dd>
              <dt className="text-[#d7b18d]">随机拟旨</dt><dd className="m-0 text-[#b3bea8]">Ctrl / ⌘ Enter</dd>
              <dt className="text-[#d7b18d]">退出专注</dt><dd className="m-0 text-[#b3bea8]">Esc</dd>
            </dl>
          </>
        ) : <p>{help}</p>}
        <p className="help-note">所有创作与记录自动保存至当前浏览器。字体为可选在线增强，其余操作在本机完成。</p>
      </Dialog>
      {overlays}
    </div>
  )
}
