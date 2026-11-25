import { animate, AnimatePresence, LayoutGroup, motion, useMotionValue, useTransform } from 'motion/react'
import { CalendarIcon, ChevronRightIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Priority, Status, Task } from '@/types'
import { PEOPLE, PERSON, PRIORITIES, STATUS } from '@/data/people'
import { openActions, openCompose, openTask, setState, sortTasks, toggleDone, toggleSelect, useStore, type ComposeInit } from '@/data/store'
import { addDays, diffDays } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { AssigneePicker, DueText, useIsPhone, useIsTouch } from './picker'
import { Indicators, ProjectBar, ProjectChip, projectColor, StatusBtn, TaskMenu, TaskMeta, titleOf } from './parts'
import { PersonAvatar, PriorityIcon, ProjectDot, StatusIcon } from './primitives'
import { updateTask } from '@/data/store'
import { GENERAL_ID } from '@/data/people'

const LIST_STATUS_ORDER: Status[] = ['escalated', 'in_progress', 'todo', 'backlog', 'done']
const EASE = [0.16, 1, 0.3, 1] as const

type Group = { key: string; label: string; icon: ReactNode; tasks: Task[]; compose: ComposeInit }

function usePressActions(taskId: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef({ x: 0, y: 0 })
  const fired = useRef(false)
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined }
  return {
    fired,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch' || (e.target as HTMLElement).closest('button:not([data-open-task]), a, input')) return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        timer.current = setTimeout(() => { fired.current = true; navigator.vibrate?.(12); openActions(taskId, true) }, 480)
      },
      onPointerMove: (e: React.PointerEvent) => { if (timer.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel() },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => { if (fired.current) e.preventDefault() },
    },
    cancel,
  }
}

/** Phone row: swipe right to complete. The row is the finger while it is down; on release a spring seeded with the swipe velocity takes over. */
export function TaskRow({ task, showProject, fancy, index = 0, intro = false }: { task: Task; showProject: boolean; fancy: boolean; index?: number; intro?: boolean }) {
  const selected = useStore((s) => s.selected.includes(task.id))
  const anySelected = useStore((s) => s.selected.length > 0)
  const touch = useIsTouch()
  const phone = useIsPhone()
  const done = task.status === 'done'
  const x = useMotionValue(0)
  const reveal = useTransform(x, [0, 88], [0, 1])
  const iconScale = useTransform(x, [0, 88], [0.6, 1])
  const revealMore = useTransform(x, [0, -88], [0, 1])
  const dragged = useRef(false)
  const press = usePressActions(task.id)

  const open = (e?: React.MouseEvent) => {
    if (dragged.current || press.fired.current) { dragged.current = false; press.fired.current = false; return }
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); toggleSelect(task.id); return }
    openTask(task.id)
  }
  const content = (
    <>
      {showProject ? <ProjectBar project={task.project} /> : null}
      <div className="relative z-10"><StatusBtn task={task} /></div>
      <div className="min-w-0 py-2 sm:py-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative h-6 w-16 shrink-0 max-sm:hidden">
            <span className={cn('absolute inset-y-0 left-0 flex items-center text-xs text-muted-foreground transition-opacity duration-150', (selected || anySelected) ? 'opacity-0' : 'group-hover/item:opacity-0')}>{task.key}</span>
            <span className={cn('absolute inset-y-0 left-0 z-10 flex items-center transition-opacity duration-150', (selected || anySelected) ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100 has-[:focus-visible]:opacity-100')}>
              <Checkbox checked={selected} onCheckedChange={() => toggleSelect(task.id)} aria-label={`Select ${task.key}`} />
            </span>
          </span>
          <button
            type="button" data-open-task onClick={(e) => open(e)} title={titleOf(task)}
            className={cn('min-h-6 min-w-0 cursor-pointer truncate text-left text-base leading-6 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:shadow-[inset_0_0_0_2px_var(--ring)] sm:text-sm', done && 'text-muted-foreground')}
          >{titleOf(task)}</button>
          <span className="max-sm:hidden"><Indicators task={task} /></span>
          {showProject ? <ProjectChip project={task.project} className="max-sm:hidden" /> : null}
        </div>
        {phone ? <PhoneMeta task={task} showProject={showProject} /> : null}
      </div>
      <div className={cn('relative z-10 flex items-center gap-0.5', done && 'opacity-55')}>
        <span className={cn('w-10 pr-1.5 text-right tabular-nums text-xs text-[var(--amber)] max-sm:hidden', task.status !== 'in_progress' && 'invisible')}>{task.progress}%</span>
        <TaskMeta task={task} />
      </div>
    </>
  )

  const rowClass = 'relative grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 rounded-xl bg-background pr-2 pl-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 sm:gap-1.5 sm:pl-1.5 [@media(hover:hover)]:hover:bg-accent/60 sm:[content-visibility:auto] sm:[contain-intrinsic-size:auto_36px]'
  const common = { 'data-task': task.id }

  const inner = touch ? (
    <div className="relative overflow-hidden rounded-xl">
      <motion.div style={{ opacity: reveal }} className="absolute inset-0 flex items-center rounded-xl bg-foreground/10 pl-5" aria-hidden="true">
        <motion.span style={{ scale: iconScale }}><StatusIcon status="done" size={22} /></motion.span>
        <span className="ml-3 text-sm font-medium">{done ? 'Reopen' : 'Done'}</span>
      </motion.div>
      <motion.div style={{ opacity: revealMore }} className="absolute inset-0 flex items-center justify-end rounded-xl bg-foreground/10 pr-5" aria-hidden="true">
        <span className="mr-3 text-sm font-medium">More</span><MoreHorizontalIcon className="size-5" />
      </motion.div>
      <motion.div
        {...common} {...press.handlers}
        className={cn(rowClass, 'touch-pan-y')}
        style={{ x }}
        drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.45, right: 0.55 }} dragMomentum={false}
        onDragStart={() => { dragged.current = true; press.cancel() }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 84 || info.velocity.x > 520) { navigator.vibrate?.(10); toggleDone(task.id) }
          else if (info.offset.x < -72 || info.velocity.x < -520) { navigator.vibrate?.(8); openActions(task.id) }
          animate(x, 0, { type: 'spring', stiffness: 520, damping: 40, velocity: info.velocity.x })
          setTimeout(() => { dragged.current = false }, 60)
        }}
      >
        {content}
      </motion.div>
    </div>
  ) : (
    <div {...common} className={cn(rowClass, 'group/item', selected && 'bg-accent')}>{content}</div>
  )

  if (!fancy) return <div className={cn(done && 'opacity-80')}>{inner}</div>
  return (
    <motion.div
      layoutId={`row-${task.id}`} initial={{ opacity: 0, y: intro ? 8 : 4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE, delay: intro ? Math.min(index, 14) * 0.03 : 0 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ layout: { duration: 0.34, ease: EASE } }}
      className={cn(!touch && 'group/item', 'relative')}
    >
      {inner}
    </motion.div>
  )
}

