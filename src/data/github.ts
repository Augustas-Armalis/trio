import type { Backend, Coll, Conn, RawDoc } from './backend'
import { blobToDataUrl } from '../lib/image'
import type { Person } from '../types'

/**
 * Sync with no server: the shared board is one JSON file in a private GitHub repo, read and written with a
 * fine-grained token that each person pastes in once. The token lives only in this browser's localStorage (or in a
 * join link you send privately); it is never in the code or the public repo.
 *
 * Merge rule: every document carries the time it was last written (`_t`). When two devices disagree, the newer write
 * wins per document; a delete is a tombstone with its own time. Every device re-checks every few seconds and pushes
 * what the file is missing, so all of them converge on the same board.
 */

export type GithubConfig = { repo: string; token: string }
const CFG_KEY = 'trio:gh'
const FILE = 'trio.json'
const POLL_MS = 5000
const TOMB_TTL = 30 * 24 * 3600 * 1000

type Stamped = RawDoc & { _t?: number }
type Store = { v: 1; docs: Record<Coll, Record<string, Stamped>>; dead: Record<string, number> }
const empty = (): Store => ({ v: 1, docs: { tasks: {}, projects: {} }, dead: {} })

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn() } catch { return fallback } }
const PEOPLE_IDS = ['augustas', 'barbora', 'rokas']
const REPO_RE = /^[\w.-]+\/[\w.-]+$/

export function loadGithubConfig(): GithubConfig | null {
  const raw = safe(() => localStorage.getItem(CFG_KEY), null)
  const c = raw ? safe(() => JSON.parse(raw) as Partial<GithubConfig>, null) : null
  return c && typeof c.repo === 'string' && typeof c.token === 'string' && REPO_RE.test(c.repo) ? { repo: c.repo, token: c.token } : null
}
export const saveGithubConfig = (c: GithubConfig) => safe(() => localStorage.setItem(CFG_KEY, JSON.stringify(c)), undefined)
export const clearGithubConfig = () => safe(() => localStorage.removeItem(CFG_KEY), undefined)

const b64 = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
}
/** Chunked so a big board never overflows the argument limit of String.fromCharCode. */
const toBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

