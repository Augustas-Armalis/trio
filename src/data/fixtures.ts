import type { Priority, Status } from '../types'
import type { RawDoc } from './backend'
import { addDays, today } from '../lib/dates'
import { GENERAL_ID } from './people'

const PROJECTS = [
  { id: 'website', name: 'Website', code: 'WEB', hue: 255 },
  { id: 'content', name: 'Content calendar', code: 'CC', hue: 24 },
  { id: 'onboarding', name: 'Client onboarding', code: 'CO', hue: 150 },
  { id: 'hiring', name: 'Hiring', code: 'HIR', hue: 300 },
]
const CODES: Record<string, string> = { general: 'GEN', website: 'WEB', content: 'CC', onboarding: 'CO', hiring: 'HIR' }
const TITLES: [string, string?][] = [
  ['Rewrite the pricing page headline', 'Current one is too long on mobile. Try three options and pick one with Rokas.'],
  ['Record the onboarding walkthrough', 'Keep it under four minutes. https://www.loom.com/share/example'],
  ['Fix the invoice export for EU clients'],
  ['Book the photographer for the team shots'],
  ['Review the new logo set', 'Compare against the brief and write down what to keep.'],
  ['Send the contract to the Vilnius studio'],
  ['Plan next week’s posts', 'Four posts, one thread, one video. Hooks first.'],
  ['Clean up the shared drive'],
  ['Write the case study intro'],
  ['Set up weekly metrics email'],
  ['Prepare the Friday demo', 'Dry run on Thursday at 16:00.'],
  ['Reply to the partnership request'],
  ['Update the brand colours in Figma'],
  ['Audit the signup funnel drop-off'],
  ['Order laptop stands'],
  ['Draft the hiring post for a junior designer'],
  ['Check the broken links on the blog'],
  ['Interview notes: summarise the three calls'],
  ['Tidy the roadmap and cut anything stale'],
  ['Refresh the pitch deck numbers'],
]
const PEOPLE = ['augustas', 'barbora', 'rokas'] as const
const STATUSES: Status[] = ['backlog', 'todo', 'todo', 'in_progress', 'in_progress', 'done', 'done', 'escalated']
const PRIORITIES: Priority[] = ['low', 'medium', 'medium', 'high', 'urgent']

export function makeFixtures(n: number): Record<'tasks' | 'projects', RawDoc[]> {
  const now = Date.now()
  const projects: RawDoc[] = PROJECTS.map((p, i) => ({ ...p, createdAt: now - 86400000 * (10 - i), rank: i }))
  const tasks: RawDoc[] = []
  const ids = [GENERAL_ID, ...PROJECTS.map((p) => p.id)]
  const counters: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const [title, desc] = TITLES[i % TITLES.length]
    const status = STATUSES[(i * 7 + 3) % STATUSES.length]
    const offset = ((i * 5) % 17) - 5
    const due = i % 6 === 5 ? null : addDays(today(), offset)
    const progress = status === 'done' ? 100 : status === 'in_progress' ? [25, 50, 75][i % 3] : 0
    const project = ids[(i * 3) % ids.length]
    counters[project] = (counters[project] ?? 0) + 1
    tasks.push({
      id: `fx${i}`,
      key: `${CODES[project]}-${counters[project] + 100}`,
      body: (n > TITLES.length ? `${title} ${Math.floor(i / TITLES.length) + 1}` : title) + (desc ? `\n${desc}` : ''),
      project,
      status,
      priority: PRIORITIES[(i * 3 + 1) % PRIORITIES.length],
      assignee: i % 9 === 8 ? null : PEOPLE[i % 3],
      due,
      progress,
      images: [],
      rank: -(now - i * 60000),
      createdBy: PEOPLE[(i + 1) % 3],
      createdAt: now - i * 3600000,
      updatedAt: now - i * 1800000,
      doneAt: status === 'done' ? now - i * 900000 : null,
    })
  }
  return { tasks, projects }
}
