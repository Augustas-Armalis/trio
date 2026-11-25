import { useMemo, useSyncExternalStore } from 'react'
import type { GroupBy, Person, Priority, Project, Scope, SortBy, Status, Task, ViewKind } from '../types'
import type { Backend, Conn, RawDoc } from './backend'
import { GENERAL_ID, PRIORITY, PROJECT_HUES } from './people'
import { CODE_RE, LEGACY_CODE_RE, codeFor, deriveCode, makeKey, nextNum, parseKey, uniqueCode } from '@/lib/keys'
import { today as todayStr } from '../lib/dates'
import { toastManager } from '@/components/ui/toast'
import { splitBody, uid } from '../lib/util'

export type ToastAction = { label: string; run: () => void }
export type ComposeInit = { body?: string; status?: Status; due?: string | null; project?: string; assignee?: Person | null; assignees?: Person[]; priority?: Priority }
export type PalettePage = 'root' | 'status' | 'priority' | 'assignee' | 'due' | 'project'
export type ProjectDialog = { mode: 'new' } | { mode: 'edit'; id: string }

export interface State {
  ready: boolean
  mode: 'cloud' | 'local'
  via: 'room' | null
  syncOpen: boolean
  conn: Conn
  tasks: Task[]
  projects: Project[]
  me: Person | null
  today: string
  // view state (persisted)
  scope: Scope
  view: ViewKind
  group: GroupBy
  sort: SortBy
  fPeople: Person[]
  fPriority: Priority[]
  q: string
  // transient UI
  openTaskId: string | null
  compose: ComposeInit | null
  projectDialog: ProjectDialog | null
  lightbox: string | null
  actionsFor: string | null
  selected: string[]
  palette: { page: PalettePage; target: string | null } | null
  shortcutsOpen: boolean
}

const PREF_KEYS = ['scope', 'view', 'group', 'sort', 'fPeople', 'fPriority'] as const
const readPrefs = (): Partial<State> => {
  try { return JSON.parse(localStorage.getItem('trio:prefs') || '{}') } catch { return {} }
}

let state: State = {
  ready: false, mode: 'local', via: null, syncOpen: false, conn: 'connecting', tasks: [], projects: [], me: null, today: todayStr(),
  scope: { kind: 'all' }, view: 'list', group: 'status', sort: 'manual', fPeople: [], fPriority: [], q: '',
  openTaskId: null, compose: null, projectDialog: null, lightbox: null, actionsFor: null, selected: [], palette: null, shortcutsOpen: false,
  ...readPrefs(),
}
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const getState = () => state
export function setState(p: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof p === 'function' ? p(state) : p) }
  listeners.forEach((l) => l())
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state))
}

let saveT: ReturnType<typeof setTimeout> | undefined
subscribe(() => {
  clearTimeout(saveT)
  saveT = setTimeout(() => {
    try { localStorage.setItem('trio:prefs', JSON.stringify(Object.fromEntries(PREF_KEYS.map((k) => [k, state[k]])))) } catch { /* private mode */ }
  }, 250)
})

/* ---------------------------------------------------------------- backend */

let backend: Backend
const stops: (() => void)[] = []

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const STATUS_SET = new Set<Status>(['backlog', 'todo', 'in_progress', 'done', 'escalated'])
const PRIO_SET = new Set<Priority>(['low', 'medium', 'high', 'urgent'])
const PEOPLE_SET = new Set<string>(['augustas', 'barbora', 'rokas'])

