import { MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'
import { openCompose, setState, useStore, useVisibleTasks } from '@/data/store'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ToastProvider } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BoardView } from '@/components/trio/board'
import { CalendarView } from '@/components/trio/calendar'
import { ListSkeleton, ListView } from '@/components/trio/list'
import { ActionsDrawer } from '@/components/trio/parts'
import { PhoneApp } from '@/components/trio/phone'
import { useIsPhone } from '@/components/trio/picker'
import { AppSidebar, Toolbar } from '@/components/trio/shell'
import { Compose, Lightbox, ProjectDialog, TaskSheet, WhoAreYou } from '@/components/trio/surfaces'

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      // Only real modal surfaces block shortcuts (a toast is also role="dialog", so match by slot).
      if (document.querySelector('[data-slot="dialog-popup"], [data-slot="sheet-popup"], [data-slot="drawer-popup"], [role="menu"]')) return
      if (e.key === 'c') { e.preventDefault(); openCompose() }
      else if (e.key === '/') { e.preventDefault(); document.getElementById('search')?.focus() }
      else if (e.key === '1') setState({ view: 'list' })
      else if (e.key === '2') setState({ view: 'board' })
      else if (e.key === '3') setState({ view: 'calendar' })
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
        <WhoAreYou />
        <ToastProvider position="bottom-center" />
      </TooltipProvider>
    </MotionConfig>
  )
}
