import { RefreshCwIcon, CalendarDaysIcon, CheckIcon, ClipboardCopyIcon, CopyIcon, Columns3Icon, FolderIcon, InboxIcon, KeyboardIcon, ListIcon, PlusIcon, TargetIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { Fragment, type ReactNode, useMemo } from 'react'
import type { Person } from '@/types'
import { GENERAL_ID, PEOPLE, PERSON, PRIORITIES, STATUSES } from '@/data/people'
import {
  closePalette, copyTaskLink, deleteTask, duplicateTask, openCompose, openPalette, openTask, setMe, setScope, setState, setStatus,
  titleOf, toast, toggleDone, updateTask, useStore,
} from '@/data/store'
import { PRESETS } from '@/lib/presets'
import { Command, CommandCollection, CommandDialog, CommandDialogPopup, CommandEmpty, CommandFooter, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { AvatarStack, PersonAvatar, PriorityIcon, ProjectDot, StatusIcon } from './primitives'

type Item = { value: string; label: string; icon?: ReactNode; hint?: ReactNode; shortcut?: string; keep?: boolean; run: () => void }
type Group = { value: string; items: Item[] }
const ic = 'size-4'

export function CommandPalette() {
  const palette = useStore((s) => s.palette)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const me = useStore((s) => s.me)
  const now = useStore((s) => s.today)
  const target = palette?.target ? tasks.find((t) => t.id === palette.target) ?? null : null
  const page = palette?.page ?? 'root'

  const groups = useMemo<Group[]>(() => {
    const done = () => closePalette()
    const act = (fn: () => void) => () => { fn(); done() }
    if (page !== 'root' && target) {
      const lists: Record<string, Item[]> = {
        status: STATUSES.map((s) => ({ value: `st-${s.id}`, label: s.label, icon: <StatusIcon status={s.id} progress={50} size={16} />, hint: target.status === s.id ? 'Current' : undefined, run: act(() => setStatus(target.id, s.id)) })),
        priority: PRIORITIES.map((p) => ({ value: `pr-${p.id}`, label: p.label, icon: <PriorityIcon priority={p.id} size={16} />, hint: target.priority === p.id ? 'Current' : undefined, run: act(() => updateTask(target.id, { priority: p.id })) })),
        assignee: [
          ...PEOPLE.map((p) => ({ value: `as-${p.id}`, label: p.name, icon: <PersonAvatar who={p.id} size={18} />, hint: target.assignees.includes(p.id) ? 'Assigned' : undefined, keep: true, run: () => updateTask(target.id, { assignees: target.assignees.includes(p.id) ? target.assignees.filter((x) => x !== p.id) : [...target.assignees, p.id] }) })),
          { value: 'as-none', label: 'Unassigned', icon: <PersonAvatar who={null} size={18} />, run: act(() => updateTask(target.id, { assignees: [] })) },
        ],
        due: [
          ...PRESETS(now).map((p) => ({ value: `du-${p.label}`, label: p.label, hint: p.date.slice(5), icon: <CalendarDaysIcon className={ic} />, run: act(() => updateTask(target.id, { due: p.date })) })),
          { value: 'du-none', label: 'No date', icon: <CalendarDaysIcon className={ic} />, run: act(() => updateTask(target.id, { due: null })) },
        ],
        project: [
          { value: 'pj-general', label: 'General', icon: <ProjectDot hue={null} size={9} />, run: act(() => updateTask(target.id, { project: GENERAL_ID })) },
          ...projects.map((p) => ({ value: `pj-${p.id}`, label: p.name, icon: <ProjectDot hue={p.hue} size={9} />, run: act(() => updateTask(target.id, { project: p.id })) })),
        ],
      }
      const names: Record<string, string> = { status: 'Set status', priority: 'Set priority', assignee: 'Assign to', due: 'Set due date', project: 'Move to project' }
      return [{ value: names[page], items: lists[page] }]
    }

    const out: Group[] = []
    if (target) {
      const isDone = target.status === 'done'
      out.push({
        value: `${target.key}  ${titleOf(target)}`,
        items: [
          { value: 'do-done', label: isDone ? 'Reopen' : 'Mark done', icon: <CheckIcon className={ic} />, shortcut: 'X', run: act(() => toggleDone(target.id)) },
          { value: 'do-status', label: 'Set status…', icon: <StatusIcon status={target.status} progress={target.progress} size={16} />, shortcut: 'S', keep: true, run: () => openPalette('status', target.id) },
          { value: 'do-priority', label: 'Set priority…', icon: <PriorityIcon priority={target.priority} size={16} />, shortcut: 'P', keep: true, run: () => openPalette('priority', target.id) },
          { value: 'do-assign', label: 'Assign to…', icon: <AvatarStack who={target.assignees} size={18} />, shortcut: 'A', keep: true, run: () => openPalette('assignee', target.id) },
          { value: 'do-due', label: 'Set due date…', icon: <CalendarDaysIcon className={ic} />, shortcut: 'D', keep: true, run: () => openPalette('due', target.id) },
          { value: 'do-move', label: 'Move to project…', icon: <FolderIcon className={ic} />, shortcut: 'M', keep: true, run: () => openPalette('project', target.id) },
          { value: 'do-copy', label: `Copy ${target.key}`, icon: <ClipboardCopyIcon className={ic} />, run: act(() => { navigator.clipboard?.writeText(target.key).then(() => toast(`Copied ${target.key}`), () => undefined) }) },
          { value: 'do-link', label: 'Copy link', icon: <ClipboardCopyIcon className={ic} />, run: act(() => copyTaskLink(target.id)) },
          { value: 'do-dup', label: 'Duplicate', icon: <CopyIcon className={ic} />, run: act(() => duplicateTask(target.id)) },
          { value: 'do-del', label: 'Delete task', icon: <Trash2Icon className={ic} />, shortcut: '⌫', run: act(() => deleteTask(target.id)) },
        ],
      })
    }
    out.push({
      value: 'Create',
      items: [
        { value: 'new-task', label: 'New task', icon: <PlusIcon className={ic} />, shortcut: 'C', run: act(() => openCompose()) },
        { value: 'new-project', label: 'New project', icon: <FolderIcon className={ic} />, run: act(() => setState({ projectDialog: { mode: 'new' } })) },
      ],
    })
    out.push({
      value: 'Go to',
      items: [
        { value: 'v-list', label: 'List view', icon: <ListIcon className={ic} />, shortcut: '1', run: act(() => setState({ view: 'list' })) },
        { value: 'v-board', label: 'Board view', icon: <Columns3Icon className={ic} />, shortcut: '2', run: act(() => setState({ view: 'board' })) },
        { value: 'v-cal', label: 'Calendar view', icon: <CalendarDaysIcon className={ic} />, shortcut: '3', run: act(() => setState({ view: 'calendar' })) },
        { value: 's-mine', label: 'My tasks', icon: <TargetIcon className={ic} />, run: act(() => setScope({ kind: 'mine' })) },
        { value: 's-all', label: 'All tasks', icon: <InboxIcon className={ic} />, run: act(() => setScope({ kind: 'all' })) },
        { value: 's-gen', label: 'General project', icon: <ProjectDot hue={null} size={9} />, run: act(() => setScope({ kind: 'project', id: GENERAL_ID })) },
        ...projects.map((p) => ({ value: `s-${p.id}`, label: `${p.name} project`, icon: <ProjectDot hue={p.hue} size={9} />, run: act(() => setScope({ kind: 'project', id: p.id })) })),
      ],
    })
    out.push({
      value: 'People and help',
      items: [
        ...PEOPLE.map((p) => ({ value: `f-${p.id}`, label: `Show only ${p.name}`, icon: <PersonAvatar who={p.id} size={18} />, run: act(() => setState({ fPeople: [p.id] })) })),
        { value: 'f-clear', label: 'Clear filters', icon: <UserIcon className={ic} />, run: act(() => setState({ fPeople: [], fPriority: [], q: '' })) },
        ...PEOPLE.filter((p) => p.id !== me).map((p) => ({ value: `me-${p.id}`, label: `Switch to ${p.name}`, icon: <PersonAvatar who={p.id as Person} size={18} />, run: act(() => setMe(p.id)) })),
        { value: 'sync', label: 'Sync across devices', icon: <RefreshCwIcon className={ic} />, run: act(() => setState({ syncOpen: true })) },
        { value: 'help', label: 'Keyboard shortcuts', icon: <KeyboardIcon className={ic} />, shortcut: '?', run: act(() => setState({ shortcutsOpen: true })) },
      ],
    })
    out.push({
      value: 'Tasks',
      items: [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 60).map((t) => ({
        value: `t-${t.id}`, label: `${t.key} ${titleOf(t)}`, icon: <StatusIcon status={t.status} progress={t.progress} size={16} />, hint: t.key,
        run: act(() => openTask(t.id)),
      })),
    })
    return out
  }, [page, target, tasks, projects, me, now])

  const placeholder = page === 'root' ? (target ? `Do something with ${target.key}, or search…` : 'Type a command or search tasks…') : ({ status: 'Set status…', priority: 'Set priority…', assignee: 'Assign to…', due: 'Set due date…', project: 'Move to project…' } as Record<string, string>)[page]

  return (
    <CommandDialog open={!!palette} onOpenChange={(o) => { if (!o) closePalette() }}>
      <CommandDialogPopup aria-label="Command palette">
        {palette ? (
          <Command key={`${page}-${palette.target}`} items={groups} itemToStringValue={(i) => (i as Item | Group as { label?: string }).label ?? ''}>
            <CommandInput
              placeholder={placeholder}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !e.currentTarget.value && page !== 'root') { e.preventDefault(); openPalette('root', palette.target) } }}
            />
            <CommandEmpty>Nothing matches. Try a task key like GEN-1.</CommandEmpty>
            <CommandList>
              {(group: Group, index: number) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.value}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: Item) => (
                        <CommandItem key={item.value} value={item.value} onClick={item.run} className="min-h-11 gap-3 text-base sm:min-h-8 sm:text-sm">
                          <span className="grid size-5 shrink-0 place-items-center">{item.icon}</span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.hint ? <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span> : null}
                          {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                  {index < groups.length - 1 ? <CommandSeparator /> : null}
                </Fragment>
              )}
            </CommandList>
            <CommandFooter>
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> to move</span>
              <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> to choose</span>
              <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> to close</span>
            </CommandFooter>
          </Command>
        ) : null}
      </CommandDialogPopup>
    </CommandDialog>
  )
}

