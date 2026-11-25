import { CheckIcon, Trash2Icon, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { clearSelection, deleteTasks, getState, moveTasksToProject, selectMany, setStatus, updateTasks, useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { PersonList, Picker, PriorityList, ProjectList, StatusList, DueEditor, useIsPhone } from './picker'

const EASE = [0.16, 1, 0.3, 1] as const

/** Desktop only: a floating bar that acts on every ticked task at once. */
export function BulkBar() {
  const phone = useIsPhone()
  const selected = useStore((s) => s.selected)
  const n = selected.length
  const show = n > 0 && !phone
  // Selections die with the tasks they point at (deleted elsewhere, synced away).
  const tasks = useStore((s) => s.tasks)
  useEffect(() => {
    const live = selected.filter((id) => tasks.some((t) => t.id === id))
    if (live.length !== selected.length) selectMany(live)
  }, [tasks, selected])

  const doneAll = () => {
    const ids = getState().selected
    for (const id of ids) setStatus(id, 'done')
    clearSelection()
  }
  const btn = { variant: 'ghost', size: 'sm' } as const
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="bulk" role="toolbar" aria-label={`${n} selected`}
          className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center"
          initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97, transition: { duration: 0.14 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
        >
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/10">
            <span className="px-2.5 text-sm tabular-nums"><b className="font-medium">{n}</b> <span className="text-muted-foreground">selected</span></span>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <Button {...btn} onClick={doneAll}><CheckIcon />Done</Button>
            <Picker title="Status" side="top" label="Status" button={btn}>
              {(close) => <StatusList status={null} onPick={(s) => { for (const id of getState().selected) setStatus(id, s); close(); clearSelection() }} />}
            </Picker>
            <Picker title="Priority" side="top" label="Priority" button={btn}>
              {(close) => <PriorityList priority={null} onPick={(p) => { updateTasks(getState().selected, () => ({ priority: p })); close(); clearSelection() }} />}
            </Picker>
            <Picker title="Assign to" side="top" label="Assign" button={btn}>
              {(close) => <PersonList who={null} onPick={(p) => { updateTasks(getState().selected, () => ({ assignee: p })); close(); clearSelection() }} />}
            </Picker>
            <Picker title="Due date" side="top" label="Due" button={btn} popClassName="p-0 [&>div]:p-1.5">
              {(close) => <DueEditor due={null} onPick={(d) => { updateTasks(getState().selected, () => ({ due: d })); close(); clearSelection() }} />}
            </Picker>
            <Picker title="Move to project" side="top" label="Move" button={btn}>
              {(close) => <ProjectList project="" onPick={(id) => { moveTasksToProject(getState().selected, id); close(); clearSelection() }} />}
            </Picker>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <Button {...btn} className="text-destructive-foreground" onClick={() => deleteTasks(getState().selected)}><Trash2Icon />Delete</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" title="Clear (Esc)" onClick={clearSelection}><XIcon /></Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