function normTask(d: RawDoc): Task {
  const status = STATUS_SET.has(d.status as Status) ? (d.status as Status) : 'todo'
  return {
    id: d.id,
    key: typeof d.key === 'string' ? d.key : '',
    body: typeof d.body === 'string' ? d.body : '',
    project: typeof d.project === 'string' && d.project ? d.project : GENERAL_ID,
    status,
    priority: PRIO_SET.has(d.priority as Priority) ? (d.priority as Priority) : 'medium',
    ...(() => {
      const list = (Array.isArray(d.assignees) ? d.assignees : PEOPLE_SET.has(d.assignee as string) ? [d.assignee] : []).filter((x): x is Person => PEOPLE_SET.has(x as string))
      const uniq = [...new Set(list)]
      return { assignees: uniq, assignee: uniq[0] ?? null }
    })(),
    due: typeof d.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.due) ? d.due : null,
    progress: Math.min(100, Math.max(0, num(d.progress, status === 'done' ? 100 : 0))),
    images: Array.isArray(d.images) ? (d.images.filter((x) => typeof x === 'string') as string[]) : [],
    rank: num(d.rank, 0),
    createdBy: PEOPLE_SET.has(d.createdBy as string) ? (d.createdBy as Person) : null,
    createdAt: num(d.createdAt, 0),
    updatedAt: num(d.updatedAt, 0),
    doneAt: typeof d.doneAt === 'number' ? d.doneAt : null,
    prev: STATUS_SET.has(d.prev as Status) ? (d.prev as Status) : null,
  }
}
function normProject(d: RawDoc): Project {
  const pname = typeof d.name === 'string' && d.name.trim() ? d.name : 'Untitled'
  return {
    id: d.id,
    name: pname,
    code: typeof d.code === 'string' && LEGACY_CODE_RE.test(d.code) ? d.code : deriveCode(pname),
    hue: num(d.hue, 255),
    createdAt: num(d.createdAt, 0),
    rank: num(d.rank, 0),
  }
}

export async function init(b: Backend) {
  backend = b
  const me = await b.loadMe()
  setState({ mode: b.kind, via: b.via ?? null, me })
  let tasksSeen = false
  let conn: Conn = 'connecting'
  const onConn = (c: Conn) => { if (c !== conn) { conn = c; setState({ conn: c }) } }
  stops.push(
    b.subscribe('tasks', (docs) => {
      tasksSeen = true
      setState({ tasks: docs.map(normTask), ready: true })
      reconcileKeys()
    }, onConn),
    b.subscribe('projects', (docs) => setState({ projects: docs.map(normProject).sort((a, c) => a.rank - c.rank || a.createdAt - c.createdAt) }), () => undefined),
  )
  // If the store is slow to answer, stop showing the skeleton and say so in the sync chip instead.
  setTimeout(() => { if (!tasksSeen) setState({ ready: true }) }, 4000)
  // Keep "today" correct across midnight.
  setInterval(() => { const t = todayStr(); if (t !== state.today) setState({ today: t }) }, 60_000)
  // Deep link to a task: #t-<id>
  const fromHash = () => {
    const m = location.hash.match(/^#t-([\w-]+)$/)
    if (m) setState({ openTaskId: m[1] })
    else if (state.openTaskId && !location.hash) setState({ openTaskId: null })
  }
  window.addEventListener('hashchange', fromHash)
  fromHash()
}

export const uploadImage = (b: Blob) => backend.uploadImage(b)

/* ---------------------------------------------------------------- issue keys */

const createdHere = new Set<string>()

/**
 * Keys need no shared counter: a new task takes the next free number locally. If two people create at the
 * same moment, the later one (and only on the device that created it) takes a fresh number. Tasks that have
 * no key yet (older data) are numbered in creation order, which every device computes identically.
 */
function reconcileKeys() {
  const { tasks, projects } = getState()
  const max = new Map<string, number>()
  for (const t of tasks) {
    const p = parseKey(t.key)
    if (p) max.set(p.code, Math.max(max.get(p.code) ?? 0, p.num))
  }
  const fixes: { id: string; key: string }[] = []
  const take = (code: string) => { const n = (max.get(code) ?? 0) + 1; max.set(code, n); return `${code}-${n}` }
  const byAge = (a: Task, b: Task) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)

  for (const t of tasks.filter((x) => !parseKey(x.key)).sort(byAge)) fixes.push({ id: t.id, key: take(codeFor(projects, t.project)) })

  const seen = new Map<string, Task[]>()
  for (const t of tasks) if (parseKey(t.key)) seen.set(t.key, [...(seen.get(t.key) ?? []), t])
  for (const [k, list] of seen) {
    if (list.length < 2) continue
    for (const t of list.sort(byAge).slice(1)) if (createdHere.has(t.id)) fixes.push({ id: t.id, key: take(parseKey(k)!.code) })
  }
  for (const f of fixes) {
    applyLocal(f.id, { key: f.key })
    backend.update('tasks', f.id, { key: f.key }).catch(() => undefined)
  }
}

