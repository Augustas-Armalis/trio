import { CalendarIcon, ChevronLeftIcon, ImageIcon, Link2Icon, MoreHorizontalIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Task } from '@/types'
import { GENERAL_ID, PEOPLE, PERSON, PRIORITIES, STATUSES } from '@/data/people'
import { actionsCloseBlocked, deleteTask, setState, setStatus, titleOf as _t, toggleDone, updateTask, useStore } from '@/data/store'
import { findLinks } from '@/lib/util'
import { cn } from '@/lib/utils'
import { PRESETS } from '@/lib/presets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from '@/components/ui/drawer'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuSub, MenuSubPopup, MenuSubTrigger, MenuTrigger } from '@/components/ui/menu'
import { DuePicker, AssigneePicker, DueEditor, PersonList, PickItem, PriorityList, PriorityPicker, ProjectList, StatusList, useIsPhone, ProjectPicker } from './picker'
import { PersonAvatar, PriorityIcon, ProjectDot, StatusIcon } from './primitives'
import { STATUS, PRIORITY } from '@/data/people'

export const titleOf = _t
const stop = (e: { stopPropagation(): void }) => e.stopPropagation()

/** The ring as a button: one tap marks it done, another brings it back where it was. */
export function StatusBtn({ task }: { task: Task }) {
  const done = task.status === 'done'
  return (
    <Button
      variant="ghost" size="icon-sm" aria-label={done ? 'Mark not done' : 'Mark done'} title={done ? 'Mark not done' : 'Mark done'}
      className="active:[&_svg]:scale-85 max-sm:size-11"
      onClick={(e) => { e.stopPropagation(); navigator.vibrate?.(done ? 0 : 8); toggleDone(task.id) }}
      onPointerDown={stop}
    >
      <StatusIcon status={task.status} progress={task.progress} size={20} />
    </Button>
  )
}

/** Desktop: a menu with submenus. Phone: the same actions in a bottom drawer. */
export function TaskMenu({ task, className }: { task: Task; className?: string }) {
  const phone = useIsPhone()
  const projects = useStore((s) => s.projects)
  const now = useStore((s) => s.today)
  const done = task.status === 'done'
  if (phone) {
    return (
      <Button variant="ghost" size="icon-sm" aria-label="More actions" className={className} onClick={(e) => { e.stopPropagation(); setState({ actionsFor: task.id }) }} onPointerDown={stop}>
        <MoreHorizontalIcon />
      </Button>
    )
  }
  return (
    <span className="contents" onClick={stop} onPointerDown={stop}>
      <Menu>
        <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" className={cn('opacity-0 transition-opacity focus-visible:opacity-100 data-popup-open:opacity-100 group-hover/item:opacity-100 group-focus-within/item:opacity-100', className)} />}>
          <MoreHorizontalIcon />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-48">
          <MenuItem onClick={() => toggleDone(task.id)}>{done ? 'Mark not done' : 'Mark done'}</MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger>Status</MenuSubTrigger>
            <MenuSubPopup>
              {STATUSES.map((s) => <MenuItem key={s.id} onClick={() => setStatus(task.id, s.id)}><StatusIcon status={s.id} progress={50} />{s.label}</MenuItem>)}
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>Priority</MenuSubTrigger>
            <MenuSubPopup>
              {PRIORITIES.map((p) => <MenuItem key={p.id} onClick={() => updateTask(task.id, { priority: p.id })}><PriorityIcon priority={p.id} />{p.label}</MenuItem>)}
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>Assign to</MenuSubTrigger>
            <MenuSubPopup>
              {PEOPLE.map((p) => <MenuItem key={p.id} onClick={() => updateTask(task.id, { assignee: p.id })}><PersonAvatar who={p.id} size={18} />{PERSON[p.id].name}</MenuItem>)}
              <MenuItem onClick={() => updateTask(task.id, { assignee: null })}><PersonAvatar who={null} size={18} />Unassigned</MenuItem>
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>Due</MenuSubTrigger>
            <MenuSubPopup>
              {PRESETS(now).map((p) => <MenuItem key={p.label} onClick={() => updateTask(task.id, { due: p.date })}>{p.label}</MenuItem>)}
              <MenuItem onClick={() => updateTask(task.id, { due: null })}>No date</MenuItem>
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>Move to</MenuSubTrigger>
            <MenuSubPopup>
              <MenuItem onClick={() => updateTask(task.id, { project: GENERAL_ID })}><ProjectDot hue={null} />General</MenuItem>
              {projects.map((p) => <MenuItem key={p.id} onClick={() => updateTask(task.id, { project: p.id })}><ProjectDot hue={p.hue} />{p.name}</MenuItem>)}
            </MenuSubPopup>
          </MenuSub>
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => deleteTask(task.id)}>Delete</MenuItem>
        </MenuPopup>
      </Menu>
    </span>
  )
}

type ActionView = 'root' | 'status' | 'priority' | 'assignee' | 'due' | 'project'

