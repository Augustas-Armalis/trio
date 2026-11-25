import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, Trash2Icon, XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Person, Priority, Status, Task } from '@/types'
import { GENERAL_ID, PEOPLE, PERSON, PRIORITIES } from '@/data/people'
import { closeCompose, closeTask, createTask, deleteTask, getState, createProject, deleteProject, moveTasksToProject, openTask, projectName, updateProject, setMe, setProgress, setScope, setState, setStatus, toggleDone, titleOf, toast, updateTask, useStore, useTaskOrder } from '@/data/store'
import { dueLabel, timeAgo } from '@/lib/dates'
import { PRESETS } from '@/lib/presets'
import { cn, } from '@/lib/utils'
import { debounce } from '@/lib/util'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerFooter, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { CODE_RE, GENERAL_CODE, deriveCode } from '@/lib/keys'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetPopup, SheetTitle } from '@/components/ui/sheet'
import { Calendar } from '@/components/ui/calendar'
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker, useIsPhone } from './picker'
import { TaskMenu } from './parts'
import { PhoneCompose } from './phone-compose'
import { PersonAvatar, PriorityIcon, StatusIcon } from './primitives'
import { AddImageButton, ImageStrip, LinkChips, TaskText, useImages } from './taskText'
import { parseYmd, ymd } from '@/lib/dates'

const chipOn = 'bg-foreground/15 text-foreground ring-1 ring-foreground/25 hover:bg-foreground/20'

/* ================================================================== create */

export function Compose() {
  const init = useStore((s) => s.compose)
  const phone = useIsPhone()
  const onOpenChange = (o: boolean) => { if (!o) closeCompose() }
  if (phone) {
    return (
      <Drawer open={!!init} onOpenChange={onOpenChange}>
        <DrawerPopup showBar className="h-[min(94dvh,var(--app-h,100dvh),46rem)]">
          {init ? <PhoneCompose key={JSON.stringify(init)} /> : null}
        </DrawerPopup>
      </Drawer>
    )
  }
  return (
    <Dialog open={!!init} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-xl" aria-label="New task">
        {init ? <ComposeBody key={JSON.stringify(init)} /> : null}
      </DialogPopup>
    </Dialog>
  )
}

