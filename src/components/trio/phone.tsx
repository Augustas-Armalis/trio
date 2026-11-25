import { ChevronDownIcon, PlusIcon, SlidersHorizontalIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { GENERAL_ID } from '@/data/people'
import { openCompose, setMe, setScope, setState, useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { PersonList, PickItem, Picker } from './picker'
import { PersonAvatar, ProjectDot } from './primitives'
import { FilterDrawer, VIEWS, useScopeTitle } from './shell'
import { PencilIcon, RefreshCwIcon } from 'lucide-react'
import { openSync } from './sync'

/**
 * Size the app to what is actually visible. On iOS the on-screen keyboard covers the page without resizing it, so
 * anything pinned to the bottom ends up underneath. The visual viewport knows the real height.
 */
function useAppViewport() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    const set = () => {
      root.style.setProperty('--app-h', `${vv ? vv.height : window.innerHeight}px`)
      root.style.setProperty('--app-top', `${vv ? vv.offsetTop : 0}px`)
    }
    set()
    vv?.addEventListener('resize', set)
    vv?.addEventListener('scroll', set)
    window.addEventListener('resize', set)
    return () => {
      vv?.removeEventListener('resize', set)
      vv?.removeEventListener('scroll', set)
      window.removeEventListener('resize', set)
      root.style.removeProperty('--app-h')
      root.style.removeProperty('--app-top')
    }
  }, [])
}

/** Phone layout: header, content, then a dock you can reach with a thumb. Nothing floats over the content. */
export function PhoneApp({ children }: { children: ReactNode }) {
  useAppViewport()
  // While the full-screen create layer is up, the app behind it can't be tabbed into or read out.
  const composing = useStore((s) => !!s.compose)
  return (
    <div inert={composing} className="fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-background" style={{ height: 'var(--app-h, 100dvh)', transform: 'translateY(var(--app-top, 0px))' }}>
      <PhoneHeader />
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      <PhoneDock />
    </div>
  )
}

function PhoneHeader() {
  const { title, stat } = useScopeTitle()
  const me = useStore((s) => s.me)
  return (
    <header className="flex shrink-0 items-center gap-1 px-3 pt-[max(0.25rem,env(safe-area-inset-top))]">
      <h1 className="m-0 flex min-w-0 flex-1 items-center"><ScopeDrawer title={title} /></h1>
      {stat.total ? <span className="mr-1 text-sm tabular-nums text-muted-foreground" title={`${stat.done} of ${stat.total} done`}>{stat.done}/{stat.total}</span> : null}
      <Picker title="You are" button={{ variant: 'ghost', size: 'icon-lg', className: 'rounded-full', 'aria-label': 'Switch person' }} label={<PersonAvatar who={me} size={32} />} align="end">
        {(close) => <PersonList who={me} onPick={(p) => { if (p) setMe(p); close() }} />}
      </Picker>
    </header>
  )
}

