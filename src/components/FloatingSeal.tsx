import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '../core/types'
import { SealGlyph } from './SealGlyph'
import './FloatingSeal.css'

export interface FloatingSealProps {
  ink: string
  text?: string
  font?: string
  angle?: number
  erosion?: number
  size?: number
  /** 印盒元素：空闲时玉玺停在这里，不会挡住任何可点区域 */
  dock?: HTMLElement | null
  /** 屏幕坐标 → 画布坐标；返回 null 表示不落在画布上 */
  toCanvas: (clientX: number, clientY: number) => Point | null
  onDrop: (p: { clientX: number; clientY: number }) => void
  onHover: (p: Point | null) => void
}

export interface FloatingSealHandle {
  home(): void
}

export const FloatingSeal = forwardRef<FloatingSealHandle, FloatingSealProps>(function FloatingSeal(
  { ink, text, font, angle, erosion = 0.5, size = 140, dock = null, toCanvas, onDrop, onHover },
  ref,
) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)
  const [pressed, setPressed] = useState(false)
  const pressTimer = useRef(0)
  const homeTimer = useRef(0)
  const grabDx = useRef(0)
  const grabDy = useRef(0)
  // window 级监听只在挂载时注册一次，用 ref 读到最新的 home / dragging
  const draggingRef = useRef(false)
  const homeRef = useRef<() => void>(() => {})

  /** 归位：停在印盒正中；印盒不存在时退回右下角。 */
  function home() {
    if (dock) {
      const r = dock.getBoundingClientRect()
      setPos({
        x: r.left + (r.width - size) / 2,
        y: r.top + (r.height - size) / 2,
      })
      return
    }
    const m = 40
    setPos({
      x: Math.max(m, window.innerWidth - size - m),
      y: Math.max(m, window.innerHeight - size - 96),
    })
  }

  useEffect(() => {
    homeRef.current = home
    draggingRef.current = dragging
  })

  /** 印面中心当前的屏幕坐标——盖下去的位置以「看见的印章」为准，而不是指针。 */
  function sealCenter(): Point {
    return {
      x: pos.x + size / 2,
      y: pos.y + size / 2,
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    clearTimeout(homeTimer.current)
    clearTimeout(pressTimer.current)
    setPressed(false)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    draggingRef.current = true
    grabDx.current = e.clientX - pos.x
    grabDy.current = e.clientY - pos.y
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const next = { x: e.clientX - grabDx.current, y: e.clientY - grabDy.current }
    setPos(next)
    const c = { x: next.x + size / 2, y: next.y + size / 2 }
    const hit = toCanvas(c.x, c.y)
    setOver(!!hit)
    onHover(hit)
  }

  function onPointerUp() {
    if (!dragging) return
    setDragging(false)
    draggingRef.current = false
    setOver(false)
    onHover(null)

    const c = sealCenter()
    if (toCanvas(c.x, c.y)) {
      // 落点命中画布 → 盖下去
      setPressed(true)
      onDrop({ clientX: c.x, clientY: c.y })
      pressTimer.current = window.setTimeout(() => setPressed(false), 180)
      // 盖完让印章滑回印盒，别赖在卷轴上挡住刚盖好的印
      homeTimer.current = window.setTimeout(() => homeRef.current(), 220)
    } else {
      // 没盖到，自己飘回原位
      home()
    }
  }

  function onDblClick() {
    home()
  }

  function onPointerCancel() {
    setDragging(false)
    draggingRef.current = false
    setOver(false)
    onHover(null)
    home()
  }

  /** 印盒是 sticky 的，面板滚动时玉玺要跟着走。 */
  function onScroll() {
    if (!draggingRef.current) homeRef.current()
  }

  useEffect(() => {
    home()
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      onHover(null)
      clearTimeout(pressTimer.current)
      clearTimeout(homeTimer.current)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
    // 仅在挂载/卸载时注册与清理；home、onHover 经 ref 取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 印盒元素可能晚于本组件挂载（父组件模板 ref）
  useEffect(() => {
    home()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dock])

  useImperativeHandle(ref, () => ({ home }))

  const style = {
    transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
    width: `${size}px`,
    height: `${size}px`,
    color: ink,
    '--seal-angle': `${angle ?? 0}deg`,
  } as CSSProperties

  return (
    <div
      className={['floating-seal', dragging && 'dragging', over && 'over', pressed && 'pressed']
        .filter(Boolean)
        .join(' ')}
      style={style}
      title="拖到卷轴上盖章 · 双击归位"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDblClick}
    >
      <div className="halo" />
      <div className="body">
        <SealGlyph ink={ink} text={text} font={font} erosion={erosion} size={size - 24} seed={1000} />
      </div>
      <div className="label">拖我盖章</div>
    </div>
  )
})