const SHORTCUTS: { title: string; rows: [string, string][] }[] = [
  { title: 'Anywhere', rows: [['⌘ K', 'Command palette'], ['C', 'New task'], ['/', 'Search'], ['1  2  3', 'List, board, calendar'], ['⌘ B', 'Hide or show the sidebar'], ['?', 'This list']] },
  { title: 'On a task (open or focused)', rows: [['X', 'Mark done'], ['S', 'Set status'], ['P', 'Set priority'], ['A', 'Assign to'], ['D', 'Set due date'], ['M', 'Move to project'], ['⌫', 'Delete (you can undo)']] },
  { title: 'Moving around', rows: [['J  or  ↓', 'Next task'], ['K  or  ↑', 'Previous task'], ['↵', 'Open the focused task'], ['Esc', 'Close or clear selection']] },
  { title: 'Selecting', rows: [['⌘ click  or  ⇧ click', 'Add a task to the selection'], ['⌘ A', 'Select everything shown']] },
]

export function ShortcutsDialog() {
  const open = useStore((s) => s.shortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={(o) => setState({ shortcutsOpen: o })}>
      <DialogPopup className="sm:max-w-lg" aria-label="Keyboard shortcuts">
        <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle></DialogHeader>
        <DialogPanel>
          <div className="flex flex-col gap-5">
            {SHORTCUTS.map((g) => (
              <section key={g.title}>
                <h3 className="mb-1.5 text-sm text-muted-foreground">{g.title}</h3>
                <div className="flex flex-col">
                  {g.rows.map(([k, label]) => (
                    <div key={label} className="flex min-h-9 items-center justify-between gap-4 border-b border-border/60 last:border-0">
                      <span>{label}</span>
                      <span className="flex gap-1">{k.split(/\s{2,}|\s(?=or\s)|(?<=or)\s/).filter(Boolean).map((part, i) => part === 'or' ? <span key={i} className="px-0.5 text-xs text-muted-foreground">or</span> : <Kbd key={i}>{part.trim()}</Kbd>)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
