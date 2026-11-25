import { CheckIcon, ChevronDownIcon, CalendarIcon, PlusIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Person, Priority, Status } from '@/types'
import { GENERAL_ID, PEOPLE, PERSON, PRIORITIES, PRIORITY, STATUS, STATUSES } from '@/data/people'
import { setState, useStore } from '@/data/store'
import { dueLabel, isOverdue, parseYmd, shortDay, ymd } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Drawer, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import { PRESETS } from '@/lib/presets'
import { AvatarStack, PersonAvatar, PriorityIcon, ProjectDot, StatusIcon } from './primitives'

const stop = (e: { stopPropagation(): void }) => e.stopPropagation()

export const useIsPhone = () => useMediaQuery('max-sm')
export const useIsTouch = () => useMediaQuery({ pointer: 'coarse' })

type PickerProps = {
  title: string
  label: ReactNode
  button?: Pick<ButtonProps, 'variant' | 'size' | 'className'> & { 'aria-label'?: string }
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  popClassName?: string
  children: (close: () => void) => ReactNode
}

/**
 * One picker, two shapes. Mouse: a popover that grows from its trigger. Finger: a bottom drawer with
 * big rows you can swipe away. Clicks inside never reach the row or card underneath.
 */
export function Picker({ title, label, button, align = 'start', side = 'bottom', popClassName, children }: PickerProps) {
  const phone = useIsPhone()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const trigger = <Button variant="ghost" size="sm" {...button} />
  return (
    <span className="contents" onClick={stop} onPointerDown={stop} onKeyDown={(e) => { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation() }}>
      {phone ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger render={trigger}>{label}</DrawerTrigger>
          <DrawerPopup showBar>
            <DrawerHeader><DrawerTitle>{title}</DrawerTitle></DrawerHeader>
            <DrawerPanel className="pb-[max(1rem,env(safe-area-inset-bottom))]">{children(close)}</DrawerPanel>
          </DrawerPopup>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger}>{label}</PopoverTrigger>
          <PopoverPopup align={align} side={side} className={cn('w-auto min-w-48 p-1.5', popClassName)}>{children(close)}</PopoverPopup>
        </Popover>
      )}
    </span>
  )
}

export function PickItem({ active, onClick, children, hint, danger, chevron }: { active?: boolean; onClick: () => void; children: ReactNode; hint?: ReactNode; danger?: boolean; chevron?: boolean }) {
  return (
    <button
      type="button" role="option" aria-selected={!!active} onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base outline-none transition-colors active:bg-accent focus-visible:bg-accent sm:min-h-8 sm:gap-2.5 sm:px-2.5 sm:text-sm [@media(hover:hover)]:hover:bg-accent',
        danger && 'text-destructive-foreground',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3 truncate sm:gap-2.5">{children}</span>
      {hint ? <span className="tabular-nums text-xs text-muted-foreground">{hint}</span> : null}
      {active ? <CheckIcon className="size-4 shrink-0 opacity-70" /> : null}
      {chevron ? <ChevronDownIcon className="size-4 shrink-0 -rotate-90 opacity-50" /> : null}
    </button>
  )
}

const iconBtn = { variant: 'ghost', size: 'icon-sm' } as const
const pillBtn = { variant: 'secondary', size: 'default', className: 'shrink-0 rounded-full' } as const
const fieldBtn = { variant: 'ghost', size: 'sm', className: 'justify-start' } as const

/* ---------------------------------------------------------------- status */

export function StatusList({ status, onPick }: { status: Status | null; onPick: (s: Status) => void }) {
  return (
    <div role="listbox" className="flex flex-col gap-px">
      {STATUSES.map((s) => (
        <PickItem key={s.id} active={s.id === status} onClick={() => onPick(s.id)}>
          <span className="grid size-6 shrink-0 place-items-center sm:size-5"><StatusIcon status={s.id} progress={s.id === 'in_progress' ? 50 : 0} size={18} /></span>{s.label}
        </PickItem>
      ))}
    </div>
  )
}

export function StatusPicker({ status, progress, onPick, variant = 'field', pill }: { status: Status; progress: number; onPick: (s: Status) => void; variant?: 'icon' | 'field'; pill?: boolean }) {
  return (
    <Picker
      title="Status"
      button={pill ? { ...pillBtn, 'aria-label': `Status: ${STATUS[status].label}` } : variant === 'icon' ? { ...iconBtn, 'aria-label': `Status: ${STATUS[status].label}` } : { ...fieldBtn, 'aria-label': `Status: ${STATUS[status].label}` }}
      label={variant === 'icon' ? <StatusIcon status={status} progress={progress} size={18} /> : <><StatusIcon status={status} progress={progress} size={18} />{STATUS[status].label}{pill ? null : <ChevronDownIcon className="opacity-40" />}</>}
    >
      {(close) => <StatusList status={status} onPick={(s) => { onPick(s); close() }} />}
    </Picker>
  )
}