/** Issue key -> task, for turning typed references into links. */
export function useKeyIndex(): Map<string, Task> {
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => new Map(tasks.filter((t) => t.key).map((t) => [t.key.toUpperCase(), t])), [tasks])
}

/* ---------------------------------------------------------------- toasts */

export function toast(text: string, action?: ToastAction) {
  toastManager.add({
    title: text,
    timeout: action ? 6000 : 3200,
    ...(action ? { actionProps: { children: action.label, onClick: action.run } } : {}),
  })
}

/* ---------------------------------------------------------------- tasks */

const toDoc = (t: Task): Record<string, unknown> => {
  const { id: _id, ...rest } = t
  return rest
}
const fail = (what: string) => () => toast(`Couldn’t ${what}. Check your connection and try again.`)

/** What changes when a task moves to a status: progress and done bookkeeping live here, in one place. */
export function statusPatch(t: Task, status: Status): Partial<Task> {
  if (t.status === status) return {}
  const patch: Partial<Task> = { status }
  if (status === 'done') {
    Object.assign(patch, { progress: 100, doneAt: Date.now(), prev: t.status })
  } else {
    patch.doneAt = null
    patch.prev = null
    if (t.status === 'done') patch.progress = status === 'backlog' || status === 'todo' ? 0 : 75
    else if (status === 'backlog' || status === 'todo') patch.progress = t.progress >= 100 ? 0 : t.progress
  }
  return patch
}

function applyLocal(id: string, patch: Partial<Task>) {
  setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
}

export function updateTask(id: string, patch: Partial<Task>) {
  const cur = getState().tasks.find((t) => t.id === id)
  if (!cur) return
  const p: Partial<Task> = { ...patch }
  if (p.assignees) { p.assignees = [...new Set(p.assignees)]; p.assignee = p.assignees[0] ?? null }
  else if ('assignee' in p) p.assignees = p.assignee ? [p.assignee] : []
  const full: Partial<Task> = { ...p, updatedAt: Date.now() }
  applyLocal(id, full)
  backend.update('tasks', id, full as Record<string, unknown>).catch(fail('save that change'))
}

export function setStatus(id: string, status: Status) {
  const cur = getState().tasks.find((t) => t.id === id)
  if (cur) updateTask(id, statusPatch(cur, status))
}

export function setProgress(id: string, p: number) {
  const cur = getState().tasks.find((t) => t.id === id)
  if (!cur) return
  const progress = Math.min(100, Math.max(0, Math.round(p)))
  if (progress === 100) return updateTask(id, { ...statusPatch(cur, 'done'), progress })
  const patch: Partial<Task> = { progress }
  if (cur.status === 'done') Object.assign(patch, statusPatch(cur, 'in_progress'), { progress })
  else if (progress > 0 && (cur.status === 'backlog' || cur.status === 'todo')) patch.status = 'in_progress'
  updateTask(id, patch)
}

export function toggleDone(id: string, opts: { quiet?: boolean } = {}) {
  const cur = getState().tasks.find((t) => t.id === id)
  if (!cur) return
  if (cur.status === 'done') {
    setStatus(id, cur.prev && cur.prev !== 'done' ? cur.prev : 'todo')
    return
  }
  setStatus(id, 'done')
  if (!opts.quiet) toast('Marked done', { label: 'Undo', run: () => setStatus(id, cur.status) })
}