function PhoneMeta({ task, showProject }: { task: Task; showProject: boolean }) {
  const projects = useStore((s) => s.projects)
  const done = task.status === 'done'
  const pname = task.project === GENERAL_ID ? 'General' : projects.find((p) => p.id === task.project)?.name ?? 'General'
  return (
    <div className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground sm:hidden">
      <span>{task.key}</span>
      {task.priority === 'urgent' || task.priority === 'high' ? <PriorityIcon priority={task.priority} size={13} /> : null}
      {task.due ? <DueText due={task.due} done={done} /> : null}
      {task.status === 'in_progress' ? <span className="tabular-nums text-[var(--amber)]">{task.progress}%</span> : null}
      {showProject ? <span className="truncate font-medium" style={{ color: projectColor(projects.find((p) => p.id === task.project)?.hue) }}>{pname}</span> : null}
      <Indicators task={task} />
    </div>
  )
}

export function ListView({ tasks, filtered }: { tasks: Task[]; filtered: boolean }) {
  const projects = useStore((s) => s.projects)
  const group = useStore((s) => s.group)
  const sort = useStore((s) => s.sort)
  const scope = useStore((s) => s.scope)
  const now = useStore((s) => s.today)
  const phone = useIsPhone()
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['done']))
  const [intro, setIntro] = useState(true)
  useEffect(() => { const t = setTimeout(() => setIntro(false), 900); return () => clearTimeout(t) }, [])
  const fancy = tasks.length < 150

  const groups = useMemo<Group[]>(() => {
    const sorted = sortTasks(tasks, sort)
    const by = <K extends string>(keyOf: (t: Task) => K) => {
      const m = new Map<K, Task[]>()
      for (const t of sorted) { const k = keyOf(t); m.set(k, [...(m.get(k) ?? []), t]) }
      return m
    }
    if (group === 'status') {
      const m = by((t) => t.status)
      return LIST_STATUS_ORDER.filter((s) => m.has(s)).map((s) => ({ key: s, label: STATUS[s].label, icon: <StatusIcon status={s} progress={50} size={18} />, tasks: m.get(s)!, compose: { status: s } }))
    }
    if (group === 'person') {
      const m = by((t) => t.assignee ?? 'none')
      return [...PEOPLE.map((p) => p.id as string), 'none'].filter((k) => m.has(k as never)).map((k) => ({
        key: k, label: k === 'none' ? 'Unassigned' : PERSON[k as keyof typeof PERSON].name, icon: <PersonAvatar who={k === 'none' ? null : (k as 'augustas')} size={20} />,
        tasks: m.get(k as never)!, compose: { assignee: k === 'none' ? null : (k as 'augustas') },
      }))
    }
    if (group === 'project') {
      const m = by((t) => t.project)
      const order = [GENERAL_ID, ...projects.map((p) => p.id)]
      return order.filter((id) => m.has(id)).map((id) => {
        const p = projects.find((x) => x.id === id)
        return { key: id, label: p?.name ?? 'General', icon: <ProjectDot hue={p?.hue ?? null} size={11} />, tasks: m.get(id)!, compose: { project: id } }
      })
    }
    if (group === 'priority') {
      const m = by((t) => t.priority)
      return PRIORITIES.filter((p) => m.has(p.id)).map((p) => ({ key: p.id, label: p.label, icon: <PriorityIcon priority={p.id as Priority} size={18} />, tasks: m.get(p.id)!, compose: { priority: p.id } }))
    }
    type Bk = 'over' | 'today' | 'tomorrow' | 'week' | 'later' | 'none'
    const bucket = (t: Task): Bk => {
      if (!t.due) return 'none'
      if (t.status === 'done') return 'later'
      const n = diffDays(t.due, now)
      return n < 0 ? 'over' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 7 ? 'week' : 'later'
    }
    const defs: [Bk, string, ComposeInit][] = [['over', 'Overdue', { due: now }], ['today', 'Today', { due: now }], ['tomorrow', 'Tomorrow', { due: addDays(now, 1) }], ['week', 'This week', { due: addDays(now, 3) }], ['later', 'Later', { due: addDays(now, 14) }], ['none', 'No date', {}]]
    const m = by(bucket)
    return defs.filter(([k]) => m.has(k)).map(([k, label, compose]) => ({ key: k, label, tasks: m.get(k)!, compose, icon: k === 'over' ? <span className="size-2 rounded-full bg-destructive" /> : <CalendarIcon className="size-4 text-muted-foreground" /> }))
  }, [tasks, group, sort, now, projects])

  const toggle = (k: string) => setCollapsed((c) => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n })
  const showProject = scope.kind !== 'project'
  if (!tasks.length) return <EmptyState filtered={filtered} />

  return (
    <LayoutGroup id="list">
    <div className="h-full overflow-y-auto overscroll-contain px-1.5 pb-6 sm:px-3 sm:pb-24">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key)
        return (
          <section key={g.key} aria-label={g.label} className="mb-0.5 sm:mb-1">
            <header className="sticky top-0 z-10 flex h-12 items-center justify-between bg-background/90 pr-1.5 pl-1 backdrop-blur-md sm:h-8">
              <button className="flex h-9 items-center gap-2 rounded-lg pr-2 pl-1 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7" onClick={() => toggle(g.key)} aria-expanded={!isCollapsed}>
                <ChevronRightIcon className={cn('size-4 text-muted-foreground/60 transition-transform duration-200', !isCollapsed && 'rotate-90')} />
                <span className="grid w-5 place-items-center">{g.icon}</span>
                <span className="font-semibold">{g.label}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{g.tasks.length}</span>
              </button>
              <Button variant="ghost" size="icon-sm" className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 [section:hover_&]:opacity-100" aria-label={`Add task to ${g.label}`} onClick={() => openCompose(g.compose)}><PlusIcon /></Button>
            </header>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  key="body" className="flex flex-col gap-px overflow-hidden" style={{ overflow: fancy ? 'hidden' : undefined }}
                  initial={fancy ? { height: 0, opacity: 0 } : false} animate={{ height: 'auto', opacity: 1 }} exit={fancy ? { height: 0, opacity: 0 } : undefined}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {fancy ? (
                    <AnimatePresence initial mode="popLayout">
                      {g.tasks.map((t, i) => <TaskRow key={t.id} task={t} showProject={showProject} fancy index={i} intro={intro} />)}
                    </AnimatePresence>
                  ) : g.tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} fancy={false} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )
      })}
      {phone ? null : null}
    </div>
    </LayoutGroup>
  )
}