/* ---------------------------------------------------------------- priority */

export function PriorityList({ priority, onPick }: { priority: Priority | null; onPick: (p: Priority) => void }) {
  return (
    <div role="listbox" className="flex flex-col gap-px">
      {PRIORITIES.map((p) => (
        <PickItem key={p.id} active={p.id === priority} onClick={() => onPick(p.id)}>
          <span className="grid size-6 shrink-0 place-items-center sm:size-5"><PriorityIcon priority={p.id} size={18} /></span>{p.label}
        </PickItem>
      ))}
    </div>
  )
}

export function PriorityPicker({ priority, onPick, variant = 'field', pill }: { priority: Priority; onPick: (p: Priority) => void; variant?: 'icon' | 'field'; pill?: boolean }) {
  return (
    <Picker
      title="Priority"
      button={pill ? { ...pillBtn, 'aria-label': `Priority: ${PRIORITY[priority].label}` } : variant === 'icon' ? { ...iconBtn, 'aria-label': `Priority: ${PRIORITY[priority].label}`, className: 'max-sm:hidden' } : { ...fieldBtn, 'aria-label': `Priority: ${PRIORITY[priority].label}` }}
      label={variant === 'icon' ? <PriorityIcon priority={priority} size={18} /> : <><PriorityIcon priority={priority} size={18} />{PRIORITY[priority].label}{pill ? null : <ChevronDownIcon className="opacity-40" />}</>}
    >
      {(close) => <PriorityList priority={priority} onPick={(p) => { onPick(p); close() }} />}
    </Picker>
  )
}

/* ---------------------------------------------------------------- assignee */

export function PersonList({ who, onPick }: { who: Person | null; onPick: (p: Person | null) => void }) {
  return (
    <div role="listbox" className="flex flex-col gap-px">
      {PEOPLE.map((p) => (
        <PickItem key={p.id} active={p.id === who} onClick={() => onPick(p.id)}>
          <PersonAvatar who={p.id} size={24} />{p.name}
        </PickItem>
      ))}
      <PickItem active={!who} onClick={() => onPick(null)}><PersonAvatar who={null} size={24} />Unassigned</PickItem>
    </div>
  )
}

/** Pick any number of people: each tap toggles one and the list stays open. */
export function PeopleList({ who, onChange }: { who: Person[]; onChange: (p: Person[]) => void }) {
  const toggle = (id: Person) => onChange(who.includes(id) ? who.filter((x) => x !== id) : [...who, id])
  return (
    <div role="listbox" aria-multiselectable="true" className="flex flex-col gap-px">
      {PEOPLE.map((p) => (
        <PickItem key={p.id} active={who.includes(p.id)} onClick={() => toggle(p.id)}>
          <PersonAvatar who={p.id} size={24} />{p.name}
        </PickItem>
      ))}
      <PickItem active={!who.length} onClick={() => onChange([])}><PersonAvatar who={null} size={24} />Unassigned</PickItem>
    </div>
  )
}

const namesOf = (who: Person[]) => (who.length ? who.map((w) => PERSON[w].name).join(', ') : 'nobody')

export function AssigneePicker({ who, onPick, variant = 'field', pill }: { who: Person[]; onPick: (p: Person[]) => void; variant?: 'icon' | 'field'; pill?: boolean }) {
  const aria = `Assigned to ${namesOf(who)}`
  return (
    <Picker
      title="Assign to"
      align={variant === 'icon' ? 'end' : 'start'}
      button={pill ? { ...pillBtn, className: 'shrink-0 rounded-full pl-1', 'aria-label': aria } : variant === 'icon' ? { variant: 'ghost', size: 'icon-sm', className: 'w-auto min-w-8 px-1', 'aria-label': aria } : { ...fieldBtn, 'aria-label': aria }}
      label={variant === 'icon' ? <AvatarStack who={who} size={24} /> : <><AvatarStack who={who} size={pill ? 22 : 20} /><span className="truncate">{who.length ? (who.length > 2 ? `${who.length} people` : who.map((w) => PERSON[w].name).join(', ')) : 'Unassigned'}</span>{pill ? null : <ChevronDownIcon className="opacity-40" />}</>}
    >
      {() => <PeopleList who={who} onChange={onPick} />}
    </Picker>
  )
}

/* ---------------------------------------------------------------- due date */

