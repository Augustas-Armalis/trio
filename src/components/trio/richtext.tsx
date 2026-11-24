import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '@/types'
import { openTask, titleOf, useKeyIndex, useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import type { ComposerItemValue, ComposerPart, ComposerTokenPart, ComposerValue } from '@/lib/composer-document'
import { Composer, ComposerInput, ComposerItem, ComposerList, ComposerPopup } from '@/components/ui/composer'
import { StatusIcon } from './primitives'

const KEY_RE = /\b([A-Za-z][A-Za-z0-9]{1,4}-\d+)\b/g

const tokenFor = (t: Task): ComposerTokenPart => ({ type: 'mention', id: t.id, label: t.key, trigger: '#', kind: 'issue', text: t.key })

/** Plain text with issue keys -> editor parts. `typing` waits for a space or newline after a key so WEB-1 is not linked while you are still typing WEB-12. */
export function toParts(text: string, keys: Map<string, Task>, typing = false): ComposerValue {
  const parts: ComposerPart[] = []
  let last = 0
  const push = (s: string) => { if (s) parts.push({ type: 'text', text: s }) }
  for (const m of text.matchAll(KEY_RE)) {
    const at = m.index ?? 0
    const end = at + m[0].length
    const t = keys.get(m[0].toUpperCase())
    if (!t || (typing && !/\s/.test(text[end] ?? ''))) continue
    push(text.slice(last, at))
    parts.push(tokenFor(t))
    last = end
  }
  push(text.slice(last))
  return parts
}

export const fromParts = (parts: ComposerValue): string => parts.map((p) => (p.type === 'text' ? p.text : (p.text ?? p.label))).join('')

/** After an edit: link keys that now have a trailing space, leave existing tokens alone. */
function linkTyped(parts: ComposerValue, keys: Map<string, Task>): ComposerValue {
  let changed = false
  const out: ComposerPart[] = []
  for (const p of parts) {
    if (p.type !== 'text') { out.push(p); continue }
    const next = toParts(p.text, keys, true)
    if (next.length !== 1 || next[0].type !== 'text') changed = true
    out.push(...next)
  }
  return changed ? out : parts
}

function IssueChip({ token }: { token: ComposerTokenPart }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === token.id))
  return (
    <button
      type="button" contentEditable={false} title={task ? titleOf(task) : 'Deleted task'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); if (task) openTask(task.id) }}
      className={cn(
        'mx-px inline-flex cursor-pointer items-center gap-1 rounded-md bg-foreground/10 px-1.5 align-baseline text-[0.92em] leading-[1.45] font-medium text-foreground outline-none transition-colors active:bg-foreground/20 focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-foreground/16',
        !task && 'text-muted-foreground line-through',
      )}
    >
      {task ? <StatusIcon status={task.status} progress={task.progress} size={13} /> : null}
      <span>{token.label}</span>
    </button>
  )
}

export function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed || !el.contains(sel.anchorNode)) return false
  const r = document.createRange()
  r.setStart(el, 0)
  r.setEnd(sel.anchorNode as Node, sel.anchorOffset)
  return r.toString() === '' && !r.cloneContents().querySelector('[data-composer-token]')
}

export function focusStart(el: HTMLElement | null) {
  if (!el) return
  el.focus({ preventScroll: true })
  const sel = window.getSelection()
  const r = document.createRange()
  r.setStart(el, 0)
  r.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(r)
}

/**
 * The description: plain text that turns issue keys into clickable chips. Type WEB-12 and a space, or type # and pick
 * an issue. Saves as an ordinary string (the chip is the key), so nothing else has to know about it.
 */
export function RichText({
  value, onChange, placeholder, className, inputRef, onKeyDown,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  inputRef?: RefObject<HTMLDivElement | null>
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
}) {
  const keys = useKeyIndex()
  const tasks = useStore((s) => s.tasks)
  const [parts, setParts] = useState<ComposerValue>(() => toParts(value, keys))
  // Take outside changes (another person's edit, a reset) when they differ from what is on screen.
  useEffect(() => { if (fromParts(parts) !== value) setParts(toParts(value, keys)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  // When keys appear or disappear (a new task, a deletion), re-link what is already written.
  useEffect(() => { setParts((p) => { const next = toParts(fromParts(p), keys); return fromParts(next) === fromParts(p) ? next : p }) }, [keys])

  const items = useMemo<ComposerItemValue[]>(
    () => [...tasks].filter((t) => t.key).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 60).map((t) => ({
      id: t.id, label: t.key, description: titleOf(t), type: 'mention' as const, kind: 'issue', text: t.key, icon: <StatusIcon status={t.status} progress={t.progress} size={16} />,
    })),
    [tasks],
  )

  return (
    <Composer
      value={parts}
      onValueChange={(next, details) => {
        const out = details.reason === 'input' ? linkTyped(next, keys) : next
        setParts(out)
        onChange(fromParts(out))
      }}
      triggers={[{
        character: '#', items,
        filter: (item, q) => { const n = q.toLowerCase(); return !n || item.label.toLowerCase().includes(n) || (item.description ?? '').toLowerCase().includes(n) },
      }]}
      submitOnEnter="never" allowEmpty
      className="min-h-0 rounded-none border-0 bg-transparent p-0 pb-0 shadow-none ring-0 before:hidden has-[[data-slot=composer-input]:focus-visible]:border-0 has-[[data-slot=composer-input]:focus-visible]:ring-0 dark:bg-transparent"
    >
      <ComposerInput
        ref={inputRef} placeholder={placeholder} renderToken={(t) => <IssueChip token={t} />} onKeyDown={onKeyDown}
        className={cn('px-0 py-0 text-base leading-6 text-foreground/80 placeholder:text-muted-foreground/50 sm:text-[15px] md:min-h-0', className)}
      />
      <ComposerPopup className="w-80 max-w-[calc(100vw-2rem)]" side="bottom">
        <ComposerList>
          {(item) => (
            <ComposerItem key={item.id} value={item} className="min-h-11 gap-2.5 rounded-lg px-2.5 text-sm sm:min-h-9">
              {item.icon}
              <span className="text-muted-foreground">{item.label}</span>
              <span className="min-w-0 flex-1 truncate">{item.description}</span>
            </ComposerItem>
          )}
        </ComposerList>
      </ComposerPopup>
    </Composer>
  )
}
