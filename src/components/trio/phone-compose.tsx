import { ArrowUpIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Person, Priority, Status } from '@/types'
import { GENERAL_ID } from '@/data/people'
import { closeCompose, createTask, getState, openTask, toast, useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { DrawerClose, DrawerTitle } from '@/components/ui/drawer'
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker } from './picker'
import { AddImageButton, ImageStrip, LinkChips, TaskText, useImages } from './taskText'

/**
 * Phone create sheet. The text is the whole screen. Everything you can set is one row of value pills right above the
 * keyboard (each opens a big-row drawer), and the send button is the last thing under your thumb.
 */
export function PhoneCompose() {
  const init = useStore((s) => s.compose)!
  const me = useStore((s) => s.me)
  const scope = useStore((s) => s.scope)
  const [body, setBody] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [assignee, setAssignee] = useState<Person | null>(init.assignee === undefined ? me : init.assignee)
  const [due, setDue] = useState<string | null>(init.due ?? null)
  const [priority, setPriority] = useState<Priority>(init.priority ?? 'medium')
  const [status, setStatus] = useState<Status>(init.status ?? 'todo')
  const [project, setProject] = useState<string>(init.project ?? (scope.kind === 'project' ? scope.id : GENERAL_ID))
  const { add, busy } = useImages(images, setImages)
  const canCreate = (body.trim().length > 0 || images.length > 0) && !busy

  const submit = () => {
    if (!canCreate) return
    const id = createTask({ body: body.trim() || 'Image', project, status, priority, assignee, due, images })
    const key = getState().tasks.find((t) => t.id === id)?.key
    navigator.vibrate?.(8)
    closeCompose()
    toast(key ? `${key} created` : 'Task created', { label: 'Open', run: () => openTask(id) })
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DrawerTitle className="sr-only">New task</DrawerTitle>
      <div className="flex shrink-0 items-center justify-between px-2 pt-1">
        <DrawerClose render={<Button variant="ghost" size="icon-lg" aria-label="Close" />}><XIcon /></DrawerClose>
        <span className="text-sm text-muted-foreground">New task</span>
        <span className="size-10" />
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pt-2 pb-4">
        <TaskText big autoFocus value={body} onChange={setBody} onFiles={add} />
        <ImageStrip images={images} onRemove={(i) => setImages(images.filter((_, j) => j !== i))} />
        <LinkChips text={body} />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t bg-popover px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="no-scrollbar flex min-w-0 flex-1 touch-pan-x items-center gap-2 overflow-x-auto py-0.5" role="toolbar" aria-label="Task details">
          <AssigneePicker pill who={assignee} onPick={setAssignee} />
          <DuePicker pill due={due} onPick={setDue} />
          <PriorityPicker pill priority={priority} onPick={setPriority} />
          <ProjectPicker pill project={project} onPick={setProject} />
          <StatusPicker pill status={status} progress={0} onPick={setStatus} />
          <AddImageButton pill onFiles={add} busy={busy > 0} />
        </div>
        <Button size="icon-xl" aria-label="Create task" disabled={!canCreate} onClick={submit} className="size-12 shrink-0 rounded-full"><ArrowUpIcon className="size-5" /></Button>
      </div>
    </div>
  )
}