export function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Empty className="h-full pb-24">
      <EmptyHeader>
        <EmptyMedia className="flex gap-2.5 rounded-2xl bg-muted px-4.5 py-3.5">
          <StatusIcon status="todo" size={22} /><StatusIcon status="in_progress" progress={60} size={22} /><StatusIcon status="done" size={22} />
        </EmptyMedia>
        <EmptyTitle>{filtered ? 'Nothing matches' : 'Nothing here yet'}</EmptyTitle>
        <EmptyDescription>{filtered ? 'Try clearing the search or a filter.' : 'Write down what needs doing and hand it to one of the three of you.'}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered
          ? <Button variant="secondary" onClick={() => setState({ fPeople: [], fPriority: [], q: '' })}>Clear filters</Button>
          : <Button onClick={() => openCompose()}>New task <Kbd className="max-sm:hidden">C</Kbd></Button>}
      </EmptyContent>
    </Empty>
  )
}

export function ListSkeleton() {
  return (
    <div className="space-y-1 px-3 pt-2" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-3 px-2" style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton className="size-5 rounded-full" /><Skeleton className="h-3 rounded" style={{ width: `${32 + ((i * 17) % 40)}%` }} /><Skeleton className="ml-auto h-3 w-20 rounded" />
        </div>
      ))}
    </div>
  )
}

export { AssigneePicker, TaskMenu, updateTask }
