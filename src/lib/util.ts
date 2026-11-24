export const uid = (prefix = '') =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

/** Title is the first non-empty line; description is everything after it. */
export function splitBody(body: string): { title: string; rest: string } {
  const lines = body.replace(/\r/g, '').split('\n')
  const i = lines.findIndex((l) => l.trim())
  if (i < 0) return { title: '', rest: '' }
  return { title: lines[i].trim(), rest: lines.slice(i + 1).join('\n').trim() }
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"').,;:!?\]]/gi
export const findLinks = (text: string): string[] => Array.from(new Set(text.match(URL_RE) ?? []))
export function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return url }
}
/** Split text into plain and link parts so links can be rendered as anchors. */
export function linkify(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    out.push({ text: m[0], href: m[0] })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined
  const run = () => { t = undefined; const a = pending!; pending = undefined; fn(...a) }
  const d = (...a: A) => { pending = a; clearTimeout(t); t = setTimeout(run, ms) }
  d.flush = () => { if (t !== undefined) { clearTimeout(t); run() } }
  d.cancel = () => { clearTimeout(t); t = undefined; pending = undefined }
  return d
}
