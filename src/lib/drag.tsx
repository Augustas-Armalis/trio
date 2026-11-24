import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Opts<T> = {
  /** What is under the pointer? Return null when nothing droppable is there. */
  hit: (x: number, y: number, id: string) => T | null
  onTarget?: (t: T | null) => void
  onDrop: (id: string, t: T) => void
  renderGhost: (id: string) => ReactNode
}

const NO_DRAG = 'button:not([data-open-task]), a, input, textarea, select, [role="menuitem"], [data-nodrag]'

function scrollNear(x: number, y: number) {
  const EDGE = 56
  const seen = new Set<Element>()
  for (const el of document.elementsFromPoint(x, y)) {
    let n: Element | null = el
    while (n && n !== document.body) {
      if (!seen.has(n)) {
        seen.add(n)
        const cs = getComputedStyle(n)
        const r = n.getBoundingClientRect()
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
          if (y < r.top + EDGE) n.scrollTop -= Math.ceil(((r.top + EDGE - y) / EDGE) * 14)
          else if (y > r.bottom - EDGE) n.scrollTop += Math.ceil(((y - (r.bottom - EDGE)) / EDGE) * 14)
        }
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) {
          if (x < r.left + EDGE) n.scrollLeft -= Math.ceil(((r.left + EDGE - x) / EDGE) * 16)
          else if (x > r.right - EDGE) n.scrollLeft += Math.ceil(((x - (r.right - EDGE)) / EDGE) * 16)
        }
      }
      n = n.parentElement
    }
  }
}

/**
 * Pointer drag with a floating ghost. Mouse and pen only: on touch, the page keeps scrolling and
 * moving a card goes through its menu. The ghost follows the pointer 1:1 (no easing), the original
 * stays in place dimmed, and the drop target is read from the DOM under the pointer.
 */
export function useDrag<T>(opts: Opts<T>) {
  const o = useRef(opts)
  o.current = opts
  const [dragId, setDragId] = useState<string | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const posRef = useRef({ x: 0, y: 0 })
  const cleanup = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanup.current?.(), [])

  const bind = useCallback((id: string) => ({
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || e.pointerType === 'touch') return
      if ((e.target as HTMLElement).closest(NO_DRAG)) return
      const card = e.currentTarget
      const rect = card.getBoundingClientRect()
      const start = { x: e.clientX, y: e.clientY }
      const off = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      let dragging = false
      let last = { x: start.x, y: start.y }
      let target: T | null = null
      let raf = 0

      const place = () => {
        posRef.current = { x: last.x - off.x, y: last.y - off.y }
        const g = ghostRef.current
        if (g) g.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) rotate(1.2deg) scale(1.015)`
      }
      const tick = () => {
        if (!dragging) return
        scrollNear(last.x, last.y)
        raf = requestAnimationFrame(tick)
      }
      const update = () => {
        const t = o.current.hit(last.x, last.y, id)
        if (JSON.stringify(t) !== JSON.stringify(target)) { target = t; o.current.onTarget?.(t) }
      }
      const move = (ev: PointerEvent) => {
        last = { x: ev.clientX, y: ev.clientY }
        if (!dragging) {
          if (Math.hypot(last.x - start.x, last.y - start.y) < 5) return
          dragging = true
          sizeRef.current = { w: rect.width, h: rect.height }
          posRef.current = { x: last.x - off.x, y: last.y - off.y }
          document.body.classList.add('is-dragging')
          setDragId(id)
          raf = requestAnimationFrame(tick)
        }
        place()
        update()
      }
      const end = (commit: boolean) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
        window.removeEventListener('keydown', key, true)
        cancelAnimationFrame(raf)
        cleanup.current = null
        if (!dragging) return
        document.body.classList.remove('is-dragging')
        // The click that follows a drag must not open the card.
        const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, true), 0)
        const t = target
        setDragId(null)
        o.current.onTarget?.(null)
        if (commit && t) o.current.onDrop(id, t)
      }
      const up = () => end(true)
      const cancel = () => end(false)
      const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); end(false) } }
      cleanup.current = () => end(false)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('keydown', key, true)
    },
  }), [])

  const ghost = dragId
    ? createPortal(
        <div ref={(el) => { ghostRef.current = el; if (el) el.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) rotate(1.2deg) scale(1.015)` }} className="pointer-events-none fixed left-0 top-0 z-[90] will-change-transform" style={{ width: sizeRef.current.w }} aria-hidden="true">
          {o.current.renderGhost(dragId)}
        </div>,
        document.body,
      )
    : null

  return { bind, dragId, ghost }
}
