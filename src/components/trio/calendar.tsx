import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Task } from '@/types'
import { openCompose, openTask, toast, updateTask, useStore } from '@/data/store'
import { MONTHS, monthGrid, parseYmd } from '@/lib/dates'
import { useDrag } from '@/lib/drag'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import { isClosed } from '@/data/people'
import { AvatarStack, PriorityIcon, StatusIcon } from './primitives'
import { titleOf } from './parts'
import { useIsPhone } from './picker'

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3
const tint = (t: Task) => ({ ['--pc' as string]: t.assignee ? `var(--p-${t.assignee})` : 'var(--muted-foreground)' })

function Chip({ task, bind, dragging }: { task: Task; bind: (id: string) => object; dragging: boolean }) {
  const done = isClosed(task)
  return (
    <div
      role="button" tabIndex={0} data-chip={task.id} style={tint(task)}
      className={cn(
        'flex h-5.5 min-w-0 cursor-pointer items-center gap-1.5 rounded-md bg-[color-mix(in_oklab,var(--pc)_15%,#1a1a1a)] px-1.75 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-[color-mix(in_oklab,var(--pc)_24%,#1e1e1e)]',
        done && 'opacity-50', dragging && 'opacity-30',
      )}
      onClick={(e) => { e.stopPropagation(); openTask(task.id) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openTask(task.id) } }}
      {...bind(task.id)}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full bg-[var(--pc)]', task.priority === 'urgent' && !done && 'bg-destructive shadow-[0_0_0_2px_var(--red-soft)]')} />
      <span className={cn('truncate', done && 'line-through decoration-muted-foreground/60')}>{titleOf(task)}</span>
    </div>
  )
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const now = useStore((s) => s.today)
  const phone = useIsPhone()
  const [cur, setCur] = useState(() => { const d = parseYmd(now); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected] = useState<string | null>(() => now)
  const [over, setOver] = useState<string | null>(null)
  const grid = useMemo(() => monthGrid(cur.y, cur.m), [cur])
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) if (t.due) m.set(t.due, [...(m.get(t.due) ?? []), t])
    for (const [, l] of m) l.sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.rank - b.rank)
    return m
  }, [tasks])
  const undated = useMemo(() => tasks.filter((t) => !t.due && !isClosed(t)).length, [tasks])
  const step = (n: number) => setCur((c) => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const goToday = () => { const d = parseYmd(now); setCur({ y: d.getFullYear(), m: d.getMonth() }); setSelected(now) }
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const { bind, dragId, ghost } = useDrag<string>({
    hit: (x, y) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-day]')?.dataset.day ?? null,
    onTarget: setOver,
    onDrop: (id, day) => {
      if (day < now) return toast("Can't schedule in the past")
      updateTask(id, { due: day })
    },
    renderGhost: (id) => {
      const t = tasks.find((x) => x.id === id)
      return t ? <div style={tint(t)} className="flex h-5.5 w-50 items-center gap-1.5 rounded-md bg-[color-mix(in_oklab,var(--pc)_22%,#222222)] px-1.75 text-xs shadow-xl"><span className="size-1.5 rounded-full bg-[var(--pc)]" /><span className="truncate">{titleOf(t)}</span></div> : null
    },
  })
  const agenda = selected ? byDay.get(selected) ?? [] : []

  return (
    <div
      className="flex h-full flex-col overflow-y-auto overscroll-contain px-2 pb-6 sm:px-4 sm:pb-4"
      onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={(e) => {
        const s = swipe.current; swipe.current = null
        if (!s || !phone) return
        const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) > 64 && Math.abs(dy) < 40) step(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 px-1 sm:gap-3.5">
        <h2 className="text-lg font-semibold whitespace-nowrap tracking-tight">{MONTHS[cur.m]} <span className="font-normal text-muted-foreground">{cur.y}</span></h2>
        <div className="flex items-center gap-1">
          <Button variant="secondary" onClick={goToday}>Today</Button>
          <Button variant="ghost" size="icon-lg" aria-label="Previous month" onClick={() => step(-1)}><ChevronLeftIcon /></Button>
          <Button variant="ghost" size="icon-lg" aria-label="Next month" onClick={() => step(1)}><ChevronRightIcon /></Button>
        </div>
        {undated ? <span className="ml-auto text-sm text-muted-foreground max-sm:hidden">{undated} without a date</span> : null}
      </div>
      <div className="grid shrink-0 grid-cols-7 pt-1 pb-1.5">
        {WD.map((d) => <span key={d} className="px-2 text-xs text-muted-foreground max-sm:text-center max-sm:px-0">{d}</span>)}
      </div>
      <div className="grid min-h-[520px] flex-1 grid-cols-7 grid-rows-[repeat(6,minmax(86px,1fr))] gap-px overflow-hidden rounded-xl bg-border max-sm:min-h-0 max-sm:grid-rows-[repeat(6,minmax(52px,1fr))]">
        {grid.map((day) => {
          const list = byDay.get(day) ?? []
          const dt = parseYmd(day)
          const outside = dt.getMonth() !== cur.m
          const extra = list.length - MAX_CHIPS
          const isToday = day === now
          return (
            <div
              key={day} data-day={day}
              className={cn('group/day relative flex min-w-0 flex-col gap-1 bg-background p-1.5 max-sm:items-center max-sm:px-0.5 max-sm:py-1 [@media(hover:hover)]:hover:bg-accent/40', outside && 'bg-[#121212]', over === day && 'bg-accent', selected === day && 'max-sm:bg-accent')}
              onClick={() => setSelected(day === selected ? null : day)}
              onDoubleClick={() => { if (day >= now) openCompose({ due: day }) }}
            >
              <div className="flex h-5.5 items-center justify-between max-sm:justify-center">
                <span className={cn('inline-grid h-5.5 min-w-5.5 place-items-center rounded-full px-1 tabular-nums text-xs', outside ? 'text-muted-foreground/50' : day < now ? 'text-foreground/45' : 'text-foreground/80', isToday && 'bg-foreground font-semibold text-background')}>
                  {dt.getDate() === 1 ? `${MONTHS[dt.getMonth()].slice(0, 3)} 1` : dt.getDate()}
                </span>
                <Button variant="ghost" size="icon-xs" className={cn('opacity-0 transition-opacity group-hover/day:opacity-100 focus-visible:opacity-100 max-sm:hidden', day < now && 'hidden')} aria-label={`New task on ${day}`} onClick={(e) => { e.stopPropagation(); openCompose({ due: day }) }}><PlusIcon /></Button>
              </div>
              <div className="flex min-w-0 flex-col gap-0.75 max-sm:hidden">
                {list.slice(0, MAX_CHIPS).map((t) => <Chip key={t.id} task={t} bind={bind} dragging={dragId === t.id} />)}
                {extra > 0 ? (
                  <Popover>
                    <PopoverTrigger render={<Button variant="ghost" size="xs" className="h-5 justify-start px-1.75 font-normal text-muted-foreground" onClick={(e) => e.stopPropagation()} />}>+{extra} more</PopoverTrigger>
                    <PopoverPopup align="start" className="w-64 p-1.5">
                      {list.slice(MAX_CHIPS).map((t) => (
                        <button key={t.id} className="flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-accent" onClick={() => openTask(t.id)}><StatusIcon status={t.status} progress={t.progress} />{titleOf(t)}</button>
                      ))}
                    </PopoverPopup>
                  </Popover>
                ) : null}
              </div>
              {list.length ? (
                <div className="mt-auto hidden justify-center gap-0.75 pb-0.5 max-sm:flex" aria-hidden="true">
                  {list.slice(0, 4).map((t) => <i key={t.id} className="size-1.25 rounded-full" style={{ background: t.assignee ? `var(--p-${t.assignee})` : 'var(--muted-foreground)' }} />)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {phone && selected ? (
        <div className="mt-4 flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-1 pb-2">
            <strong className="text-base">{parseYmd(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
            <Button variant="secondary" onClick={() => openCompose({ due: selected >= now ? selected : now })}><PlusIcon />New task</Button>
          </div>
          {agenda.length ? agenda.map((t) => (
            <button key={t.id} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-accent" onClick={() => openTask(t.id)}>
              <StatusIcon status={t.status} progress={t.progress} size={20} />
              <span className={cn('min-w-0 flex-1 truncate text-[15px]', isClosed(t) && 'text-muted-foreground')}>{titleOf(t)}</span>
              <PriorityIcon priority={t.priority} /><AvatarStack who={t.assignees} size={24} />
            </button>
          )) : <p className="px-1 text-muted-foreground">Nothing due.</p>}
        </div>
      ) : null}
      {ghost}
    </div>
  )
}
