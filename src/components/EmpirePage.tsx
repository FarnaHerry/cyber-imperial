import type { ReactNode } from 'react'

export interface EmpirePageProps {
  title: string
  eyebrow: string
  description: string
  actions?: ReactNode
  children?: ReactNode
}

export function EmpirePage({ title, eyebrow, description, actions, children }: EmpirePageProps) {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-9 pt-[34px] pb-10 max-[1100px]:overflow-visible max-[1100px]:px-6 max-[1100px]:py-7 max-[700px]:p-4" aria-label={title}>
      <div className="w-full max-w-[1320px] m-auto">
        <header className="flex justify-between items-center gap-6 mb-7 max-[700px]:items-stretch max-[700px]:flex-col max-[700px]:gap-[18px]">
          <div>
            <span className="text-[8px] tracking-[2.5px] text-[#8e9a87] light:text-[#8b7857]">{eyebrow}</span>
            <h1 className="font-normal text-[32px] font-serif tracking-[5px] m-[12px_0] max-[700px]:text-[28px]">{title}</h1>
            <p className="text-[12px] leading-[1.9] text-(--muted) m-0">{description}</p>
          </div>
          <div className="flex-none flex items-center gap-3 max-[700px]:flex-wrap">{actions}</div>
        </header>
        {children}
      </div>
    </main>
  )
}