function ComposeBody({ phone }: { phone?: boolean }) {
  const init = useStore((s) => s.compose)!
  const me = useStore((s) => s.me)
  const scope = useStore((s) => s.scope)
  const now = useStore((s) => s.today)
  const [body, setBody] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [assignee, setAssignee] = useState<Person | null>(init.assignee === undefined ? me : init.assignee)
  const [due, setDue] = useState<string | null>(init.due ?? null)
  const [priority, setPriority] = useState<Priority>(init.priority ?? 'medium')
  const [status, setStatusState] = useState<Status>(init.status ?? 'todo')
  const [project, setProject] = useState<string>(init.project ?? (scope.kind === 'project' ? scope.id : GENERAL_ID))
  const { add, busy } = useImages(images, setImages)
  const presets = useMemo(() => PRESETS(now), [now])
  const custom = due && !presets.some((p) => p.date === due)
  const canCreate = (body.trim().length > 0 || images.length > 0) && !busy

  const submit = () => {
    if (!canCreate) return
    const id = createTask({ body: body.trim() || 'Image', project, status, priority, assignee, due, images })
    const key = getState().tasks.find((t) => t.id === id)?.key
    closeCompose()
    toast(key ? `${key} created` : 'Task created', { label: 'Open', run: () => openTask(id) })
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const Head = phone ? DrawerHeader : DialogHeader
  const Panel = phone ? DrawerPanel : DialogPanel
  const Foot = phone ? DrawerFooter : DialogFooter
  const Title = phone ? DrawerTitle : DialogTitle

  const row = 'flex items-center gap-3'
  const scroller = phone ? 'no-scrollbar -mx-6 flex gap-1.5 overflow-x-auto px-6' : 'flex flex-wrap gap-1.5'

  return (
    <>
      <Head className={phone ? 'flex-row items-center gap-2' : undefined}>
        <Title className="sr-only">New task</Title>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ProjectPicker compact project={project} onPick={setProject} />
          <span>›</span><span>New task</span>
        </div>
      </Head>
      <Panel className={phone ? 'pt-2' : undefined}>
        <TaskText big autoFocus value={body} onChange={setBody} onFiles={add} />
        <ImageStrip images={images} onRemove={(i) => setImages(images.filter((_, j) => j !== i))} />
        <LinkChips text={body} />

        <div className="mt-6 flex flex-col gap-3">
          <div className={row}>
            <span className="w-14 shrink-0 text-sm text-muted-foreground">For</span>
            <div className={scroller} role="radiogroup" aria-label="Assign to">
              {PEOPLE.map((p) => (
                <Button
                  key={p.id} role="radio" aria-checked={assignee === p.id} variant="secondary" size="lg" className={cn('shrink-0 rounded-full pl-1', assignee === p.id && chipOn)}
                  style={assignee === p.id ? { boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--p-${p.id}) 60%, transparent)`, background: `color-mix(in oklab, var(--p-${p.id}) 16%, #232326)` } : undefined}
                  onClick={() => setAssignee(assignee === p.id ? null : p.id)}
                >
                  <PersonAvatar who={p.id} size={24} />{PERSON[p.id].name}
                </Button>
              ))}
            </div>
          </div>
          <div className={row}>
            <span className="w-14 shrink-0 text-sm text-muted-foreground">Due</span>
            <div className={scroller} role="radiogroup" aria-label="Due date">
              {presets.map((p) => (
                <Button key={p.label} role="radio" aria-checked={due === p.date} variant="secondary" size="lg" className={cn('shrink-0', due === p.date && chipOn)} onClick={() => setDue(due === p.date ? null : p.date)}>{p.label}</Button>
              ))}
              <Popover>
                <PopoverTrigger render={<Button variant="secondary" size="lg" className={cn('shrink-0', custom && chipOn)} aria-label="Pick a date" />}>
                  <CalendarIcon />{custom ? dueLabel(due!, now) : 'Pick date'}
                </PopoverTrigger>
                <PopoverPopup align="start" className="w-auto p-2" side={phone ? 'top' : 'bottom'}>
                  <Calendar mode="single" weekStartsOn={1} selected={due ? parseYmd(due) : undefined} defaultMonth={due ? parseYmd(due) : parseYmd(now)} onSelect={(d) => d && setDue(ymd(d))} />
                </PopoverPopup>
              </Popover>
            </div>
          </div>
          <div className={row}>
            <span className="w-14 shrink-0 text-sm text-muted-foreground">Priority</span>
            <div className={scroller} role="radiogroup" aria-label="Priority">
              {[...PRIORITIES].reverse().map((p) => (
                <Button
                  key={p.id} role="radio" aria-checked={priority === p.id} variant="secondary" size="lg"
                  className={cn('shrink-0', priority === p.id && (p.id === 'urgent' ? 'bg-destructive/16 text-destructive-foreground ring-1 ring-destructive/40' : chipOn))}
                  onClick={() => setPriority(p.id)}
                >
                  <PriorityIcon priority={p.id} size={16} />{p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <Foot variant={phone ? undefined : 'default'} className={phone ? 'flex-row items-center gap-2 px-6 pt-3' : undefined}>
        <StatusPicker status={status} progress={0} onPick={setStatusState} />
        <span className="grow" />
        <AddImageButton onFiles={add} busy={busy > 0} label={phone ? 'Image' : 'Add image'} />
        <Button onClick={submit} disabled={!canCreate} size={phone ? 'lg' : 'default'}>Create task {phone ? null : <Kbd>⌘↵</Kbd>}</Button>
      </Foot>
    </>
  )
}

/* ================================================================== task detail */

export function TaskSheet() {
  const id = useStore((s) => s.openTaskId)
  const ready = useStore((s) => s.ready)
  const task = useStore((s) => (s.openTaskId ? s.tasks.find((t) => t.id === s.openTaskId) ?? null : null))
  const phone = useIsPhone()
  const last = useRef<Task | null>(null)
  if (task) last.current = task
  const shown = task ?? (last.current && last.current.id === id ? last.current : null)
  useEffect(() => { if (id && ready && !task) closeTask() }, [id, ready, task])
  const onOpenChange = (o: boolean) => { if (!o) closeTask() }
  if (phone) {
    return (
      <Drawer open={!!id} onOpenChange={onOpenChange}>
        <DrawerPopup showBar className="h-[min(96dvh,var(--app-h,100dvh),52rem)]">
          {shown ? <DetailBody key={shown.id} task={shown} phone /> : null}
        </DrawerPopup>
      </Drawer>
    )
  }
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetPopup side="right" variant="inset" className="outline-none focus-visible:outline-none sm:max-w-lg" showCloseButton={false} aria-label="Task details">
        {shown ? <DetailBody key={shown.id} task={shown} /> : null}
      </SheetPopup>
    </Sheet>
  )
}

function DetailBody({ task, phone }: { task: Task; phone?: boolean }) {
  const projects = useStore((s) => s.projects)
  const [body, setBody] = useState(task.body)
  const dirty = useRef(false)
  const save = useMemo(() => debounce((b: string) => { updateTask(task.id, { body: b }); dirty.current = false }, 450), [task.id])
  useEffect(() => () => save.flush(), [save])
  // Take other people's edits while we are not typing.
  useEffect(() => { if (!dirty.current && task.body !== body) setBody(task.body) }, [task.body]) // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (b: string) => { dirty.current = true; setBody(b); save(b) }
  const { add, busy } = useImages(task.images, (imgs) => updateTask(task.id, { images: imgs }))
  const Title = phone ? DrawerTitle : SheetTitle
  const order = useTaskOrder()
  const pos = order.indexOf(task.id)
  const prev = pos > 0 ? order[pos - 1] : null
  const next = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null
  const isDone = task.status === 'done'

  return (
    <motion.div className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <Title className="sr-only">{titleOf(task)}</Title>
      <div className="flex shrink-0 items-center gap-1 px-4 pt-3 pb-1 sm:px-5">
        <span className="text-sm text-muted-foreground">{projectName(projects, task.project)}</span>
        <span className="text-muted-foreground/50">›</span>
        <button
          type="button" title="Copy key" aria-label={`Copy ${task.key}`}
          onClick={() => { navigator.clipboard?.writeText(task.key).then(() => toast(`Copied ${task.key}`), () => undefined) }}
          className="inline-flex h-8 items-center rounded-md px-1.5 text-sm font-medium text-foreground/80 outline-none transition-colors active:bg-accent focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-accent"
        >{task.key}</button>
        <span className="grow" />
        {pos >= 0 ? <span className="mr-1 text-xs tabular-nums text-muted-foreground max-sm:hidden">{pos + 1} / {order.length}</span> : null}
        <Button variant="ghost" size={phone ? 'icon-xl' : 'icon-sm'} aria-label="Previous task" title="Previous (K)" disabled={!prev} onClick={() => prev && openTask(prev)}><ChevronUpIcon /></Button>
        <Button variant="ghost" size={phone ? 'icon-xl' : 'icon-sm'} aria-label="Next task" title="Next (J)" disabled={!next} onClick={() => next && openTask(next)}><ChevronDownIcon /></Button>
        {phone ? <TaskMenu task={task} /> : (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={() => toggleDone(task.id)} title={isDone ? 'Reopen (X)' : 'Mark done (X)'}><CheckIcon />{isDone ? 'Reopen' : 'Done'}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete task" title="Delete (⌫)" onClick={() => deleteTask(task.id)}><Trash2Icon /></Button>
            <TaskMenu task={task} className="opacity-100" />
            <Button variant="ghost" size="icon-sm" aria-label="Close" title="Close (Esc)" onClick={closeTask}><XIcon /></Button>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pt-3 pb-8 sm:px-6 [&_textarea]:touch-auto">
        <TaskText big value={body} onChange={edit} onFiles={add} />
        <ImageStrip images={task.images} onRemove={(i) => updateTask(task.id, { images: task.images.filter((_, j) => j !== i) })} />
        <LinkChips text={body} />
        <div className="mt-3 -ml-3"><AddImageButton onFiles={add} busy={busy > 0} /></div>

        <dl className="mt-5 flex flex-col gap-0.5 border-t pt-3">
          <Prop label="Status"><StatusPicker status={task.status} progress={task.progress} onPick={(s) => setStatus(task.id, s)} /></Prop>
          <Prop label="Progress"><Progress value={task.progress} onChange={(p) => setProgress(task.id, p)} /></Prop>
          <Prop label="Priority"><PriorityPicker priority={task.priority} onPick={(p) => updateTask(task.id, { priority: p })} /></Prop>
          <Prop label="For"><AssigneePicker who={task.assignee} onPick={(p) => updateTask(task.id, { assignee: p })} /></Prop>
          <Prop label="Due"><DuePicker due={task.due} done={task.status === 'done'} onPick={(d) => updateTask(task.id, { due: d })} /></Prop>
          <Prop label="Project"><ProjectPicker project={task.project} onPick={(p) => updateTask(task.id, { project: p })} /></Prop>
        </dl>
      </div>
      {phone ? (
        <div className="flex shrink-0 gap-2 border-t bg-popover px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button size="icon-xl" variant="secondary" aria-label="Delete task" onClick={() => deleteTask(task.id)}><Trash2Icon /></Button>
          <Button size="xl" variant={task.status === 'done' ? 'secondary' : 'default'} className="min-w-0 flex-1" onClick={() => { navigator.vibrate?.(8); toggleDone(task.id) }}>
            <StatusIcon status={task.status === 'done' ? 'todo' : 'done'} size={20} />{task.status === 'done' ? 'Reopen' : 'Mark done'}
          </Button>
        </div>
      ) : null}
      <div className="shrink-0 border-t bg-muted/50 px-5 py-2.5 text-xs text-muted-foreground sm:px-6 sm:py-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {task.createdBy ? `Created by ${PERSON[task.createdBy].name}` : 'Created'} · {timeAgo(task.createdAt)}
        {task.updatedAt > task.createdAt + 60000 ? ` · edited ${timeAgo(task.updatedAt)}` : ''}
      </div>
    </motion.div>
  )
}

const Prop = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid min-h-12 grid-cols-[5.5rem_minmax(0,1fr)] items-center sm:min-h-9"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="-ml-2 min-w-0">{children}</dd></div>
)

/** Four quarters. Tap a quarter to fill up to it; tap the last filled one again to step back. */
function Progress({ value, onChange }: { value: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center gap-3 pl-2" role="group" aria-label="Progress">
      <div className="flex w-44 gap-1">
        {[25, 50, 75, 100].map((p, i) => {
          const filled = value >= p
          return (
            <button key={p} type="button" aria-label={`${p}%`} aria-pressed={filled} onClick={() => onChange(value === p ? i * 25 : p)} className="group/seg relative h-9 flex-1 outline-none sm:h-7">
              <span className={cn('absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/10 transition-colors duration-200', filled && (value === 100 ? 'bg-foreground' : 'bg-[var(--amber)]'))} />
            </button>
          )
        })}
      </div>
      <span className="min-w-9 tabular-nums text-xs text-muted-foreground">{value}%</span>
    </div>
  )
}

/* ================================================================== projects */

export function ProjectDialog() {
  const d = useStore((s) => s.projectDialog)
  return (
    <Dialog open={!!d} onOpenChange={(o) => { if (!o) setState({ projectDialog: null }) }}>
      <DialogPopup className="sm:max-w-md">{d ? <ProjectBody key={d.mode === 'edit' ? d.id : 'new'} /> : null}</DialogPopup>
    </Dialog>
  )
}

function ProjectBody() {
  const d = useStore((s) => s.projectDialog)!
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const edit = d.mode === 'edit' ? projects.find((p) => p.id === d.id) : null
  const [name, setName] = useState(edit?.name ?? '')
  const [code, setCode] = useState(edit?.code ?? '')
  const [codeTouched, setCodeTouched] = useState(!!edit)
  const shownCode = codeTouched ? code : deriveCode(name || 'Project')
  const codeTaken = shownCode === GENERAL_CODE || projects.some((p) => p.id !== edit?.id && p.code === shownCode)
  const codeOk = CODE_RE.test(shownCode) && !codeTaken
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const movable = useMemo(() => tasks.filter((t) => t.project === GENERAL_ID && t.status !== 'done').slice(0, 200), [tasks])
  const count = edit ? tasks.filter((t) => t.project === edit.id).length : 0
  const close = () => setState({ projectDialog: null })
  const submit = () => {
    if (!name.trim() || !codeOk) return
    if (edit) { updateProject(edit.id, { name, code: shownCode }); return close() }
    const id = createProject(name, shownCode)
    if (picked.size) moveTasksToProject([...picked], id)
    setScope({ kind: 'project', id })
    close()
  }
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader><DialogTitle>{edit ? 'Edit project' : 'New project'}</DialogTitle></DialogHeader>
      <DialogPanel>
        <label htmlFor="pname" className="mb-1.5 block text-sm text-muted-foreground">Name</label>
        <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website relaunch" autoFocus maxLength={60} autoComplete="off" size="lg" />
        <label htmlFor="pcode" className="mt-4 mb-1.5 block text-sm text-muted-foreground">Code <span className="opacity-60">for issue keys</span></label>
        <div className="flex items-center gap-3">
          <Input id="pcode" value={shownCode} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)); setCodeTouched(true) }} maxLength={5} autoComplete="off" autoCapitalize="characters" spellCheck={false} size="lg" className="w-28 tabular-nums uppercase" aria-invalid={!codeOk} />
          <span className={cn('text-sm', codeOk ? 'text-muted-foreground' : 'text-destructive-foreground')}>
            {codeOk ? `New tasks get ${shownCode}-1, ${shownCode}-2…` : codeTaken ? 'That code is already used.' : 'Use 2 to 5 letters or numbers, starting with a letter.'}
          </span>
        </div>
        {!edit && movable.length ? (
          <>
            <div className="mt-5 mb-1.5 flex justify-between text-sm text-muted-foreground"><span>Add existing tasks <em className="not-italic opacity-60">optional</em></span>{picked.size ? <span>{picked.size} selected</span> : null}</div>
            <div className="-mx-2 flex max-h-56 flex-col gap-px overflow-y-auto" role="group" aria-label="Existing tasks">
              {movable.map((t) => (
                <button type="button" key={t.id} onClick={() => toggle(t.id)} aria-pressed={picked.has(t.id)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left outline-none active:bg-accent focus-visible:bg-accent sm:min-h-9 [@media(hover:hover)]:hover:bg-accent">
                  <Checkbox checked={picked.has(t.id)} tabIndex={-1} className="pointer-events-none" aria-hidden />
                  <StatusIcon status={t.status} progress={t.progress} />
                  <span className="min-w-0 flex-1 truncate">{titleOf(t)}</span>
                  <PersonAvatar who={t.assignee} size={20} />
                </button>
              ))}
            </div>
          </>
        ) : null}
        {edit ? <p className="mt-4 text-sm text-muted-foreground">{count} {count === 1 ? 'task' : 'tasks'} in this project. Deleting it moves them to General.</p> : null}
      </DialogPanel>
      <DialogFooter>
        {edit ? (confirm
          ? <Button type="button" variant="destructive" onClick={() => { deleteProject(edit.id); close() }}>Delete and move {count} to General</Button>
          : <Button type="button" variant="ghost" className="mr-auto text-destructive-foreground" onClick={() => setConfirm(true)}>Delete project</Button>) : null}
        <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
        <Button type="submit" disabled={!name.trim() || !codeOk}>{edit ? 'Save' : picked.size ? `Create with ${picked.size}` : 'Create project'}</Button>
      </DialogFooter>
    </form>
  )
}

/* ================================================================== first run + lightbox */

export function WhoAreYou() {
  const ready = useStore((s) => s.ready)
  const me = useStore((s) => s.me)
  return (
    <Dialog open={ready && !me} onOpenChange={() => undefined}>
      <DialogPopup className="sm:max-w-md" showCloseButton={false} aria-label="Who are you?">
        <DialogHeader className="text-center"><DialogTitle>Who’s this?</DialogTitle><p className="text-sm text-muted-foreground">Trio shows your tasks first. You can switch any time.</p></DialogHeader>
        <DialogPanel>
          <div className="grid grid-cols-3 gap-2.5">
            {PEOPLE.map((p) => (
              <button key={p.id} onClick={() => setMe(p.id)} className="flex flex-col items-center gap-3 rounded-2xl bg-muted px-2 pt-4 pb-3.5 font-medium outline-none transition-[background-color,scale] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-accent">
                <PersonAvatar who={p.id} size={64} />{PERSON[p.id].name}
              </button>
            ))}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}

export function Lightbox() {
  const src = useStore((s) => s.lightbox)
  return (
    <Dialog open={!!src} onOpenChange={(o) => { if (!o) setState({ lightbox: null }) }}>
      <DialogPopup className="w-auto max-w-[94vw] border-0 bg-transparent p-0 shadow-none before:hidden sm:max-w-[94vw]" aria-label="Image" showCloseButton>
        {src ? <img src={src} alt="" className="max-h-[88dvh] max-w-[94vw] rounded-2xl object-contain" /> : null}
      </DialogPopup>
    </Dialog>
  )
}
