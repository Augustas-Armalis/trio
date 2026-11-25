import type { Person } from '../types'
import { blobToDataUrl } from '../lib/image'

export type Coll = 'tasks' | 'projects'
export type RawDoc = { id: string } & Record<string, unknown>
export type Conn = 'connecting' | 'live' | 'slow' | 'error'

export interface Backend {
  kind: 'cloud' | 'local'
  /** What carries the sync, when it is not the Claude artifact. */
  via?: 'room'
  subscribe(coll: Coll, cb: (docs: RawDoc[]) => void, onConn: (c: Conn) => void): () => void
  set(coll: Coll, id: string, data: Record<string, unknown>): Promise<void>
  update(coll: Coll, id: string, patch: Record<string, unknown>): Promise<void>
  remove(coll: Coll, id: string): Promise<void>
  uploadImage(blob: Blob): Promise<string>
  /** Who this browser is (follows the person across devices in the cloud build). */
  loadMe(): Promise<Person | null>
  saveMe(p: Person): Promise<void>
}

const PEOPLE_IDS = ['augustas', 'barbora', 'rokas']
const isPerson = (v: unknown): v is Person => typeof v === 'string' && PEOPLE_IDS.includes(v)
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn() } catch { return fallback } }

/* ------------------------------------------------------------------ cloud */

type Snap = { docs: { id: string; exists: boolean; data(): Record<string, unknown> | undefined }[]; metadata: { fromCache: boolean } }
type DocRef = { set(d: Record<string, unknown>): Promise<void>; update(d: Record<string, unknown>): Promise<void>; delete(): Promise<void>; get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }> }
type CloudDb = {
  collection(p: string): { onSnapshot(next: (s: Snap) => void, err?: (e: { code: string }) => void): () => void }
  doc(p: string): DocRef
}
type CloudUser = { id(): Promise<string | null> }
type CloudAssets = { upload(b: Blob): Promise<{ url: string }> }

export async function connectCloud(): Promise<Backend | null> {
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude
  if (!claude?.use) return null
  const db = (await claude.use('db').catch(() => null)) as CloudDb | null
  if (!db) return null
  const user = (await claude.use('user').catch(() => null)) as CloudUser | null
  const assets = (await claude.use('assets').catch(() => null)) as CloudAssets | null

  // One write at a time per document (the store is last-writer-wins and slows down on overlap).
  const queues = new Map<string, Promise<unknown>>()
  const enqueue = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = queues.get(key) ?? Promise.resolve()
    const next = prev.catch(() => undefined).then(fn)
    queues.set(key, next)
    next.finally(() => { if (queues.get(key) === next) queues.delete(key) }).catch(() => undefined)
    return next
  }
  const retry = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try { return await fn() } catch (e) {
      if ((e as { code?: string })?.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600))
        return fn()
      }
      throw e
    }
  }

  return {
    kind: 'cloud',
    subscribe(coll, cb, onConn) {
      let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => onConn('slow'), 10_000)
      const stop = db.collection(coll).onSnapshot(
        (snap) => {
          if (!snap.metadata.fromCache) { clearTimeout(timer); timer = undefined; onConn('live') }
          cb(snap.docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() ?? {}) })))
        },
        () => { clearTimeout(timer); onConn('error') },
      )
      return () => { clearTimeout(timer); stop() }
    },
    set: (coll, id, data) => enqueue(`${coll}/${id}`, () => retry(() => db.doc(`${coll}/${id}`).set(data))),
    update: (coll, id, patch) =>
      enqueue(`${coll}/${id}`, () =>
        retry(() => db.doc(`${coll}/${id}`).update(patch)).catch((e) => {
          // The doc was deleted by someone else while we edited: nothing to update.
          if ((e as { code?: string })?.code === 'invalid_argument') return
          throw e
        }),
      ),
    remove: (coll, id) => enqueue(`${coll}/${id}`, () => retry(() => db.doc(`${coll}/${id}`).delete())),
    async uploadImage(blob) {
      if (assets) {
        try { return (await assets.upload(blob)).url } catch { /* fall through to inline */ }
      }
      return blobToDataUrl(blob)
    },
    async loadMe() {
      const local = safe(() => localStorage.getItem('trio:me'), null)
      if (isPerson(local)) return local
      const uid = await user?.id().catch(() => null)
      if (!uid) return null
      const snap = await db.doc(`data/users/${uid}/profile`).get().catch(() => null)
      const v = snap?.exists ? snap.data()?.who : null
      return isPerson(v) ? v : null
    },
    async saveMe(p) {
      safe(() => localStorage.setItem('trio:me', p), undefined)
      const uid = await user?.id().catch(() => null)
      if (uid) await db.doc(`data/users/${uid}/profile`).set({ who: p }).catch(() => undefined)
    },
  }
}

/* ------------------------------------------------------------------ local */

export function createLocal(opts: { persist: boolean; seed?: Record<Coll, RawDoc[]> }): Backend {
  const KEY = (c: Coll) => `trio:v1:${c}`
  const mem: Record<Coll, Map<string, RawDoc>> = { tasks: new Map(), projects: new Map() }
  const subs: Record<Coll, Set<() => void>> = { tasks: new Set(), projects: new Set() }
  const chan = opts.persist && 'BroadcastChannel' in window ? new BroadcastChannel('trio-local') : null

  const load = (c: Coll) => {
    mem[c].clear()
    const raw = opts.persist ? safe(() => localStorage.getItem(KEY(c)), null) : null
    const list = (raw ? safe(() => JSON.parse(raw) as RawDoc[], []) : []) as RawDoc[]
    for (const d of list) mem[c].set(d.id, d)
  }
  const persist = (c: Coll) => {
    if (opts.persist) safe(() => localStorage.setItem(KEY(c), JSON.stringify([...mem[c].values()])), undefined)
  }
  const emit = (c: Coll) => subs[c].forEach((f) => f())
  const changed = (c: Coll) => { persist(c); emit(c); chan?.postMessage(c) }

  if (opts.seed) for (const c of ['tasks', 'projects'] as Coll[]) for (const d of opts.seed[c]) mem[c].set(d.id, d)
  else { load('tasks'); load('projects') }
  chan?.addEventListener('message', (e) => { const c = e.data as Coll; if (c === 'tasks' || c === 'projects') { load(c); emit(c) } })

  return {
    kind: 'local',
    subscribe(coll, cb, onConn) {
      const push = () => cb([...mem[coll].values()])
      subs[coll].add(push)
      queueMicrotask(() => { push(); onConn('live') })
      return () => subs[coll].delete(push)
    },
    async set(coll, id, data) { mem[coll].set(id, { id, ...data }); changed(coll) },
    async update(coll, id, patch) {
      const cur = mem[coll].get(id)
      if (!cur) return
      mem[coll].set(id, { ...cur, ...patch })
      changed(coll)
    },
    async remove(coll, id) { mem[coll].delete(id); changed(coll) },
    uploadImage: (blob) => blobToDataUrl(blob),
    async loadMe() { const v = safe(() => localStorage.getItem('trio:me'), null); return isPerson(v) ? v : null },
    async saveMe(p) { safe(() => localStorage.setItem('trio:me', p), undefined) },
  }
}