export function DueText({ due, done, className }: { due: string; done: boolean; className?: string }) {
  const now = useStore((s) => s.today)
  return <span className={cn('text-xs tabular-nums', isOverdue(due, done, now) ? 'text-destructive-foreground' : 'text-foreground/80', className)}>{dueLabel(due, now)}</span>
}

export function DueEditor({ due, onPick }: { due: string | null; onPick: (d: string | null) => void }) {
  const now = useStore((s) => s.today)
  return (
    <div className="flex flex-col sm:w-68">
      <div role="listbox" className="flex flex-col gap-px">
        {PRESETS(now).map((p) => (
          <PickItem key={p.label} active={due === p.date} hint={shortDay(p.date)} onClick={() => onPick(p.date)}>{p.label}</PickItem>
        ))}
        {due ? <PickItem onClick={() => onPick(null)}><span className="text-muted-foreground">No date</span></PickItem> : null}
      </div>
      <div className="mt-1.5 flex justify-center border-t pt-1.5">
        <Calendar
          mode="single" weekStartsOn={1} disabled={{ before: parseYmd(now) }} selected={due ? parseYmd(due) : undefined} defaultMonth={due ? parseYmd(due) : parseYmd(now)}
          onSelect={(d) => d && onPick(ymd(d))}
        />
      </div>
    </div>
  )
}

export function DuePicker({ due, done = false, onPick, variant = 'field', pill }: { due: string | null; done?: boolean; onPick: (d: string | null) => void; variant?: 'icon' | 'field'; pill?: boolean }) {
  const now = useStore((s) => s.today)
  const label = due ? dueLabel(due, now) : 'No date'
  return (
    <Picker
      title="Due date"
      align={variant === 'icon' ? 'end' : 'start'}
      popClassName="p-0 [&>div]:p-1.5"
      button={pill ? { ...pillBtn, 'aria-label': `Due: ${label}` } : variant === 'icon'
        ? { variant: 'ghost', size: due ? 'sm' : 'icon-sm', className: cn('min-w-0 font-normal max-sm:hidden', !due && 'text-muted-foreground/50'), 'aria-label': `Due: ${label}` }
        : { ...fieldBtn, 'aria-label': `Due: ${label}` }}
      label={variant === 'icon'
        ? due ? <DueText due={due} done={done} /> : <CalendarIcon />
        : <><CalendarIcon />{due ? <DueText due={due} done={done} className="text-sm" /> : <span className={pill ? '' : 'text-muted-foreground'}>{pill ? 'Due date' : 'No date'}</span>}{pill ? null : <ChevronDownIcon className="opacity-40" />}</>}
    >
      {(close) => <DueEditor due={due} onPick={(d) => { onPick(d); close() }} />}
    </Picker>
  )
}

/* ---------------------------------------------------------------- project */

export function ProjectList({ project, onPick }: { project: string; onPick: (id: string) => void }) {
  const projects = useStore((s) => s.projects)
  return (
    <div role="listbox" className="flex flex-col gap-px">
      <PickItem active={project === GENERAL_ID} onClick={() => onPick(GENERAL_ID)}><span className="grid size-6 shrink-0 place-items-center sm:size-5"><ProjectDot hue={null} size={10} /></span>General</PickItem>
      {projects.map((p) => (
        <PickItem key={p.id} active={p.id === project} onClick={() => onPick(p.id)}><span className="grid size-6 shrink-0 place-items-center sm:size-5"><ProjectDot hue={p.hue} size={10} /></span>{p.name}</PickItem>
      ))}
      <div className="my-1 h-px bg-border" />
      <PickItem onClick={() => setState({ projectDialog: { mode: 'new' } })}><PlusIcon className="size-4" />New project</PickItem>
    </div>
  )
}

export function ProjectPicker({ project, onPick, compact, pill }: { project: string; onPick: (id: string) => void; compact?: boolean; pill?: boolean }) {
  const projects = useStore((s) => s.projects)
  const cur = project === GENERAL_ID ? null : projects.find((p) => p.id === project)
  const name = cur?.name ?? 'General'
  return (
    <Picker
      title="Project"
      button={pill ? { ...pillBtn, className: 'max-w-44 shrink-0 rounded-full', 'aria-label': `Project: ${name}` } : compact ? { variant: 'secondary', size: 'xs', className: 'text-xs', 'aria-label': `Project: ${name}` } : { ...fieldBtn, 'aria-label': `Project: ${name}` }}
      label={<><ProjectDot hue={cur?.hue ?? null} size={compact ? 7 : 8} /><span className="truncate">{name}</span>{compact || pill ? null : <ChevronDownIcon className="opacity-40" />}</>}
    >
      {(close) => <ProjectList project={project} onPick={(id) => { onPick(id); close() }} />}
    </Picker>
  )
}