export type NewTask = {
  body: string
  project?: string
  status?: Status
  priority?: Priority
  assignee?: Person | null
  assignees?: Person[]
  due?: string | null
  images?: string[]
}
export function createTask(n: NewTask): string {
  const s = getState()
  const status = n.status ?? 'todo'
  const now = Date.now()
  const id = uid('t')
  const project = n.project ?? GENERAL_ID
  const code = codeFor(s.projects, project)
  const key = makeKey(code, nextNum(s.tasks, code))
  createdHere.add(id)
  const task: Task = {
    id, key, body: n.body.trim(), project, status,
    priority: n.priority ?? 'medium', ...(() => { const a = n.assignees ?? (n.assignee === undefined ? (s.me ? [s.me] : []) : n.assignee ? [n.assignee] : []); return { assignees: a, assignee: a[0] ?? null } })(),
    due: n.due ?? null, progress: status === 'done' ? 100 : 0, images: n.images ?? [],
    rank: -now, createdBy: s.me, createdAt: now, updatedAt: now,
    doneAt: status === 'done' ? now : null, prev: null,
  }
  setState((st) => ({ tasks: [task, ...st.tasks] }))
  backend.set('tasks', id, toDoc(task)).catch(() => {
    setState((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) }))
    toast('Couldn’t create that task. If it has a large image, try a smaller one.')
  })
  return id
}

export function deleteTask(id: string) {
  const cur = getState().tasks.find((t) => t.id === id)
  if (!cur) return
  setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), openTaskId: s.openTaskId === id ? null : s.openTaskId }))
  if (location.hash === `#t-${id}`) setHash('')
  backend.remove('tasks', id).catch(fail('delete that task'))
  toast('Task deleted', {
    label: 'Undo',
    run: () => {
      setState((s) => ({ tasks: [cur, ...s.tasks] }))
      backend.set('tasks', cur.id, toDoc(cur)).catch(fail('restore that task'))
    },
  })
}

/** Rank that puts a card between two neighbours (or at an end). */
export function rankBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return -Date.now()
  if (before === undefined) return (after as number) - 1000
  if (after === undefined) return before + 1000
  return (before + after) / 2
}

export function moveTask(id: string, status: Status, rank: number) {
  const cur = getState().tasks.find((t) => t.id === id)
  if (cur) updateTask(id, { ...statusPatch(cur, status), rank })
}

/* ---------------------------------------------------------------- projects */

export function createProject(name: string, code?: string): string {
  const s = getState()
  const id = uid('p')
  const used = new Set(s.projects.map((p) => p.hue))
  const hue = PROJECT_HUES.find((h) => !used.has(h)) ?? PROJECT_HUES[s.projects.length % PROJECT_HUES.length]
  const clean = name.trim() || 'Untitled'
  const p: Project = { id, name: clean, code: uniqueCode(code && CODE_RE.test(code) ? code : deriveCode(clean), s.projects), hue, createdAt: Date.now(), rank: s.projects.length }
  setState((st) => ({ projects: [...st.projects, p] }))
  const { id: _i, ...doc } = p
  backend.set('projects', id, doc).catch(fail('create that project'))
  return id
}

export function updateProject(id: string, patch: { name?: string; code?: string }) {
  const s = getState()
  const cur = s.projects.find((p) => p.id === id)
  if (!cur) return
  const next: Partial<Project> = {}
  if (patch.name && patch.name.trim()) next.name = patch.name.trim()
  if (patch.code && CODE_RE.test(patch.code) && patch.code !== cur.code) next.code = uniqueCode(patch.code, s.projects, id)
  if (!Object.keys(next).length) return
  setState((st) => ({ projects: st.projects.map((p) => (p.id === id ? { ...p, ...next } : p)) }))
  backend.update('projects', id, next as Record<string, unknown>).catch(fail('save that project'))
}

export function moveTasksToProject(ids: string[], project: string) {
  for (const id of ids) {
    const t = getState().tasks.find((x) => x.id === id)
    if (t && t.project !== project) updateTask(id, { project })
  }
}

