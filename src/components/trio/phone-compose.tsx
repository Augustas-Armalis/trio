import { ArrowUpIcon, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Person, Priority, Status } from '@/types'
import { GENERAL_ID } from '@/data/people'
import { closeCompose, createTask, getState, openCompose, openTask, toast, useStore, type ComposeInit } from '@/data/store'
import { Button } from '@/components/ui/button'
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker } from './picker'
import { AddImageButton, ImageStrip, LinkChips, TaskText, useImages } from './taskText'

/**
 * The create screen on a phone is a full-screen layer pinned to the *visible* viewport, so when the keyboard opens the
 * layer shrinks above it: the text takes the space that is left and the property pills stay right above the keys.
 */
export function PhoneComposeLayer({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="compose" role="dialog" aria-modal="true" aria-label="New task"
          className="fixed inset-x-0 z-40 flex flex-col overflow-hidden bg-background"
          style={{ top: 'var(--app-top, 0px)', height: 'var(--app-h, 100dvh)' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }}
          transition={{ type: 'spring', stiffness: 420, damping: 44 }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function PhoneCompose({ init }: { init: ComposeInit }) {
  const me = useStore((s) => s.me)
  const scope = useStore((s) => s.scope)
  const [body, setBody] = useState(init.body ?? '')
  const [images, setImages] = useState<string[]>([])
  const [assignee, setAssignee] = useState<Person | null>(init.assignee === undefined ? me : init.assignee)
  const [due, setDue] = useState<string | null>(init.due ?? null)
  const [priority, setPriority] = useState<Priority>(init.priority ?? 'medium')
  const [status, setStatus] = useState<Status>(init.status ?? 'todo')
  const [project, setProject] = useState<string>(init.project ?? (scope.kind === 'project' ? scope.id : GENERAL_ID))
  const { add, busy } = useImages(images, setImages)
  const canCreate = (body.trim().length > 0 || images.length > 0) && !busy
  const sent = useRef(false)

  const submit = () => {
    if (!canCreate) return
    sent.current = true
    const id = createTask({ body: body.trim() || 'Image', project, status, priority, assignee, due, images })
    const key = getState().tasks.find((t) => t.id === id)?.key
    navigator.vibrate?.(8)
    closeCompose()
    toast(key ? `${key} created` : 'Task created', { label: 'Open', run: () => openTask(id) })
  }
  /** Closing never throws typing away: say so, and offer to bring it back. */
  const close = () => {
    const text = body.trim()
    closeCompose()
    if (text && !sent.current) toast('Draft discarded', { label: 'Undo', run: () => openCompose({ ...init, body: text, assignee, due, priority, status, project }) })
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() }
      else if (e.key === 'Escape' && !document.querySelector('[data-slot="drawer-popup"]')) close()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon-lg" aria-label="Close" onClick={close}><XIcon /></Button>
        <h2 className="m-0 text-base font-medium">New task</h2>
        <Button size="lg" disabled={!canCreate} onClick={submit} className="min-w-20 rounded-full" aria-label="Create task">Create</Button>
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pt-3 pb-4">
        <TaskText big autoFocus value={body} onChange={setBody} onFiles={add} />
        <ImageStrip images={images} onRemove={(i) => setImages(images.filter((_, j) => j !== i))} />
        <LinkChips text={body} />
      </div>
      <div className="shrink-0 border-t bg-popover px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Task details">
          <AssigneePicker pill who={assignee} onPick={setAssignee} />
          <DuePicker pill due={due} onPick={setDue} />
          <PriorityPicker pill priority={priority} onPick={setPriority} />
          <ProjectPicker pill project={project} onPick={setProject} />
          <StatusPicker pill status={status} progress={0} onPick={setStatus} />
          <AddImageButton pill onFiles={add} busy={busy > 0} />
        </div>
      </div>
    </div>
  )
}
