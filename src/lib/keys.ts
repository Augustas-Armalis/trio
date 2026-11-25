import type { Project, Task } from '@/types'

export const GENERAL_ID = 'general'
export const GENERAL_CODE = 'GEN'
/** Project codes are 2 or 3 characters (PRO, WEB). Older projects may still carry up to 5. */
export const CODE_RE = /^[A-Z][A-Z0-9]{1,2}$/
export const LEGACY_CODE_RE = /^[A-Z][A-Z0-9]{1,4}$/
const KEY_RE = /^([A-Z][A-Z0-9]{1,4})-(\d+)$/

export const parseKey = (k: string) => {
  const m = KEY_RE.exec(k)
  return m ? { code: m[1], num: Number(m[2]) } : null
}

/** The first three letters of what you typed: "Website" -> WEB, "Marius Molis" -> MAR. You can retype it. */
export function deriveCode(name: string): string {
  const flat = name.toUpperCase().replace(/[^A-Z0-9]+/g, '')
  let code = flat.slice(0, 3) || 'TSK'
  if (!/^[A-Z]/.test(code)) code = 'P' + code.slice(0, 2)
  while (code.length < 2) code += 'X'
  return code
}

/** PRO-001: three digits so keys line up; past 999 they simply grow. */
export const makeKey = (code: string, n: number) => `${code}-${String(n).padStart(3, '0')}`

export function uniqueCode(base: string, projects: Project[], ignoreId?: string): string {
  const taken = new Set(projects.filter((p) => p.id !== ignoreId).map((p) => p.code))
  taken.add(GENERAL_CODE)
  let code = base
  for (let i = 2; taken.has(code); i++) code = base.slice(0, 3 - String(i).length) + i
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