export function deleteProject(id: string) {
  const s = getState()
  const p = s.projects.find((x) => x.id === id)
  if (!p) return
  const moved = s.tasks.filter((t) => t.project === id).map((t) => t.id)
  moveTasksToProject(moved, GENERAL_ID)
  setState((st) => ({ projects: st.projects.filter((x) => x.id !== id), scope: st.scope.kind === 'project' && st.scope.id === id ? { kind: 'all' } : st.scope }))
  backend.remove('projects', id).catch(fail('delete that project'))
  toast(`Deleted ${p.name}`, {
    label: 'Undo',
    run: () => {
      const { id: _i, ...doc } = p
      setState((st) => ({ projects: [...st.projects, p] }))
      backend.set('projects', id, doc).catch(fail('restore that project'))
      moveTasksToProject(moved, id)
    },
  })
}

export const projectName = (projects: Project[], id: string) =>
  id === GENERAL_ID ? 'General' : projects.find((p) => p.id === id)?.name ?? 'General'

/* ---------------------------------------------------------------- people */

export function setMe(p: Person) {
  setState({ me: p })
  backend.saveMe(p).catch(() => undefined)
}

/* ---------------------------------------------------------------- UI actions */

// A sandboxed frame may refuse history changes. The link is a nicety, so never let it break opening a task.
const setHash = (h: string) => { try { history.replaceState(null, '', h || location.pathname + location.search) } catch { /* ignore */ } }

export const setScope = (scope: Scope) => setState({ scope })
// A long-press opens the actions drawer while the finger is still down. Lifting that finger lands on the
// backdrop, so closes are ignored until it has lifted (plus a beat), like a native iOS context menu.
let actionsLock = { held: false, until: 0 }
export function openActions(id: string, fromHold = false) {
  setState({ actionsFor: id })
  if (!fromHold) return
  actionsLock = { held: true, until: Infinity }
  const names = ['pointerup', 'pointercancel', 'touchend', 'touchcancel']
  const release = () => { actionsLock = { held: false, until: Date.now() + 450 }; names.forEach((n) => window.removeEventListener(n, release, true)) }
  names.forEach((n) => window.addEventListener(n, release, true))
}
export const actionsCloseBlocked = () => actionsLock.held || Date.now() < actionsLock.until
export const openCompose = (init: ComposeInit = {}) => setState({ compose: init })
export const closeCompose = () => setState({ compose: null })
/** A link that opens this task for whoever has the site. */
export const taskLink = (id: string) => `${location.origin}${location.pathname}#t-${id}`
export function copyText(text: string, done: string) {
  navigator.clipboard?.writeText(text).then(() => toast(done), () => toast('Could not copy'))
}
export const copyTaskLink = (id: string) => copyText(taskLink(id), 'Link copied')

export function openTask(id: string) {
  setState({ openTaskId: id })
  setHash(`#t-${id}`)
}
export function closeTask() {
  setState({ openTaskId: null })
  if (location.hash.startsWith('#t-')) setHash('')
}

/* ---------------------------------------------------------------- selection, bulk, duplicate, palette */

export function toggleSelect(id: string) {
  setState((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] }))
}
export const selectMany = (ids: string[]) => setState({ selected: ids })
export const clearSelection = () => setState((s) => (s.selected.length ? { selected: [] } : {}))

export function deleteTasks(ids: string[]) {
  const gone = getState().tasks.filter((t) => ids.includes(t.id))
  if (!gone.length) return
  setState((s) => ({ tasks: s.tasks.filter((t) => !ids.includes(t.id)), selected: [], openTaskId: s.openTaskId && ids.includes(s.openTaskId) ? null : s.openTaskId }))
  if (location.hash.startsWith('#t-')) setHash('')
  for (const t of gone) backend.remove('tasks', t.id).catch(fail('delete that task'))
  toast(gone.length === 1 ? 'Task deleted' : `${gone.length} tasks deleted`, {
    label: 'Undo',
    run: () => {
      setState((s) => ({ tasks: [...gone, ...s.tasks] }))
      for (const t of gone) backend.set('tasks', t.id, toDoc(t)).catch(fail('restore that task'))
    },
  })
}