/** The title is the scope switcher: tap it, pick My tasks, All tasks or a project. */
function ScopeDrawer({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const scope = useStore((s) => s.scope)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const me = useStore((s) => s.me)
  const mode = useStore((s) => s.mode)
  const via = useStore((s) => s.via)
  const syncState = mode === 'local' ? 'Sync across devices' : 'Synced'
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    let mine = 0, all = 0
    for (const t of tasks) {
      if (t.status === 'done') continue
      all++
      m.set(t.project, (m.get(t.project) ?? 0) + 1)
      if (me && t.assignees.includes(me)) mine++
    }
    return { m, mine, all }
  }, [tasks, me])
  const go = (sc: Parameters<typeof setScope>[0]) => { setScope(sc); setOpen(false) }
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="ghost" size="xl" className="max-w-[70%] gap-1.5 px-2 text-xl font-semibold tracking-tight" aria-label={`${title}. Change view`} />}>
        <span className="truncate">{title}</span><ChevronDownIcon className="size-5 shrink-0 opacity-60" />
      </DrawerTrigger>
      <DrawerPopup showBar>
        <DrawerHeader><DrawerTitle>Show</DrawerTitle></DrawerHeader>
        <DrawerPanel className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div role="listbox" className="flex flex-col gap-px">
            <PickItem active={scope.kind === 'mine'} hint={counts.mine || undefined} onClick={() => go({ kind: 'mine' })}>My tasks</PickItem>
            <PickItem active={scope.kind === 'all'} hint={counts.all || undefined} onClick={() => go({ kind: 'all' })}>All tasks</PickItem>
            <p className="px-3 pt-4 pb-1 text-sm text-muted-foreground">Projects</p>
            <PickItem active={scope.kind === 'project' && scope.id === GENERAL_ID} hint={counts.m.get(GENERAL_ID) || undefined} onClick={() => go({ kind: 'project', id: GENERAL_ID })}>
              <span className="grid size-6 shrink-0 place-items-center"><ProjectDot hue={null} size={10} /></span>General
            </PickItem>
            {projects.map((p) => (
              <div key={p.id} className="flex items-center">
                <div className="min-w-0 flex-1">
                  <PickItem active={scope.kind === 'project' && scope.id === p.id} hint={counts.m.get(p.id) || undefined} onClick={() => go({ kind: 'project', id: p.id })}>
                    <span className="grid size-6 shrink-0 place-items-center"><ProjectDot hue={p.hue} size={10} /></span><span className="truncate">{p.name}</span>
                  </PickItem>
                </div>
                <Button variant="ghost" size="icon-lg" aria-label={`Edit ${p.name}`} onClick={() => { setOpen(false); setState({ projectDialog: { mode: 'edit', id: p.id } }) }}><PencilIcon /></Button>
              </div>
            ))}
            <div className="my-1 h-px bg-border" />
            <PickItem onClick={() => { setOpen(false); setState({ projectDialog: { mode: 'new' } }) }}><PlusIcon className="size-5" />New project</PickItem>
            <PickItem onClick={() => { setOpen(false); openSync() }}><span className="grid size-6 shrink-0 place-items-center"><RefreshCwIcon className="size-5 text-muted-foreground" /></span>{syncState}</PickItem>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

/** The dock: views, filter and the big plus, all within thumb reach. */
function PhoneDock() {
  const view = useStore((s) => s.view)
  const active = useStore((s) => s.fPeople.length + s.fPriority.length + (s.q ? 1 : 0))
  const [filters, setFilters] = useState(false)
  const tab = 'relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium outline-none transition-colors active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <nav aria-label="Views" className="shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-0.5 px-2 py-1.5">
        {VIEWS.map((v) => {
          const on = view === v.id
          return (
            <button key={v.id} aria-current={on ? 'page' : undefined} onClick={() => setState({ view: v.id })} className={cn(tab, 'min-w-0 flex-1', on ? 'text-foreground' : 'text-muted-foreground')}>
              {on ? <motion.span layoutId="dock-pill" className="absolute inset-x-1.5 inset-y-0.5 -z-10 rounded-xl bg-foreground/10" transition={{ type: 'spring', stiffness: 420, damping: 36 }} /> : null}
              <v.icon className="size-5.5" />{v.label}
            </button>
          )
        })}
        <button aria-label="Search and filter" onClick={() => setFilters(true)} className={cn(tab, 'w-16 shrink-0', active ? 'text-foreground' : 'text-muted-foreground')}>
          <span className="relative"><SlidersHorizontalIcon className="size-5.5" />{active ? <Badge size="sm" className="absolute -top-1.5 -right-2.5 rounded-full">{active}</Badge> : null}</span>Filter
        </button>
        <Button size="icon-xl" aria-label="New task" className="ml-1 size-12 shrink-0 rounded-2xl" onClick={() => openCompose()}><PlusIcon className="size-6" /></Button>
      </div>
      <FilterDrawer open={filters} onOpenChange={setFilters} />
    </nav>
  )
}
