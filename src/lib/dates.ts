const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export const today = () => ymd(new Date())
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}
export const diffDays = (a: string, b: string) =>
  Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000)

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON3 = MONTHS.map((m) => m.slice(0, 3))

/** Weekday and day of month: Wed 25. */
export const shortDay = (s: string) => { const d = parseYmd(s); return `${WD[d.getDay()]} ${d.getDate()}` }

/** Next Monday strictly after today. */
export const nextMonday = (from = today()) => {
  const d = parseYmd(from)
  const add = ((8 - d.getDay()) % 7) || 7
  return addDays(from, add)
}

/** Short human label: Today, Tomorrow, Yesterday, Wed, Dec 3, Dec 3 2027. */
export function dueLabel(due: string, now = today()): string {
  const n = diffDays(due, now)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  const d = parseYmd(due)
  if (n > 1 && n < 7) return WD[d.getDay()]
  const base = `${MON3[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === parseYmd(now).getFullYear() ? base : `${base} ${d.getFullYear()}`
}

export const isOverdue = (due: string | null, done: boolean, now = today()) => !!due && !done && due < now

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  const dt = new Date(ts)
  return `${MON3[dt.getMonth()]} ${dt.getDate()}`
}

/** Monday-first 6x7 grid for a month. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)
  return Array.from({ length: 42 }, (_, i) => ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)))
}
