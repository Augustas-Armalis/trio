import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { Backend, Coll, Conn, RawDoc } from './backend'
import { blobToDataUrl, shrinkImage } from '../lib/image'
import type { Person } from '../types'

/**
 * Sync with no account, no server and no key in the code: a shared "room" link.
 *
 * The link carries a random secret in its #fragment (browsers never send fragments to anyone). From the secret each
 * device derives the same signing key and the same encryption key. Every task and project is one small encrypted
 * "replaceable" event published to a few public Nostr relays, which hold the latest version of each and push changes
 * to everyone listening. The relays only ever see ciphertext. A newer write replaces an older one per task; a delete is
 * a replacement that says "gone". Devices also top the relays up with anything they are missing.
 */

const KEY = 'trio:room'
const KIND = 30078
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://offchain.pub']
/** Relays refuse big events, so pictures are kept small in a shared room. */
const IMG_SIDE = 720
const IMG_BYTES = 36_000

const enc = new TextEncoder()
const dec = new TextDecoder()
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn() } catch { return fallback } }
const PEOPLE_IDS = ['augustas', 'barbora', 'rokas']
const SECRET_RE = /^[A-Za-z0-9_-]{20,64}$/

const b64u = {
  enc: (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') },
  dec: (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
}

export const loadRoom = (): string | null => {
  const v = safe(() => localStorage.getItem(KEY), null)
  return v && SECRET_RE.test(v) ? v : null
}
export const saveRoom = (secret: string) => safe(() => localStorage.setItem(KEY, secret), undefined)
export const leaveRoom = () => safe(() => { localStorage.removeItem(KEY); localStorage.removeItem('trio:room-cache') }, undefined)
export const newRoomSecret = () => b64u.enc(crypto.getRandomValues(new Uint8Array(24)))
export const roomLink = (secret: string) => `${location.origin}${location.pathname}#room=${secret}`

/** If the page was opened from a room link, remember the room and clean the address bar. True when it joined. */
export function consumeRoomLink(): boolean {
  const m = location.hash.match(/^#room=([\w-]+)$/)
  if (!m) return false
  const ok = SECRET_RE.test(m[1])
  if (ok) saveRoom(m[1])
  history.replaceState(null, '', location.pathname + location.search)
  return ok
}

type Stamped = RawDoc & { _t?: number }
type Payload = { c: Coll; id: string; t: number; doc: Record<string, unknown> | null }
type NostrEvent = { id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string }

export function createRoom(secret: string): Backend {
  const mem: Record<Coll, Map<string, Stamped>> = { tasks: new Map(), projects: new Map() }
  const gone = new Map<string, number>() // "coll/id" -> time of delete
  const lastAt = new Map<string, number>() // "coll/id" -> last created_at seen or used (replacements must be strictly newer)
  const subs: Record<Coll, Set<() => void>> = { tasks: new Set(), projects: new Set() }
  const connCb = new Set<(c: Conn) => void>()
  let conn: Conn = 'connecting'
  const setConn = (c: Conn) => { if (c !== conn) { conn = c; connCb.forEach((f) => f(c)) } }
  const emit = (c: Coll) => subs[c].forEach((f) => f())

  const sk = sha256(enc.encode('trio-sk:' + secret))
  const pub = bytesToHex(schnorr.getPublicKey(sk))
  const keyP = crypto.subtle.importKey('raw', sha256(enc.encode('trio-ek:' + secret)), 'AES-GCM', false, ['encrypt', 'decrypt'])
  const dTag = (c: Coll, id: string) => bytesToHex(sha256(enc.encode(`trio-d:${secret}:${c}/${id}`))).slice(0, 32)

  const seal = async (p: Payload) => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyP, enc.encode(JSON.stringify(p))))
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12)
    return b64u.enc(out)
  }
  const open = async (content: string): Promise<Payload | null> => {
    try {
      const raw = b64u.dec(content)
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await keyP, raw.subarray(12))
      return JSON.parse(dec.decode(pt)) as Payload
    } catch { return null }
  }

  /* ---------------- local state, with a cache so a reload shows the board before the relays answer */
  const CACHE = 'trio:room-cache'
  const persist = () => safe(() => localStorage.setItem(CACHE, JSON.stringify({ tasks: [...mem.tasks.values()], projects: [...mem.projects.values()], gone: [...gone] })), undefined)
  const raw0 = safe(() => localStorage.getItem(CACHE), null)
  const cache = raw0 ? safe(() => JSON.parse(raw0) as { tasks: Stamped[]; projects: Stamped[]; gone: [string, number][] }, null) : null
  if (cache) {
    for (const k of ['tasks', 'projects'] as Coll[]) for (const d of cache[k] ?? []) mem[k].set(d.id, d)
    for (const [k, t] of cache.gone ?? []) gone.set(k, t)
  }
  // What this browser already had (from before it joined) becomes part of the shared board.
  for (const k of ['tasks', 'projects'] as Coll[]) {
    const raw = safe(() => localStorage.getItem(`trio:v1:${k}`), null)
    for (const d of (raw ? safe(() => JSON.parse(raw) as Stamped[], []) : [])) if (!mem[k].has(d.id)) mem[k].set(d.id, { ...d, _t: Number(d.updatedAt ?? d.createdAt ?? 1) || 1 })
  }

  /** Apply one decoded record. Returns true when it changed what we show. */
  const apply = (p: Payload): boolean => {
    const key = `${p.c}/${p.id}`
    const cur = mem[p.c].get(p.id)
    const deadAt = gone.get(key) ?? 0
    if (p.doc === null) {
      if (p.t <= deadAt) return false
      gone.set(key, p.t)
      if (cur && (cur._t ?? 0) <= p.t) { mem[p.c].delete(p.id); return true }
      return false
    }
    if (p.t <= deadAt) return false
    if (cur && (cur._t ?? 0) >= p.t) return false
    mem[p.c].set(p.id, { ...p.doc, id: p.id, _t: p.t })
    return true
  }

  /* ---------------- relays */
  type Relay = { url: string; ws: WebSocket | null; open: boolean; eose: boolean; tries: number; seen: Map<string, number>; sub: string }
  const relays: Relay[] = RELAYS.map((url) => ({ url, ws: null, open: false, eose: false, tries: 0, seen: new Map(), sub: 'trio-' + Math.random().toString(36).slice(2, 8) }))

  const sign = (kind: number, tags: string[][], content: string, created_at: number): NostrEvent => {
    const hash = sha256(enc.encode(JSON.stringify([0, pub, created_at, kind, tags, content])))
    return { id: bytesToHex(hash), pubkey: pub, created_at, kind, tags, content, sig: bytesToHex(schnorr.sign(hash, sk)) }
  }
  const publishTo = (r: Relay, ev: NostrEvent) => { if (r.open && r.ws) safe(() => r.ws!.send(JSON.stringify(['EVENT', ev])), undefined) }

  const publishDoc = async (c: Coll, id: string, doc: Record<string, unknown> | null, t: number, only?: Relay) => {
    const key = `${c}/${id}`
    const at = Math.max(Math.floor(Date.now() / 1000), (lastAt.get(key) ?? 0) + 1)
    lastAt.set(key, at)
    const ev = sign(KIND, [['d', dTag(c, id)]], await seal({ c, id, t, doc }), at)
    for (const r of only ? [only] : relays) publishTo(r, ev)
  }

  /** After a relay has told us everything it holds, send it whatever it lacks or has older. */
  const topUp = async (r: Relay) => {
    for (const c of ['tasks', 'projects'] as Coll[]) {
      for (const [id, d] of mem[c]) {
        const t = d._t ?? 0
        if ((r.seen.get(`${c}/${id}`) ?? -1) < t) { const { _t, id: _i, ...doc } = d; void _t; void _i; await publishDoc(c, id, doc, t, r) }
      }
    }
    for (const [key, t] of gone) {
      if ((r.seen.get(key) ?? -1) < t) { const [c, id] = key.split('/') as [Coll, string]; await publishDoc(c, id, null, t, r) }
    }
  }

  const onEvent = async (r: Relay, ev: NostrEvent) => {
    if (ev.kind !== KIND || ev.pubkey !== pub) return
    const p = await open(ev.content)
    if (!p || (p.c !== 'tasks' && p.c !== 'projects') || typeof p.id !== 'string') return
    const key = `${p.c}/${p.id}`
    lastAt.set(key, Math.max(lastAt.get(key) ?? 0, ev.created_at))
    r.seen.set(key, Math.max(r.seen.get(key) ?? -1, p.t))
    if (apply(p)) { emit(p.c); persist() }
  }

  const status = () => {
    const live = relays.some((r) => r.open && r.eose)
    const any = relays.some((r) => r.open)
    setConn(live ? 'live' : any ? 'connecting' : conn === 'live' ? 'slow' : 'connecting')
  }

  const connect = (r: Relay) => {
    let ws: WebSocket
    try { ws = new WebSocket(r.url) } catch { return }
    r.ws = ws; r.open = false; r.eose = false
    ws.onopen = () => {
      r.open = true; r.tries = 0; r.seen.clear()
      ws.send(JSON.stringify(['REQ', r.sub, { kinds: [KIND], authors: [pub] }]))
      status()
    }
    ws.onmessage = (m) => {
      const msg = safe(() => JSON.parse(String(m.data)) as unknown[], null)
      if (!msg) return
      if (msg[0] === 'EVENT' && msg[1] === r.sub) void onEvent(r, msg[2] as NostrEvent)
      else if (msg[0] === 'EOSE' && msg[1] === r.sub) { r.eose = true; status(); void topUp(r) }
    }
    ws.onclose = () => {
      if (r.ws !== ws) return
      r.open = false; r.eose = false; status()
      setTimeout(() => connect(r), Math.min(30_000, 1500 * 2 ** Math.min(r.tries++, 4)))
    }
    ws.onerror = () => safe(() => ws.close(), undefined)
  }
  relays.forEach(connect)
  // A phone coming back from the background has usually lost its sockets.
  const wake = () => relays.forEach((r) => { if (!r.open && (!r.ws || r.ws.readyState > 1)) { r.tries = 0; connect(r) } })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake() })
  window.addEventListener('online', wake)
  setTimeout(() => { if (!relays.some((r) => r.open && r.eose)) setConn(relays.some((r) => r.open) ? 'connecting' : 'slow') }, 10_000)

  return {
    kind: 'cloud',
    via: 'room',
    subscribe(coll, cb, onConn) {
      const send = () => cb([...mem[coll].values()].map((d) => { const { _t, ...rest } = d; void _t; return rest as RawDoc }))
      subs[coll].add(send)
      connCb.add(onConn)
      queueMicrotask(() => { send(); onConn(conn) })
      return () => { subs[coll].delete(send); connCb.delete(onConn) }
    },
    async set(coll, id, data) {
      const t = Date.now()
      mem[coll].set(id, { ...data, id, _t: t })
      gone.delete(`${coll}/${id}`)
      emit(coll); persist()
      await publishDoc(coll, id, data, t)
    },
    async update(coll, id, patch) {
      const cur = mem[coll].get(id)
      if (!cur) return
      const t = Date.now()
      const { _t, id: _i, ...rest } = cur
      void _t; void _i
      const next = { ...rest, ...patch }
      mem[coll].set(id, { ...next, id, _t: t })
      emit(coll); persist()
      await publishDoc(coll, id, next, t)
    },
    async remove(coll, id) {
      const t = Date.now()
      mem[coll].delete(id)
      gone.set(`${coll}/${id}`, t)
      emit(coll); persist()
      await publishDoc(coll, id, null, t)
    },
    async uploadImage(blob) { return blobToDataUrl(await shrinkImage(blob, IMG_SIDE, IMG_BYTES)) },
    async loadMe() { const v = safe(() => localStorage.getItem('trio:me'), null); return PEOPLE_IDS.includes(v ?? '') ? (v as Person) : null },
    async saveMe(p) { safe(() => localStorage.setItem('trio:me', p), undefined) },
  }
}