/** A link that joins this board: the config rides in the #fragment, which browsers never send to any server. */
export const joinLink = (c: GithubConfig) => `${location.origin}${location.pathname}#join=${b64.enc(JSON.stringify(c))}`
/** If the page was opened from a join link, keep its config and clean the address bar. Returns true when it joined. */
export function consumeJoinLink(): boolean {
  const m = location.hash.match(/^#join=([\w-]+)$/)
  if (!m) return false
  let joined = false
  try {
    const c = JSON.parse(b64.dec(m[1])) as Partial<GithubConfig>
    if (typeof c.repo === 'string' && typeof c.token === 'string' && REPO_RE.test(c.repo)) { saveGithubConfig({ repo: c.repo, token: c.token }); joined = true }
  } catch { /* not a valid link */ }
  history.replaceState(null, '', location.pathname + location.search)
  return joined
}

export class SyncError extends Error {
  constructor(public status: number, msg: string) { super(msg) }
}

/** Check a config works before saving it. Resolves a short human message on failure, or null when it is good. */
export async function verifyGithub(c: GithubConfig): Promise<string | null> {
  if (!REPO_RE.test(c.repo)) return 'Use the form owner/name, for example your-name/trio-data.'
  if (!c.token.trim()) return 'Paste the token first.'
  try {
    const r = await fetch(`https://api.github.com/repos/${c.repo}`, { headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' })
    if (r.status === 401) return 'GitHub rejected that token.'
    if (r.status === 404) return 'Could not find that repository with this token. Check the name, and that the token can use it.'
    if (!r.ok) return `GitHub answered ${r.status}.`
    const j = (await r.json()) as { permissions?: { push?: boolean }; private?: boolean }
    if (j.permissions && j.permissions.push === false) return 'The token can read but not write. Give it Contents: Read and write.'
    if (j.private === false) return 'That repository is public, so anyone could read your tasks. Use a private one.'
    return null
  } catch {
    return 'Could not reach GitHub. Check your connection.'
  }
}

export const githubRepo = () => loadGithubConfig()?.repo ?? null

export function createGithub(cfg: GithubConfig): Backend {
  const mem: Store = empty()
  const subs: Record<Coll, Set<() => void>> = { tasks: new Set(), projects: new Set() }
  const connCb = new Set<(c: Conn) => void>()
  let conn: Conn = 'connecting'
  const setConn = (c: Conn) => { if (c !== conn) { conn = c; connCb.forEach((f) => f(c)) } }
  const emit = (c: Coll) => subs[c].forEach((f) => f())

  function merge(remote: Store) {
    let changed = false
    const touched = new Set<Coll>()
    for (const [k, t] of Object.entries(remote.dead ?? {})) if ((mem.dead[k] ?? 0) < t) { mem.dead[k] = t; changed = true }
    for (const c of ['tasks', 'projects'] as Coll[]) {
      for (const [id, d] of Object.entries(remote.docs?.[c] ?? {})) {
        const mine = mem.docs[c][id]
        if ((mem.dead[`${c}/${id}`] ?? 0) >= (d._t ?? 0)) continue
        if (!mine || (mine._t ?? 0) < (d._t ?? 0)) { mem.docs[c][id] = d; touched.add(c); changed = true }
      }
      for (const [id, d] of Object.entries(mem.docs[c])) {
        if ((mem.dead[`${c}/${id}`] ?? 0) >= (d._t ?? 0)) { delete mem.docs[c][id]; touched.add(c); changed = true }
      }
    }
    const now = Date.now()
    for (const [k, t] of Object.entries(mem.dead)) if (now - t > TOMB_TTL) delete mem.dead[k]
    touched.forEach(emit)
    return changed
  }

  // Whatever this browser already had becomes part of the board on first connect.
  for (const c of ['tasks', 'projects'] as Coll[]) {
    const raw = safe(() => localStorage.getItem(`trio:v1:${c}`), null)
    for (const d of (raw ? safe(() => JSON.parse(raw) as Stamped[], []) : [])) mem.docs[c][d.id] = { ...d, _t: Number(d.updatedAt ?? d.createdAt ?? 1) || 1 }
  }
  // Last known board, so a reload shows something at once while GitHub answers.
  const CACHE = `trio:gh-cache:${cfg.repo}`
  const cached = safe(() => localStorage.getItem(CACHE), null)
  if (cached) merge(safe(() => JSON.parse(cached) as Store, empty()))
  const persistCache = () => safe(() => localStorage.setItem(CACHE, JSON.stringify(mem)), undefined)

  let dirty = false
  let sha: string | null = null
  let busy = false
  let again = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0

  const api = (init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${cfg.repo}/contents/${FILE}`, {
      ...init,
      cache: 'no-cache',
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) },
    })

  /** Is the remote file already equal to what we hold? Then there is nothing to push. */
  const sameAs = (remote: Store) => {
    for (const c of ['tasks', 'projects'] as Coll[]) {
      const a = mem.docs[c], b = remote.docs?.[c] ?? {}
      const ka = Object.keys(a)
      if (ka.length !== Object.keys(b).length) return false
      for (const id of ka) if ((b[id]?._t ?? -1) !== (a[id]._t ?? 0)) return false
    }
    const db = remote.dead ?? {}
    const da = Object.keys(mem.dead)
    return da.length === Object.keys(db).length && da.every((k) => db[k] === mem.dead[k])
  }

  /** The file with its content and sha, in one request (the content is base64 JSON up to 1 MB; larger comes as raw). */
  async function pull(): Promise<{ remote: Store; exists: boolean }> {
    const r = await api()
    if (r.status === 404) { sha = null; return { remote: empty(), exists: false } }
    if (r.status === 401) throw new SyncError(401, 'The token was rejected.')
    if (r.status === 403) throw new SyncError(403, 'GitHub refused (token permissions or rate limit).')
    if (!r.ok) throw new SyncError(r.status, `GitHub answered ${r.status}.`)
    const j = (await r.json()) as { sha: string; content?: string; encoding?: string; download_url?: string }
    sha = j.sha
    let text: string
    if (j.content && j.encoding === 'base64') text = b64.dec(j.content.replace(/\n/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
    else {
      const raw = await api({ headers: { Accept: 'application/vnd.github.raw+json' } })
      if (!raw.ok) throw new SyncError(raw.status, `GitHub answered ${raw.status}.`)
      text = await raw.text()
    }
    const remote = safe(() => JSON.parse(text) as Store, null)
    return { remote: remote && remote.v === 1 ? remote : empty(), exists: true }
  }

  async function push(): Promise<boolean> {
    const body = JSON.stringify({ message: 'Trio sync', content: toBase64(JSON.stringify(mem)), ...(sha ? { sha } : {}) })
    const r = await api({ method: 'PUT', body, headers: { 'Content-Type': 'application/json' } })
    if (r.status === 409 || r.status === 422) return false // someone else wrote first: pull, merge, try again
    if (r.status === 401 || r.status === 403) throw new SyncError(r.status, 'GitHub refused the write. Check the token has Contents: Read and write.')
    if (!r.ok) throw new SyncError(r.status, `GitHub answered ${r.status}.`)
    sha = ((await r.json()) as { content: { sha: string } }).content.sha
    return true
  }

  async function cycle() {
    if (busy) { again = true; return }
    busy = true
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { remote, exists } = await pull()
        merge(remote)
        if (!exists || dirty || !sameAs(remote)) {
          dirty = false
          if (await push()) break
          dirty = true
        } else break
      }
      persistCache()
      failures = 0
      setConn('live')
    } catch (e) {
      failures++
      setConn(e instanceof SyncError && (e.status === 401 || e.status === 403 || e.status === 404) ? 'error' : failures > 2 ? 'slow' : conn)
    } finally {
      busy = false
      if (again) { again = false; schedule(300) }
    }
  }
  function schedule(ms = POLL_MS) {
    clearTimeout(timer)
    timer = setTimeout(async () => { await cycle(); schedule() }, ms)
  }
  const touch = () => { dirty = true; schedule(700) }

  schedule(0)
  window.addEventListener('focus', () => schedule(0))
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0) })
  window.addEventListener('online', () => schedule(0))

  const stamp = (d: Record<string, unknown>): Record<string, unknown> => ({ ...d, _t: Date.now() })
  return {
    kind: 'cloud',
    via: 'github',
    subscribe(coll, cb, onConn) {
      const send = () => cb(Object.values(mem.docs[coll]).map(({ _t: _ignored, ...d }) => d as RawDoc))
      subs[coll].add(send)
      connCb.add(onConn)
      queueMicrotask(() => { send(); onConn(conn) })
      return () => { subs[coll].delete(send); connCb.delete(onConn) }
    },
    async set(coll, id, data) {
      mem.docs[coll][id] = { id, ...stamp(data) } as Stamped
      delete mem.dead[`${coll}/${id}`]
      emit(coll); touch(); persistCache()
    },
    async update(coll, id, patch) {
      const cur = mem.docs[coll][id]
      if (!cur) return
      mem.docs[coll][id] = { ...cur, ...stamp(patch) } as Stamped
      emit(coll); touch(); persistCache()
    },
    async remove(coll, id) {
      delete mem.docs[coll][id]
      mem.dead[`${coll}/${id}`] = Date.now()
      emit(coll); touch(); persistCache()
    },
    uploadImage: (blob) => blobToDataUrl(blob),
    async loadMe() { const v = safe(() => localStorage.getItem('trio:me'), null); return PEOPLE_IDS.includes(v ?? '') ? (v as Person) : null },
    async saveMe(p) { safe(() => localStorage.setItem('trio:me', p), undefined) },
  }
}
