import { PlusIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Status, Task } from '@/types'
import { STATUSES } from '@/data/people'
import { moveTask, openActions, openCompose, openTask, rankBetween, updateTask, useStore } from '@/data/store'
import { useDrag } from '@/lib/drag'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AssigneePicker, DuePicker, DueText, PriorityPicker, useIsPhone, useIsTouch } from './picker'
import { Indicators, ProjectChip, StatusBtn, TaskMenu, titleOf } from './parts'
import { PriorityIcon, StatusIcon } from './primitives'
import { EmptyState } from './list'

const EASE = [0.16, 1, 0.3, 1] as const
type Drop = { status: Status; index: number }

function CardBody({ task, showProject }: { task: Task; showProject: boolean }) {
  const phone = useIsPhone()
  const img = task.images[0]
  return (
    <>
      <span className="-mb-1 ml-9 text-xs text-muted-foreground">{task.key}</span>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1 [&>div:first-child]:-mt-4">
        <div className="relative z-10"><StatusBtn task={task} /></div>
        <button
          type="button" data-open-task onClick={() => openTask(task.id)} title={titleOf(task)}
          className={cn('line-clamp-3 cursor-pointer pt-1.5 text-left text-[15px] break-words outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:shadow-[inset_0_0_0_2px_var(--ring)] sm:pt-1 sm:text-sm', task.status === 'done' && 'text-muted-foreground')}
        >{titleOf(task)}</button>
        <div className="relative z-10"><TaskMenu task={task} className="-mt-0.5 -mr-1" /></div>
      </div>
      {img ? <div className="ml-9 aspect-video overflow-hidden rounded-lg bg-muted"><img src={img} alt="" draggable={false} loading="lazy" className="size-full object-cover" /></div> : null}
      {task.status === 'in_progress' ? (
        <div className="relative ml-9 flex h-3.5 items-center" aria-label={`${task.progress}% done`}>
          <div className="absolute right-11 left-0 h-1 rounded-full bg-foreground/10" />
          <span className="relative z-10 block h-1 rounded-full bg-[var(--amber)] transition-[width] duration-500" style={{ width: `calc((100% - 44px) * ${Math.max(6, task.progress)} / 100)` }} />
          <b className="ml-auto tabular-nums text-[11px] font-medium text-[var(--amber)]">{task.progress}%</b>
        </div>
      ) : null}
      {phone ? (
        <div className={cn('relative z-10 ml-9 flex min-w-0 items-center gap-2.5 text-xs text-muted-foreground', task.status === 'done' && 'opacity-55')}>
          <PriorityIcon priority={task.priority} size={15} />
          {task.due ? <DueText due={task.due} done={task.status === 'done'} /> : null}
          <Indicators task={task} />
          {showProject ? <ProjectChip project={task.project} className="min-w-0 shrink" /> : null}
          <span className="grow" />
          <AssigneePicker variant="icon" who={task.assignee} onPick={(p) => updateTask(task.id, { assignee: p })} />
        </div>
      ) : (
        <div className={cn('relative z-10 ml-7 flex min-w-0 items-center gap-0.5', task.status === 'done' && 'opacity-55')}>
          <PriorityPicker variant="icon" priority={task.priority} onPick={(p) => updateTask(task.id, { priority: p })} />
          <DuePicker variant="icon" due={task.due} done={task.status === 'done'} onPick={(d) => updateTask(task.id, { due: d })} />
          <Indicators task={task} />
          {showProject ? <ProjectChip project={task.project} className="ml-1" /> : null}
          <span className="grow" />
          <AssigneePicker variant="icon" who={task.assignee} onPick={(p) => updateTask(task.id, { assignee: p })} />
        </div>
      )}
    </>
  )
}

const cardClass = 'relative flex flex-col gap-2 rounded-xl bg-card p-2 pr-2.5 text-card-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.4)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-[#242427]'

export function BoardView({ tasks, filtered }: { tasks: Task[]; filtered: boolean }) {
  const phone = useIsPhone()
  const cols = useMemo(() => {
    const m = new Map<Status, Task[]>(STATUSES.map((s) => [s.id, []]))
    for (const t of [...tasks].sort((a, b) => a.rank - b.rank || b.createdAt - a.createdAt)) m.get(t.status)!.push(t)
    return m
  }, [tasks])
  if (!tasks.length) return <EmptyState filtered={filtered} />
  return phone ? <PhoneBoard cols={cols} /> : <DesktopBoard tasks={tasks} cols={cols} />
}

/* ---------------------------------------------------------------- desktop: drag between columns */

