import { MotionConfig, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import {
  clearSelection, closePalette, deleteTask, deleteTasks, getState, openCompose, openPalette, openTask, selectMany, setState, targetTaskId,
  toggleDone, useStore, useTaskOrder, useVisibleTasks,
} from '@/data/store'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ToastProvider } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BoardView } from '@/components/trio/board'
import { BulkBar } from '@/components/trio/bulk'
import { CalendarView } from '@/components/trio/calendar'
import { ListSkeleton, ListView } from '@/components/trio/list'
import { ActionsDrawer } from '@/components/trio/parts'
import { CommandPalette, ShortcutsDialog } from '@/components/trio/palette'
import { PhoneApp } from '@/components/trio/phone'
import { useIsPhone } from '@/components/trio/picker'
import { AppSidebar, Toolbar } from '@/components/trio/shell'
import { SyncDialog } from '@/components/trio/sync'
import { Compose, Lightbox, ProjectDialog, TaskSheet, WhoAreYou } from '@/components/trio/surfaces'

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

const MODAL = '[data-slot="dialog-popup"], [data-slot="command-dialog-popup"], [data-slot="drawer-popup"], [data-slot="popover-popup"], [role="menu"]'

/** Move focus to the next/previous task row or card on screen. */
function stepFocus(dir: 1 | -1) {
  const els = [...document.querySelectorAll<HTMLElement>('[data-open-task]')].filter((el) => el.offsetParent !== null)
  if (!els.length) return
  const i = els.indexOf(document.activeElement as HTMLElement)
  const next = els[i === -1 ? (dir === 1 ? 0 : els.length - 1) : Math.min(els.length - 1, Math.max(0, i + dir))]
  next.focus()
  next.scrollIntoView({ block: 'nearest' })
}

function useShortcuts() {
  const order = useTaskOrder()
  const ref = useRef(order)
  ref.current = order
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (getState().palette) closePalette()
        else if (!document.querySelector('[data-slot="drawer-popup"]')) openPalette('root', targetTaskId())
        return
      }
      if (e.altKey || typing(e.target)) return
      if (document.querySelector(MODAL)) return
      const s = getState()
      const inSheet = !!document.querySelector('[data-slot="sheet-popup"]')
      if (mod) {
        if (e.key.toLowerCase() === 'a' && !inSheet) { e.preventDefault(); selectMany(ref.current) }
        else if (e.key === 'Backspace') {
          const t = getState().selected.length ? null : targetTaskId()
          if (getState().selected.length) { e.preventDefault(); deleteTasks(getState().selected) }
          else if (t) { e.preventDefault(); deleteTask(t) }
        }
        return
      }
      const target = targetTaskId()
      const k = e.key
      // Task keys work with the sheet open and with a row focused.
      if (k === 'j' || k === 'ArrowDown' || k === 'k' || k === 'ArrowUp') {
        const dir = k === 'j' || k === 'ArrowDown' ? 1 : -1
        if (s.openTaskId) {
          const i = ref.current.indexOf(s.openTaskId)
          const next = ref.current[i + dir]
          if (next) { e.preventDefault(); openTask(next) }
        } else if ((k === 'j' || k === 'k') || document.activeElement === document.body || (document.activeElement as HTMLElement | null)?.hasAttribute('data-open-task')) {
          e.preventDefault(); stepFocus(dir)
        }
        return
      }
      if (k === 'Escape' && s.selected.length && !inSheet) { clearSelection(); return }
      if (k === 'Delete' && (s.selected.length || target) && !inSheet) {
        e.preventDefault()
        if (s.selected.length) deleteTasks(s.selected)
        else if (target) deleteTask(target)
        return
      }
      if (k === 'Delete' && target && inSheet) { e.preventDefault(); deleteTask(target); return }
      if (k === '?') { e.preventDefault(); setState({ shortcutsOpen: true }); return }
      if (target) {
        const page = ({ s: 'status', p: 'priority', a: 'assignee', d: 'due', m: 'project' } as const)[k as 's']
        if (page) { e.preventDefault(); openPalette(page, target); return }
        if (k === 'x') { e.preventDefault(); toggleDone(target); return }
      }
      if (inSheet) return
      if (k === 'c') { e.preventDefault(); openCompose() }
      else if (k === '/') { e.preventDefault(); document.getElementById('search')?.focus() }
      else if (k === '1') setState({ view: 'list' })
      else if (k === '2') setState({ view: 'board' })
      else if (k === '3') setState({ view: 'calendar' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function Views() {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const filters = useStore((s) => s.fPeople.length + s.fPriority.length + (s.q ? 1 : 0))
  const tasks = useVisibleTasks()
  if (!ready) return <ListSkeleton />
  return (
    <motion.div key={view} className="h-full" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
      {view === 'list' ? <ListView tasks={tasks} filtered={filters > 0} /> : null}
      {view === 'board' ? <BoardView tasks={tasks} filtered={filters > 0} /> : null}
      {view === 'calendar' ? <CalendarView tasks={tasks} /> : null}
    </motion.div>
  )
}

export function App() {
  const phone = useIsPhone()
  const view = useStore((s) => s.view)
  useShortcuts()
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        {phone ? (
          <PhoneApp><Views /></PhoneApp>
        ) : (
          <SidebarProvider className="h-dvh min-h-0">
            <AppSidebar />
            <SidebarInset className="h-dvh min-h-0 overflow-hidden md:h-[calc(100dvh-1rem)]">
              <Toolbar />
              <div className="relative min-h-0 flex-1 overflow-hidden" data-view={view}><Views /></div>
            </SidebarInset>
          </SidebarProvider>
        )}
        <TaskSheet />
        <Compose />
        <ActionsDrawer />
        <ProjectDialog />
        <Lightbox />
        <CommandPalette />
        <ShortcutsDialog />
        <BulkBar />
        <SyncDialog />
        <WhoAreYou />
        <ToastProvider position="bottom-center" />
      </TooltipProvider>
    </MotionConfig>
  )
}
