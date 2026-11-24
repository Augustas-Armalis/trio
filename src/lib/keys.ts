import type { Project, Task } from '@/types'

export const GENERAL_ID = 'general'
export const GENERAL_CODE = 'GEN'
export const CODE_RE = /^[A-Z][A-Z0-9]{1,4}$/
const KEY_RE = /^([A-Z][A-Z0-9]{1,4})-(\d+)$/

export const parseKey = (k: string) => {
  const m = KEY_RE.exec(k)
  return m ? { code: m[1], num: Number(m[2]) } : null
}

/** WEB for "Website", CO for "Client onboarding", first letters of the words, 2 to 4 characters. */
export function deriveCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  let code = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] ?? 'TSK').slice(0, 3)
  if (!/^[A-Z]/.test(code)) code = 'P' + code
  while (code.length < 2) code += 'X'
  return code
}

export function uniqueCode(base: string, projects: Project[], ignoreId?: string): string {
  const taken = new Set(projects.filter((p) => p.id !== ignoreId).map((p) => p.code))
  taken.add(GENERAL_CODE)
  let code = base
  for (let i = 2; taken.has(code); i++) code = base.slice(0, 5 - String(i).length) + i
  return code
}

export const codeFor = (projects: Project[], projectId: string): string =>
  projectId === GENERAL_ID ? GENERAL_CODE : projects.find((p) => p.id === projectId)?.code ?? GENERAL_CODE

export function nextNum(tasks: Task[], code: string): number {
  let max = 0
  for (const t of tasks) {
    const p = parseKey(t.key)
    if (p && p.code === code && p.num > max) max = p.num
  }
  return max + 1
}
