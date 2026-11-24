import { addDays, nextMonday, today } from './dates'

/** Today, Tomorrow, In 2 days, Next week: the four one-tap due dates. */
export const PRESETS = (now = today()) => [
  { label: 'Today', date: now },
  { label: 'Tomorrow', date: addDays(now, 1) },
  { label: 'In 2 days', date: addDays(now, 2) },
  { label: 'Next week', date: nextMonday(now) },
]
