import { ExternalLinkIcon, ImageIcon, Link2Icon, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { setState, toast, uploadImage } from '@/data/store'
import { shrinkImage } from '@/lib/image'
import { findLinks, hostOf } from '@/lib/util'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { RichText, caretAtStart, focusStart } from './richtext'

const MAX_IMAGES = 8
const FIELD = 'block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none'

function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}

const splitRaw = (v: string) => {
  const i = v.indexOf('\n')
  return i < 0 ? { title: v, rest: '' } : { title: v.slice(0, i), rest: v.slice(i + 1) }
}
const join = (title: string, rest: string) => (rest ? `${title}\n${rest}` : title)

/**
 * One big text box, built as two stacked fields: the first line is the task, the rest is the detail.
 * Enter in the title drops to the detail, Backspace at the start of the detail joins it back.
 */
export function TaskText({
  value, onChange, autoFocus, onFiles, titlePlaceholder = 'What needs doing?', restPlaceholder = 'Add details. Paste links or images.', big,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  onFiles?: (files: File[]) => void
  titlePlaceholder?: string
  restPlaceholder?: string
  big?: boolean
}) {
  const { title, rest } = splitRaw(value)
  const tRef = useRef<HTMLTextAreaElement>(null)
  const rRef = useRef<HTMLDivElement>(null)
  useAutosize(tRef, title)
  const caret = useRef<{ el: 't' | 'r'; at: number } | null>(null)
  useLayoutEffect(() => {
    const c = caret.current
    if (!c) return
    caret.current = null
    if (c.el === 'r') return focusStart(rRef.current)
    tRef.current?.focus()
    tRef.current?.setSelectionRange(c.at, c.at)
  })
  useEffect(() => { if (autoFocus) tRef.current?.focus({ preventScroll: true }) }, [autoFocus])

  /** Put the caret in a field. If the text changes it lands after the re-render; if not, there is no re-render, so move now. */
  const moveCaret = (el: 't' | 'r', at: number, next: string) => {
    if (next === value) {
      if (el === 'r') return focusStart(rRef.current)
      tRef.current?.focus()
      tRef.current?.setSelectionRange(at, at)
      return
    }
    caret.current = { el, at }
    onChange(next)
  }
  const onTitleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const at = e.currentTarget.selectionStart
      const before = title.slice(0, at)
      const after = title.slice(at)
      moveCaret('r', 0, join(before, after ? (rest ? `${after}\n${rest}` : after) : rest))
    }
    if (e.key === 'ArrowDown' && e.currentTarget.selectionStart === title.length) focusStart(rRef.current)
  }
  const onRestKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (e.key === 'Backspace' && caretAtStart(el)) {
      e.preventDefault()
      const nl = rest.indexOf('\n')
      const first = nl < 0 ? rest : rest.slice(0, nl)
      const remainder = nl < 0 ? '' : rest.slice(nl + 1)
      moveCaret('t', title.length, join(title + first, remainder))
    }
    if (e.key === 'ArrowUp' && caretAtStart(el)) tRef.current?.focus()
  }
  const onTitlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return
    e.preventDefault()
    const el = e.currentTarget
    const merged = title.slice(0, el.selectionStart) + text.replace(/\r/g, '') + title.slice(el.selectionEnd)
    onChange(join(merged, rest))
  }
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length && onFiles) { e.preventDefault(); onFiles(files) }
  }

  return (
    <div className="flex flex-col gap-1.5" onPaste={onPaste}>
      <textarea
        ref={tRef} rows={1} value={title} placeholder={titlePlaceholder} aria-label="Task" spellCheck
        className={cn(FIELD, 'font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/45', big ? 'text-[22px] leading-[30px]' : 'text-xl leading-7')}
        onChange={(e) => onChange(join(e.target.value.replace(/\n/g, ' '), rest))}
        onKeyDown={onTitleKey} onPaste={onTitlePaste}
      />
      <RichText
        value={rest} onChange={(r) => onChange(join(title, r))} placeholder={restPlaceholder} inputRef={rRef} onKeyDown={onRestKey}
        className={cn('min-h-12', big && 'min-h-24 max-sm:min-h-20')}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- images */

export function useImages(images: string[], setImages: (next: string[]) => void) {
  const [busy, setBusy] = useState(0)
  const latest = useRef(images)
  latest.current = images
  const add = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    const room = MAX_IMAGES - latest.current.length
    if (room <= 0) return toast(`A task holds up to ${MAX_IMAGES} images.`)
    setBusy((n) => n + 1)
    try {
      const urls: string[] = []
      const inline = () => [...latest.current, ...urls].filter((u) => u.startsWith('data:')).reduce((n, u) => n + u.length, 0)
      for (const f of imgs.slice(0, room)) {
        const small = await shrinkImage(f)
        const url = await uploadImage(small)
        // Without upload access an image is stored inside the task, and a task is capped at 256 KiB.
        if (url.startsWith('data:') && inline() + url.length > 190_000) {
          toast('That image is too big to attach here. Ask for edit access to upload larger images.')
          continue
        }
        urls.push(url)
      }
      if (urls.length) {
        const next = [...latest.current, ...urls]
        latest.current = next
        setImages(next)
      }
    } catch {
      toast('Couldn’t add that image. Try a smaller one.')
    } finally {
      setBusy((n) => n - 1)
    }
  }, [setImages])
  return { add, busy }
}

export function AddImageButton({ onFiles, busy, label = 'Add image', pill }: { onFiles: (f: File[]) => void; busy?: boolean; label?: string; pill?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      {pill ? (
        <Button type="button" variant="secondary" size="icon" className="shrink-0 rounded-full" aria-label="Add image" onClick={() => ref.current?.click()} disabled={busy}><ImageIcon /></Button>
      ) : (
        <Button type="button" variant="ghost" onClick={() => ref.current?.click()} disabled={busy}>
          <ImageIcon />{busy ? 'Adding…' : label}
        </Button>
      )}
    </>
  )
}

export function ImageStrip({ images, onRemove }: { images: string[]; onRemove?: (i: number) => void }) {
  if (!images.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {images.map((src, i) => (
          <motion.div
            key={src.length > 400 ? `${i}-${src.length}-${src.slice(-24)}` : src} layout="position"
            className="group/img relative size-21 overflow-hidden rounded-xl bg-muted"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <button type="button" className="block size-full" onClick={() => setState({ lightbox: src })} aria-label="View image"><img src={src} alt="" draggable={false} className="size-full object-cover" /></button>
            {onRemove ? (
              <Button type="button" variant="secondary" size="icon-xs" className="absolute top-1 right-1 rounded-full bg-black/65 text-white opacity-100 hover:bg-black/80 sm:opacity-0 sm:group-hover/img:opacity-100 sm:focus-visible:opacity-100" onClick={() => onRemove(i)} aria-label="Remove image"><XIcon /></Button>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function LinkChips({ text }: { text: string }) {
  const links = findLinks(text)
  if (!links.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {links.slice(0, 6).map((u) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-8 max-w-60 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-sm text-foreground/80 no-underline transition-colors active:bg-accent sm:h-6.5 sm:text-xs [@media(hover:hover)]:hover:bg-accent">
          <Link2Icon className="size-3.5 shrink-0" /><span className="truncate">{hostOf(u)}</span><ExternalLinkIcon className="size-3 shrink-0 opacity-50" />
        </a>
      ))}
    </div>
  )
}