export function updateTasks(ids: string[], patch: (t: Task) => Partial<Task>) {
  for (const id of ids) {
    const cur = getState().tasks.find((t) => t.id === id)
    if (cur) updateTask(id, patch(cur))
  }
}

/** Copy tasks into a project and leave the originals where they are. The copies get fresh keys there. */
export function copyTasksTo(ids: string[], project: string) {
  const list = getState().tasks.filter((t) => ids.includes(t.id))
  for (const t of list) createTask({ body: t.body, project, status: t.status, priority: t.priority, assignees: t.assignees, due: t.due, images: t.images })
  if (list.length) toast(list.length === 1 ? 'Copied 1 task' : `Copied ${list.length} tasks`)
}

export function duplicateTask(id: string) {
  const t = getState().tasks.find((x) => x.id === id)
  if (!t) return
  const nid = createTask({ body: t.body, project: t.project, priority: t.priority, assignees: t.assignees, due: t.due, images: t.images })
  const key = getState().tasks.find((x) => x.id === nid)?.key
  toast(key ? `${key} created` : 'Task duplicated', { label: 'Open', run: () => openTask(nid) })
}

export function openPalette(page: PalettePage = 'root', target: string | null = null) {
  setState({ palette: { page, target } })
}
export const closePalette = () => setState({ palette: null })

/** The task keyboard shortcuts act on: the open one, else the one with focus. */
export function targetTaskId(): string | null {
  const s = getState()
  if (s.openTaskId) return s.openTaskId
  const row = (document.activeElement as HTMLElement | null)?.closest('[data-task], [data-card]')
  return row?.getAttribute('data-task') ?? row?.getAttribute('data-card') ?? null
}

/* ---------------------------------------------------------------- derived */

export function sortTasks(list: Task[], sort: SortBy): Task[] {
  const out = [...list]
  const byRank = (a: Task, b: Task) => a.rank - b.rank || b.createdAt - a.createdAt
  if (sort === 'manual') return out.sort(byRank)
  if (sort === 'newest') return out.sort((a, b) => b.createdAt - a.createdAt)
  if (sort === 'priority') return out.sort((a, b) => PRIORITY[b.priority].weight - PRIORITY[a.priority].weight || byRank(a, b))
  return out.sort((a, b) => (a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.due ? -1 : b.due ? 1 : 0) || byRank(a, b))
}

export function useVisibleTasks(): Task[] {
  const tasks = useStore((s) => s.tasks)
  const scope = useStore((s) => s.scope)
  const fPeople = useStore((s) => s.fPeople)
  const fPriority = useStore((s) => s.fPriority)
  const q = useStore((s) => s.q)
  const me = useStore((s) => s.me)
  return useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tasks.filter((t) => {
      if (scope.kind === 'project' && t.project !== scope.id) return false
      if (scope.kind === 'mine' && !(me && t.assignees.includes(me))) return false
      if (fPeople.length && !t.assignees.some((a) => fPeople.includes(a))) return false
      if (fPriority.length && !fPriority.includes(t.priority)) return false
      if (needle && !t.body.toLowerCase().includes(needle) && !t.key.toLowerCase().includes(needle)) return false
      return true
    })
  }, [tasks, scope, fPeople, fPriority, q, me])
}

const ORDER: Status[] = ['escalated', 'in_progress', 'todo', 'backlog', 'done']
/** Visible tasks in the order the list shows them: status groups first, then the chosen sort. */
export function useTaskOrder(): string[] {
  const tasks = useVisibleTasks()
  const sort = useStore((s) => s.sort)
  return useMemo(() => {
    const sorted = sortTasks(tasks, sort)
    return ORDER.flatMap((st) => sorted.filter((t) => t.status === st)).map((t) => t.id)
  }, [tasks, sort])
}

export const titleOf = (t: Task) => splitBody(t.body).title || 'Untitled task'
