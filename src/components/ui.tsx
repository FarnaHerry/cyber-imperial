import { forwardRef, useId, useImperativeHandle, useRef, type ButtonHTMLAttributes, type CSSProperties, type FormEvent, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { StudioIcon } from './StudioIcon'

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export type ButtonVariant = 'primary' | 'default' | 'text' | 'icon' | 'signature' | 'export' | 'subtle'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-(--accent) text-(--bg) whitespace-nowrap',
  default: 'bg-(--panel) text-(--text) border-(--line)',
  text: 'inline-flex items-center justify-center gap-[5px] !border-0 !p-0 bg-transparent text-[#aeb9aa] text-[10px] hover:not-disabled:text-[#e6c6a9] light:text-[#777c67]',
  icon: 'inline-flex !p-0 items-center justify-center size-[32px] bg-transparent !border-0 text-(--muted) hover:not-disabled:bg-[#ffffff08] hover:not-disabled:text-(--text) light:hover:not-disabled:bg-[#493e3009] light:hover:not-disabled:text-[#343b30]',
  signature: 'w-full !min-h-[41px] !border-[#c69f7650] bg-[#c69f760c] text-[#dfbb94] hover:not-disabled:bg-[#c69f761b] hover:not-disabled:!border-[#c69f7690] light:!border-[#9b764655] light:text-[#8a6036] light:bg-[#9b764608]',
  export: 'bg-[#e6deca] text-[#293329] hover:bg-[#f7eedb] light:bg-[#3a4834] light:text-[#faf4e7] light:hover:bg-[#4f5d43]',
  subtle: 'bg-[#c69f7608] !border-[#c69f763f] text-(--accent) whitespace-nowrap hover:not-disabled:bg-[#c69f761a]',
}
const BUTTON_BASE = 'flex items-center justify-center gap-[9px] border border-transparent rounded-sm text-[12px] tracking-[1px] min-h-[37px] px-4'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant }

export function Button({ variant = 'default', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)} {...props} />
}

const INPUT_BASE = 'block w-full border border-[#ffffff12] rounded-sm px-3 py-[11px] bg-[#10171265] text-[#d6dacd] outline-none focus:border-[#c69f7680] placeholder:text-[#758376] light:bg-[#ffffff70] light:border-[#493e302a] light:text-[#444b3c] light:focus:border-[#997446] light:placeholder:text-[#90917d]'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { sizeMd?: boolean }

export function Input({ className, sizeMd, ...props }: InputProps) {
  return <input className={cx(INPUT_BASE, sizeMd && 'text-[13px]', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(INPUT_BASE, 'min-h-[80px] resize-y leading-[1.8]', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('px-3 py-[10px] bg-(--panel) text-(--text) border border-(--line) rounded-sm text-[12px] min-w-0', className)} {...props} />
}

export interface CardProps {
  color?: string
  className?: string
  children?: ReactNode
}

/** management-card；color 提供彩色左边框（品色/类色/名牌色） */
export function Card({ color, className, children }: CardProps) {
  return (
    <div
      className={cx('border border-(--line) bg-(--panel) rounded-sm p-6 min-w-0 max-[700px]:p-[18px]', color && 'border-[color-mix(in_srgb,var(--card-color,var(--line))_45%,transparent)] border-l-[3px] border-l-(--card-color)', className)}
      style={color ? ({ '--card-color': color } as CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}

export function Badge({ dot, className, children }: { dot?: string; className?: string; children?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-[6px] text-[10px] text-(--accent) border border-accent/25 rounded-sm px-[7px] py-1 whitespace-nowrap', className)}>
      {dot && <i className="inline-block size-[9px] rounded-full flex-none" style={{ background: dot }} />}
      {children}
    </span>
  )
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <i className={cx('inline-block size-[9px] rounded-full flex-none', className)} style={{ background: color }} />
}

export function Tabs({ items, value, onChange, className }: { items: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void; className?: string }) {
  return (
    <div className={cx('flex items-center gap-[6px] flex-wrap', className)}>
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          aria-pressed={value === item.key}
          className={cx('border border-transparent bg-transparent px-[15px] py-[9px] rounded-sm text-[12px] text-(--muted)', value === item.key && 'text-(--accent) bg-accent/10 border-accent/30')}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function Eyebrow({ className, children }: { className?: string; children?: ReactNode }) {
  return <span className={cx('text-[8px] tracking-[2.5px] text-[#8e9a87] light:text-[#8b7857]', className)}>{children}</span>
}

export function Note({ className, children }: { className?: string; children?: ReactNode }) {
  return <p className={cx('m-0 text-[10px] leading-[1.9] text-(--muted)', className)}>{children}</p>
}

export function Warning({ className, children }: { className?: string; children?: ReactNode }) {
  return <p role="alert" className={cx('text-[#e2ab87] text-[10px] leading-[1.7] mb-0 light:text-[#ad5e37]', className)}>{children}</p>
}

export function StatusLight({ className }: { className?: string }) {
  return <i className={cx('inline-block flex-none size-[5px] rounded-sm bg-[#a5b994] shadow-[0_0_8px_#a5b99425]', className)} />
}

export function Form({ className, onSubmit, children }: { className?: string; onSubmit?: (e: FormEvent<HTMLFormElement>) => void; children?: ReactNode }) {
  return <form className={cx('grid gap-[17px]', className)} onSubmit={onSubmit}>{children}</form>
}

export function Label({ className, children }: { className?: string; children?: ReactNode }) {
  return <label className={cx('grid gap-[9px] text-(--text) text-[12px]', className)}>{children}</label>
}

export function FormRow({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cx('grid grid-cols-2 gap-4', className)}>{children}</div>
}

export function FormActions({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cx('flex justify-end items-center gap-5 mt-[7px]', className)}>{children}</div>
}

export function Empty({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cx('px-5 py-9 text-center text-(--muted) text-[12px] leading-loose', className)}>{children}</div>
}

export function RestoreBar({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cx('flex items-center gap-[14px] mb-5 text-[12px] text-(--muted)', className)}>{children}</div>
}

export function Summary({ className, children }: { className?: string; children?: ReactNode }) {
  return <span className={cx('ml-auto text-[11px] text-(--muted)', className)}>{children}</span>
}

export interface DialogHandle {
  showModal(): void
  close(): void
}

export interface DialogProps {
  ref?: Ref<DialogHandle>
  eyebrow?: string
  title: string
  wide?: boolean
  closeLabel?: string
  className?: string
  children?: ReactNode
}

/** help-dialog 外壳： ornate 装饰样式在 style.css，宽度与关闭按钮在此统一 */
export const Dialog = forwardRef<DialogHandle, DialogProps>(function Dialog({ eyebrow, title, wide, closeLabel = '关闭', className, children }, ref) {
  const element = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()
  useImperativeHandle(ref, () => ({
    showModal: () => element.current?.showModal(),
    close: () => element.current?.close(),
  }), [])
  return (
    <dialog
      ref={element}
      className={cx('help-dialog', wide ? 'max-w-[500px]' : 'max-w-[460px]', className)}
      aria-labelledby={titleId}
      onClick={e => { if (e.target === element.current) element.current?.close() }}
    >
      <Button variant="icon" className="!absolute top-[14px] right-[14px]" aria-label={closeLabel} onClick={() => element.current?.close()}><StudioIcon name="close" /></Button>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
})
