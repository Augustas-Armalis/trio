import { CalendarDaysIcon, ChevronsUpDownIcon, Columns3Icon, InboxIcon, ListIcon, MenuIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, TargetIcon, XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import type { GroupBy, Priority, SortBy, ViewKind } from '@/types'
import { GENERAL_ID, PEOPLE, PERSON, PRIORITIES } from '@/data/people'
import { openCompose, setMe, setScope, setState, useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from '@/components/ui/drawer'
import { Kbd } from '@/components/ui/kbd'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroupPrimitive, RadioPrimitive } from '@/components/ui/radio-group'
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { PickItem, useIsPhone } from './picker'
import { Mark, PersonAvatar, PriorityIcon, ProjectDot } from './primitives'
import { MoreHorizontalIcon } from 'lucide-react'

/* ================================================================== sidebar */

export function AppSidebar() {
  const scope = useStore((s) => s.scope)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const me = useStore((s) => s.me)
  const mode = useStore((s) => s.mode)
  const conn = useStore((s) => s.conn)
  const { setOpenMobile } = useSidebar()
  const go = (sc: Parameters<typeof setScope>[0]) => { setScope(sc); setOpenMobile(false) }

  const open = useMemo(() => {
    const m = new Map<string, number>()
    let mine = 0, all = 0
    for (const t of tasks) {
      if (t.status === 'done') continue
      all++
      m.set(t.project, (m.get(t.project) ?? 0) + 1)
      if (t.assignee === me) mine++
    }
    return { m, mine, all }
  }, [tasks, me])

  const sync = mode === 'local'
    ? { dot: 'border border-muted-foreground bg-transparent', text: 'This device only' }
    : conn === 'live' ? { dot: 'bg-foreground/70', text: 'Live' }
    : conn === 'connecting' ? { dot: 'bg-muted-foreground/50', text: 'Connecting' }
    : { dot: 'bg-destructive', text: conn === 'slow' ? 'Can’t reach the server' : 'Disconnected' }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="flex-row items-center justify-between pr-2">
        <span className="flex items-center gap-2.5 px-2 text-[15px] font-semibold tracking-tight"><Mark size={17} />Trio</span>
        <Button variant="ghost" size="icon-sm" aria-label="New task" onClick={() => { openCompose(); setOpenMobile(false) }}><PlusIcon /></Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={scope.kind === 'mine'} onClick={() => go({ kind: 'mine' })}><TargetIcon />My tasks</SidebarMenuButton>
                {open.mine ? <SidebarMenuBadge>{open.mine}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={scope.kind === 'all'} onClick={() => go({ kind: 'all' })}><InboxIcon />All tasks</SidebarMenuButton>
                {open.all ? <SidebarMenuBadge>{open.all}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction aria-label="New project" onClick={() => setState({ projectDialog: { mode: 'new' } })}><PlusIcon /></SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={scope.kind === 'project' && scope.id === GENERAL_ID} onClick={() => go({ kind: 'project', id: GENERAL_ID })}><ProjectDot hue={null} size={9} />General</SidebarMenuButton>
                {open.m.get(GENERAL_ID) ? <SidebarMenuBadge>{open.m.get(GENERAL_ID)}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
              {projects.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton isActive={scope.kind === 'project' && scope.id === p.id} onClick={() => go({ kind: 'project', id: p.id })}><ProjectDot hue={p.hue} size={9} /><span className="truncate">{p.name}</span></SidebarMenuButton>
                  <SidebarMenuAction showOnHover aria-label={`Edit ${p.name}`} onClick={() => { setState({ projectDialog: { mode: 'edit', id: p.id } }); setOpenMobile(false) }}><MoreHorizontalIcon /></SidebarMenuAction>
                  {open.m.get(p.id) ? <SidebarMenuBadge className="group-hover/menu-item:opacity-0">{open.m.get(p.id)}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {!projects.length ? <p className="px-2 pt-1 text-xs text-sidebar-foreground/80">Projects group tasks. Everything else lives in General.</p> : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Menu>
          <MenuTrigger render={<SidebarMenuButton size="lg" className="h-12 gap-3" />}>
            <PersonAvatar who={me} size={28} />
            <span className="flex min-w-0 flex-1 flex-col text-left leading-tight"><span className="truncate font-medium">{me ? PERSON[me].name : 'Choose who you are'}</span><span className="text-xs text-sidebar-foreground/80">You</span></span>
            <ChevronsUpDownIcon className="opacity-50" />
          </MenuTrigger>
          <MenuPopup side="top" align="start" className="min-w-52">
            {PEOPLE.map((p) => <MenuItem key={p.id} onClick={() => setMe(p.id)}><PersonAvatar who={p.id} size={20} />{p.name}{p.id === me ? <span className="ml-auto text-xs opacity-60">You</span> : null}</MenuItem>)}
          </MenuPopup>
        </Menu>
        <div className="flex items-center gap-2 px-2.5 pb-1 text-xs text-sidebar-foreground/80" title={mode === 'local' ? 'Changes are saved in this browser only. Open Trio from the shared link to sync.' : undefined}>
          <i className={cn('size-1.5 rounded-full', sync.dot)} />{sync.text}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

/* ================================================================== toolbar */

export const VIEWS: { id: ViewKind; label: string; icon: typeof ListIcon; key: string }[] = [
  { id: 'list', label: 'List', icon: ListIcon, key: '1' },
  { id: 'board', label: 'Board', icon: Columns3Icon, key: '2' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDaysIcon, key: '3' },
]
export const GROUPS: { id: GroupBy; label: string }[] = [{ id: 'status', label: 'Status' }, { id: 'person', label: 'Person' }, { id: 'priority', label: 'Priority' }, { id: 'due', label: 'Due date' }]
export const SORTS: { id: SortBy; label: string }[] = [{ id: 'manual', label: 'Manual' }, { id: 'due', label: 'Due date' }, { id: 'priority', label: 'Priority' }, { id: 'newest', label: 'Newest' }]

export function useScopeTitle() {
  const scope = useStore((s) => s.scope)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const me = useStore((s) => s.me)
  const title = scope.kind === 'all' ? 'All tasks' : scope.kind === 'mine' ? 'My tasks' : scope.id === GENERAL_ID ? 'General' : projects.find((p) => p.id === scope.id)?.name ?? 'General'
  const stat = useMemo(() => {
    const inScope = tasks.filter((t) => (scope.kind === 'project' ? t.project === scope.id : scope.kind === 'mine' ? t.assignee === me : true))
    return { done: inScope.filter((t) => t.status === 'done').length, total: inScope.length }
  }, [tasks, scope, me])
  return { title, stat }
}

export function PeopleFilter({ big }: { big?: boolean }) {
  const fPeople = useStore((s) => s.fPeople)
  const toggle = (p: string) => setState({ fPeople: fPeople.includes(p as never) ? fPeople.filter((x) => x !== p) : [...fPeople, p as never] })
  return (
    <div className={cn('flex items-center', big ? 'gap-2' : 'gap-0.5 px-1')} role="group" aria-label="Filter by person">
      {PEOPLE.map((p) => {
        const on = fPeople.includes(p.id)
        return big ? (
          <Button key={p.id} variant="secondary" size="lg" aria-pressed={on} className={cn('flex-1 rounded-full pl-1', on && 'bg-foreground/15 ring-1 ring-foreground/25')} onClick={() => toggle(p.id)}><PersonAvatar who={p.id} size={26} />{PERSON[p.id].name}</Button>
        ) : (
          <button key={p.id} aria-pressed={on} title={PERSON[p.id].name} onClick={() => toggle(p.id)} className={cn('grid size-8 place-items-center rounded-full opacity-60 outline-none transition-[opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:opacity-100', on && 'opacity-100')} style={on ? { boxShadow: `0 0 0 2px var(--background), 0 0 0 3.5px var(--p-${p.id})` } : undefined}>
            <PersonAvatar who={p.id} size={24} />
          </button>
        )
      })}
    </div>
  )
}

/** Phone: opens the projects drawer. */
function MenuButton() {
  const { toggleSidebar } = useSidebar()
  return <Button variant="ghost" size="icon" aria-label="Open menu" onClick={toggleSidebar}><MenuIcon /></Button>
}

export function Toolbar() {
  const { title, stat } = useScopeTitle()
  const view = useStore((s) => s.view)
  const group = useStore((s) => s.group)
  const sort = useStore((s) => s.sort)
  const fPeople = useStore((s) => s.fPeople)
  const fPriority = useStore((s) => s.fPriority)
  const q = useStore((s) => s.q)
  const filterCount = fPeople.length + fPriority.length + (q ? 1 : 0)
  const togglePr = (p: Priority) => setState({ fPriority: fPriority.includes(p) ? fPriority.filter((x) => x !== p) : [...fPriority, p] })

  const progress = stat.total ? (
    <span className="flex items-center gap-2.5 text-muted-foreground" title={`${stat.done} of ${stat.total} done`}>
      <span className="h-1 w-18 overflow-hidden rounded-full bg-foreground/10 max-sm:hidden"><span className="block h-full rounded-full bg-foreground/60 transition-[width] duration-500" style={{ width: `${(stat.done / stat.total) * 100}%` }} /></span>
      <span className="tabular-nums text-xs">{stat.done}/{stat.total}</span>
    </span>
  ) : null

  return (
    <header className="flex shrink-0 flex-col gap-3 px-4 pt-3.5 pb-1.5 sm:pl-5">
      <div className="flex min-h-9 items-center gap-3.5">
        <SidebarTrigger className="md:hidden" />
        <h1 className="min-w-0 truncate text-lg leading-tight font-semibold tracking-tight">{title}</h1>
        {progress}
        <span className="grow" />
        <Button onClick={() => openCompose()}><PlusIcon />New task<Kbd className="ml-1 bg-black/8 text-primary-foreground/60">C</Kbd></Button>
      </div>
      <div className="flex min-h-9 items-center gap-3">
        <SegmentedControl aria-label="View" render={<RadioGroupPrimitive value={view} onValueChange={(v: string) => setState({ view: v as ViewKind })} />}>
          {VIEWS.map((v) => (
            <SegmentedControlItem key={v.id} title={`${v.label} (${v.key})`} className="text-muted-foreground data-checked:text-foreground" render={<RadioPrimitive.Root value={v.id} />}><v.icon />{v.label}</SegmentedControlItem>
          ))}
        </SegmentedControl>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <PeopleFilter />
          <Popover>
            <PopoverTrigger render={<Button variant="secondary" size="sm" className={cn(fPriority.length > 0 && 'bg-foreground/12')} aria-label="Filter by priority" />}>
              <SlidersHorizontalIcon />Priority{fPriority.length ? <Badge size="sm" variant="secondary">{fPriority.length}</Badge> : null}
            </PopoverTrigger>
            <PopoverPopup align="start" className="w-auto min-w-44 p-1.5">
              <div role="listbox" aria-multiselectable="true" className="flex flex-col gap-px">
                {PRIORITIES.map((p) => <PickItem key={p.id} active={fPriority.includes(p.id)} onClick={() => togglePr(p.id)}><PriorityIcon priority={p.id} size={18} />{p.label}</PickItem>)}
              </div>
            </PopoverPopup>
          </Popover>
          {view === 'list' ? (
            <Popover>
              <PopoverTrigger render={<Button variant="secondary" size="sm" aria-label="Display options" />}><SlidersHorizontalIcon />Display</PopoverTrigger>
              <PopoverPopup align="start" className="w-auto min-w-44 p-1.5">
                <DisplayOptions group={group} sort={sort} />
              </PopoverPopup>
            </Popover>
          ) : null}
          {filterCount ? <Button variant="ghost" size="sm" onClick={() => setState({ fPeople: [], fPriority: [], q: '' })}>Clear</Button> : null}
        </div>
        <div className="group/search relative ml-auto w-44 transition-[width] duration-300 ease-[var(--ease)] focus-within:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input id="search" type="search" placeholder="Search" value={q} onChange={(e) => setState({ q: e.target.value })} aria-label="Search tasks" onKeyDown={(e) => { if (e.key === 'Escape') { setState({ q: '' }); e.currentTarget.blur() } }} className="h-8 w-full rounded-lg bg-muted pr-8 pl-8 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring" />
          <Kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 group-focus-within/search:hidden">/</Kbd>
        </div>
      </div>
    </header>
  )
}

function DisplayOptions({ group, sort }: { group: GroupBy; sort: SortBy }) {
  return (
    <div className="flex flex-col">
      <div className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">Group by</div>
      <div role="listbox" className="flex flex-col gap-px">{GROUPS.map((g) => <PickItem key={g.id} active={group === g.id} onClick={() => setState({ group: g.id })}>{g.label}</PickItem>)}</div>
      <div className="mt-1.5 border-t px-2.5 pt-2.5 pb-1 text-xs text-muted-foreground">Sort by</div>
      <div role="listbox" className="flex flex-col gap-px">{SORTS.map((g) => <PickItem key={g.id} active={sort === g.id} onClick={() => setState({ sort: g.id })}>{g.label}</PickItem>)}</div>
    </div>
  )
}

/** Phone: filters and display options in one bottom drawer, with big controls. */
export function FilterDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const view = useStore((s) => s.view)
  const group = useStore((s) => s.group)
  const sort = useStore((s) => s.sort)
  const fPriority = useStore((s) => s.fPriority)
  const fPeople = useStore((s) => s.fPeople)
  const q = useStore((s) => s.q)
  const togglePr = (p: Priority) => setState({ fPriority: fPriority.includes(p) ? fPriority.filter((x) => x !== p) : [...fPriority, p] })
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup showBar>
        <DrawerHeader className="flex-row items-center justify-between"><DrawerTitle>Search and filter</DrawerTitle>{fPeople.length + fPriority.length + (q ? 1 : 0) ? <Button variant="ghost" onClick={() => setState({ fPeople: [], fPriority: [], q: '' })}>Clear</Button> : null}</DrawerHeader>
        <DrawerPanel className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="relative mb-5">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <input id="search" type="search" placeholder="Search tasks or keys" value={q} onChange={(e) => setState({ q: e.target.value })} aria-label="Search tasks" enterKeyHint="search" autoComplete="off" className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <p className="mb-2 text-sm text-muted-foreground">Person</p>
          <PeopleFilter big />
          <p className="mt-5 mb-2 text-sm text-muted-foreground">Priority</p>
          <div className="flex flex-wrap gap-2">
            {[...PRIORITIES].reverse().map((p) => (
              <Button key={p.id} variant="secondary" size="lg" aria-pressed={fPriority.includes(p.id)} className={cn(fPriority.includes(p.id) && 'bg-foreground/15 ring-1 ring-foreground/25')} onClick={() => togglePr(p.id)}><PriorityIcon priority={p.id} size={16} />{p.label}</Button>
            ))}
          </div>
          {view === 'list' ? (
            <>
              <p className="mt-5 mb-2 text-sm text-muted-foreground">Group by</p>
              <div className="flex flex-wrap gap-2">{GROUPS.map((g) => <Button key={g.id} variant="secondary" size="lg" className={cn(group === g.id && 'bg-foreground/15 ring-1 ring-foreground/25')} onClick={() => setState({ group: g.id })}>{g.label}</Button>)}</div>
              <p className="mt-5 mb-2 text-sm text-muted-foreground">Sort by</p>
              <div className="flex flex-wrap gap-2">{SORTS.map((g) => <Button key={g.id} variant="secondary" size="lg" className={cn(sort === g.id && 'bg-foreground/15 ring-1 ring-foreground/25')} onClick={() => setState({ sort: g.id })}>{g.label}</Button>)}</div>
            </>
          ) : null}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