/** Phone: every action for one task, in big rows. Long-press a task or tap its menu to get here. */
export function ActionsDrawer() {
  const id = useStore((s) => s.actionsFor)
  const task = useStore((s) => (s.actionsFor ? s.tasks.find((t) => t.id === s.actionsFor) ?? null : null))
  const projects = useStore((s) => s.projects)
  const last = useRef<Task | null>(null)
  if (task) last.current = task
  const shown = task ?? last.current
  const [view, setView] = useState<ActionView>('root')
  useEffect(() => { if (id) setView('root') }, [id])
  const close = () => setState({ actionsFor: null })
  const back = () => setView('root')
  const title = view === 'root' ? (shown ? titleOf(shown) : '') : ({ status: 'Status', priority: 'Priority', assignee: 'Assign to', due: 'Due date', project: 'Move to' } as const)[view]
  const projectName = shown ? (shown.project === GENERAL_ID ? 'General' : projects.find((p) => p.id === shown.project)?.name ?? 'General') : ''

  return (
    <Drawer open={!!id} onOpenChange={(o) => { if (!o && !actionsCloseBlocked()) close() }}>
      <DrawerPopup showBar>
        <DrawerHeader className="flex-row items-center gap-1">
          {view !== 'root' ? <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={back}><ChevronLeftIcon /></Button> : null}
          <DrawerTitle className="truncate text-base">{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className="pb-[max(1rem,env(safe-area-inset-bottom))]" onClickCapture={(e) => { if (actionsCloseBlocked()) { e.stopPropagation(); e.preventDefault() } }}>
          {shown ? (
            view === 'root' ? (
              <div className="flex flex-col gap-px">
                <PickItem onClick={() => { toggleDone(shown.id); close() }}>
                  <span className="grid size-6 shrink-0 place-items-center"><StatusIcon status={shown.status === 'done' ? 'todo' : 'done'} size={20} /></span>{shown.status === 'done' ? 'Mark not done' : 'Mark done'}
                </PickItem>
                <PickItem chevron hint={STATUS[shown.status].label} onClick={() => setView('status')}><span className="grid size-6 shrink-0 place-items-center"><StatusIcon status={shown.status} progress={shown.progress} size={20} /></span>Status</PickItem>
                <PickItem chevron hint={PRIORITY[shown.priority].label} onClick={() => setView('priority')}><span className="grid size-6 shrink-0 place-items-center"><PriorityIcon priority={shown.priority} size={20} /></span>Priority</PickItem>
                <PickItem chevron hint={shown.assignee ? PERSON[shown.assignee].name : 'Nobody'} onClick={() => setView('assignee')}><span className="grid size-6 shrink-0 place-items-center"><PersonAvatar who={shown.assignee} size={24} /></span>Assign to</PickItem>
                <PickItem chevron hint={shown.due ? shown.due.slice(5) : 'None'} onClick={() => setView('due')}><span className="grid size-6 shrink-0 place-items-center"><CalendarIcon className="size-5 text-muted-foreground" /></span>Due date</PickItem>
                <PickItem chevron hint={projectName} onClick={() => setView('project')}><span className="grid size-6 shrink-0 place-items-center"><ProjectDot hue={null} size={10} /></span>Move to project</PickItem>
                <div className="my-1 h-px bg-border" />
                <PickItem danger onClick={() => { deleteTask(shown.id); close() }}>Delete</PickItem>
              </div>
            ) : view === 'status' ? <StatusList status={shown.status} onPick={(s) => { setStatus(shown.id, s); close() }} />
              : view === 'priority' ? <PriorityList priority={shown.priority} onPick={(p) => { updateTask(shown.id, { priority: p }); close() }} />
              : view === 'assignee' ? <PersonList who={shown.assignee} onPick={(p) => { updateTask(shown.id, { assignee: p }); close() }} />
              : view === 'due' ? <DueEditor due={shown.due} onPick={(d) => { updateTask(shown.id, { due: d }); close() }} />
              : <ProjectList project={shown.project} onPick={(p) => { updateTask(shown.id, { project: p }); close() }} />
          ) : null}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

/** Priority, due date and assignee as inline pickers: edit a task without opening it. */
export function TaskMeta({ task, menu = true }: { task: Task; menu?: boolean }) {
  return (
    <>
      <PriorityPicker variant="icon" priority={task.priority} onPick={(p) => updateTask(task.id, { priority: p })} />
      <DuePicker variant="icon" due={task.due} done={task.status === 'done'} onPick={(d) => updateTask(task.id, { due: d })} />
      <AssigneePicker variant="icon" who={task.assignee} onPick={(p) => updateTask(task.id, { assignee: p })} />
      {menu ? <TaskMenu task={task} className="max-sm:hidden" /> : null}
    </>
  )
}

export function ProjectChip({ project, className }: { project: string; className?: string }) {
  const projects = useStore((s) => s.projects)
  const cur = project === GENERAL_ID ? null : projects.find((p) => p.id === project)
  return (
    <Badge variant="secondary" size="lg" className={cn('max-w-40 gap-1.5 truncate font-normal text-muted-foreground', className)}>
      <ProjectDot hue={cur?.hue ?? null} size={7} />
      <span className="truncate">{cur?.name ?? 'General'}</span>
    </Badge>
  )
}

export function Indicators({ task }: { task: Task }) {
  const links = findLinks(task.body).length
  const imgs = task.images.length
  if (!links && !imgs) return null
  return (
    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
      {imgs ? <span className="flex items-center gap-0.5 tabular-nums text-xs"><ImageIcon className="size-3.5" />{imgs}</span> : null}
      {links ? <span className="flex items-center gap-0.5 tabular-nums text-xs"><Link2Icon className="size-3.5" />{links}</span> : null}
    </span>
  )
}

export { ProjectPicker }