function DesktopBoard({ tasks, cols }: { tasks: Task[]; cols: Map<Status, Task[]> }) {
  const scope = useStore((s) => s.scope)
  const touch = useIsTouch()
  const showProject = scope.kind !== 'project'
  const fancy = tasks.length < 200
  const [drop, setDrop] = useState<Drop | null>(null)

  const { bind, dragId, ghost } = useDrag<Drop>({
    hit: (x, y, id) => {
      const col = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-col]')
      if (!col) return null
      const cards = Array.from(col.querySelectorAll<HTMLElement>('[data-card]')).filter((c) => c.dataset.card !== id)
      let index = 0
      for (const c of cards) { const r = c.getBoundingClientRect(); if (y > r.top + r.height / 2) index++ }
      return { status: col.dataset.col as Status, index }
    },
    onTarget: setDrop,
    onDrop: (id, t) => {
      const list = (cols.get(t.status) ?? []).filter((x) => x.id !== id)
      moveTask(id, t.status, rankBetween(list[t.index - 1]?.rank, list[t.index]?.rank))
    },
    renderGhost: (id) => {
      const t = tasks.find((x) => x.id === id)
      return t ? <div className={cn(cardClass, 'bg-[#26262a] shadow-2xl')}><CardBody task={t} showProject={showProject} /></div> : null
    },
  })

  return (
    <div className="flex h-full items-start gap-2.5 overflow-auto px-4 pt-1.5 pb-4">
      {STATUSES.map((s) => {
        const list = cols.get(s.id)!
        const over = drop?.status === s.id
        const order = new Map<string, number>()
        let k = 0
        for (const t of list) order.set(t.id, t.id === dragId ? -1 : k++)
        return (
          <section key={s.id} aria-label={s.label} data-col={s.id} className={cn('flex max-h-full min-w-55 max-w-90 flex-1 basis-55 flex-col rounded-2xl bg-muted p-1.5 transition-colors', over && 'bg-foreground/9')}>
            <header className="flex h-9 shrink-0 items-center gap-2 pr-1 pl-2.5">
              <StatusIcon status={s.id} progress={50} size={18} />
              <span className="font-semibold">{s.label}</span>
              <span className="tabular-nums text-xs text-muted-foreground">{list.length}</span>
              <span className="grow" />
              <Button variant="ghost" size="icon-sm" aria-label={`Add task to ${s.label}`} onClick={() => openCompose({ status: s.id })}><PlusIcon /></Button>
            </header>
            <div className="flex min-h-12 flex-col gap-1.5 overflow-y-auto pb-0.5">
              {list.map((t) => (
                <div key={t.id} className="relative">
                  {over && order.get(t.id) === drop!.index ? <div className="relative z-10 -my-px mx-1 h-0.5 rounded-full bg-foreground/60" /> : null}
                  <motion.div
                    layout={fancy ? 'position' : false} transition={{ layout: { duration: 0.28, ease: EASE } }}
                    initial={fancy ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } }}
                    className={cn(cardClass, 'group/item', dragId === t.id && 'opacity-30')}
                    data-card={t.id}
                    {...(touch ? {} : bind(t.id))}
                  >
                    <CardBody task={t} showProject={showProject} />
                  </motion.div>
                </div>
              ))}
              {over && drop!.index >= k ? <div className="relative z-10 mx-1 mt-0.5 h-0.5 rounded-full bg-foreground/60" /> : null}
              {!list.length && !over ? <div className="px-2.5 py-4 text-center text-sm text-muted-foreground/60">No tasks</div> : null}
            </div>
          </section>
        )
      })}
      {ghost}
    </div>
  )
}

/* ---------------------------------------------------------------- phone: one column per screen, swipe between */

function PhoneBoard({ cols }: { cols: Map<Status, Task[]> }) {
  const scope = useStore((s) => s.scope)
  const showProject = scope.kind !== 'project'
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() => Math.max(0, STATUSES.findIndex((s) => (cols.get(s.id)?.length ?? 0) > 0 && s.id === 'in_progress')))
  const tabs = useRef<HTMLDivElement>(null)
  const raf = useRef(0)

  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = active * el.clientWidth }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = scroller.current
      if (!el) return
      const i = Math.round(el.scrollLeft / el.clientWidth)
      if (i !== active) setActive(i)
    })
  }
  useEffect(() => {
    const t = tabs.current?.children[active] as HTMLElement | undefined
    t?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])
  const go = (i: number) => { const el = scroller.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }) }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {STATUSES.map((s) => {
          const list = cols.get(s.id)!
          return (
            <section key={s.id} aria-label={s.label} className="h-full min-w-full snap-start snap-always overflow-y-auto overscroll-contain px-3 pb-6">
              <div className="flex flex-col gap-2">
                {list.map((t) => (
                  <div key={t.id} className={cn(cardClass, 'active:bg-[#242427]')} {...longPress(t.id)}>
                    <CardBody task={t} showProject={showProject} />
                  </div>
                ))}
                {!list.length ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                    <StatusIcon status={s.id} size={28} />
                    <p>No {s.label.toLowerCase()} tasks</p>
                    <Button variant="secondary" onClick={() => openCompose({ status: s.id })}>Add one</Button>
                  </div>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>
      <div ref={tabs} className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2" role="tablist" aria-label="Status">
        {STATUSES.map((s, i) => (
          <button
            key={s.id} role="tab" aria-selected={active === i} onClick={() => go(i)}
            className={cn('flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors active:scale-[0.97]', active === i ? 'bg-foreground/12 text-foreground' : 'text-muted-foreground')}
          >
            <StatusIcon status={s.id} progress={50} size={16} />{s.label}
            <span className="tabular-nums text-xs opacity-70">{cols.get(s.id)!.length}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Long-press a card for its actions (touch only). */
function longPress(id: string) {
  let t: ReturnType<typeof setTimeout> | undefined
  let sx = 0, sy = 0
  const cancel = () => { clearTimeout(t); t = undefined }
  return {
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType !== 'touch' || (e.target as HTMLElement).closest('button:not([data-open-task])')) return; sx = e.clientX; sy = e.clientY; t = setTimeout(() => { navigator.vibrate?.(12); openActions(id, true) }, 480) },
    onPointerMove: (e: React.PointerEvent) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel() },
    onPointerUp: cancel, onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
