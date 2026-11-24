import type { Person, Priority, Status } from '../types'
import { MEMOJI } from './memoji'

export const PEOPLE: { id: Person; name: string; short: string }[] = [
  { id: 'augustas', name: 'Augustas', short: 'Augustas' },
  { id: 'barbora', name: 'Barbora', short: 'Barbora' },
  { id: 'rokas', name: 'Rokas', short: 'Rokas' },
]
export const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.id, p])) as Record<Person, (typeof PEOPLE)[number]>
export const memojiOf = (p: Person) => MEMOJI[p]

export const STATUSES: { id: Status; label: string; hint: string }[] = [
  { id: 'backlog', label: 'Backlog', hint: 'Someday' },
  { id: 'todo', label: 'To do', hint: 'Ready to start' },
  { id: 'in_progress', label: 'In progress', hint: 'Being worked on' },
  { id: 'done', label: 'Done', hint: 'Finished' },
  { id: 'escalated', label: 'Escalated', hint: 'Needs attention now' },
]
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<Status, (typeof STATUSES)[number]>

export const PRIORITIES: { id: Priority; label: string; weight: number }[] = [
  { id: 'urgent', label: 'Urgent', weight: 4 },
  { id: 'high', label: 'High', weight: 3 },
  { id: 'medium', label: 'Medium', weight: 2 },
  { id: 'low', label: 'Low', weight: 1 },
]
export const PRIORITY = Object.fromEntries(PRIORITIES.map((p) => [p.id, p])) as Record<Priority, (typeof PRIORITIES)[number]>

export const GENERAL_ID = 'general'
export const PROJECT_HUES = [24, 52, 96, 150, 200, 255, 300, 340]
