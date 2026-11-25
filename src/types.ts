export type Person = 'augustas' | 'barbora' | 'rokas'
export type Status = 'backlog' | 'todo' | 'in_progress' | 'done' | 'escalated'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type ViewKind = 'list' | 'board' | 'calendar'
export type GroupBy = 'status' | 'person' | 'priority' | 'due' | 'project'
export type SortBy = 'manual' | 'due' | 'priority' | 'newest'

export interface Task {
  id: string
  /** Issue key such as WEB-12. Assigned once, never changes, so references stay valid when a task moves project. */
  key: string
  /** First line is the title, the rest is the description. */
  body: string
  project: string
  status: Status
  priority: Priority
  /** Everyone this is for. `assignee` is the first of them (kept for older copies and simple checks). */
  assignees: Person[]
  assignee: Person | null
  /** YYYY-MM-DD in the viewer's local calendar. */
  due: string | null
  progress: number
  images: string[]
  rank: number
  createdBy: Person | null
  createdAt: number
  updatedAt: number
  doneAt: number | null
  /** Status before it was marked done, so un-doing returns it where it was. */
  prev: Status | null
}

export interface Project {
  id: string
  name: string
  /** Short code for issue keys: WEB gives WEB-1, WEB-2. */
  code: string
  hue: number
  createdAt: number
  rank: number
}

/** Where the left rail points: everything, only my work, or one project. */
export type Scope = { kind: 'all' } | { kind: 'mine' } | { kind: 'project'; id: string }
