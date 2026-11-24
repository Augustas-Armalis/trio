import { motion } from 'motion/react'
import { UserIcon } from 'lucide-react'
import type { Person, Priority, Status } from '@/types'
import { memojiOf, PERSON } from '@/data/people'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * The status ring. One glyph, three jobs: it is the status, it is the progress (the amber arc fills
 * as the work does) and it is the done button (it closes into a solid disc with a drawn check).
 */
export function StatusIcon({ status, progress = 0, size = 16, className }: { status: Status; progress?: number; size?: number; className?: string }) {
  const R = 6.25
  const C = 8
  const arc = status === 'in_progress' ? Math.min(0.96, Math.max(0.1, progress / 100)) : 0
  return (
    <svg className={cn('shrink-0 text-muted-foreground transition-transform', className)} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" data-status={status}>
      {status === 'backlog' && <circle cx={C} cy={C} r={R} stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.6 2.35" strokeLinecap="round" />}
      {status === 'todo' && <circle cx={C} cy={C} r={R} stroke="currentColor" strokeWidth="1.5" />}
      {status === 'in_progress' && (
        <>
          <circle cx={C} cy={C} r={R} stroke="var(--ring-track)" strokeWidth="1.5" />
          <motion.circle
            cx={C} cy={C} r={R} stroke="var(--amber)" strokeWidth="1.75" strokeLinecap="round" pathLength={1}
            transform={`rotate(-90 ${C} ${C})`} initial={false}
            animate={{ strokeDasharray: `${arc} 1` }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </>
      )}
      {status === 'escalated' && (
        <>
          <circle cx={C} cy={C} r={R} stroke="var(--red)" strokeWidth="1.5" fill="var(--red-soft)" />
          <path d="M8 4.9v3.5M8 10.6h.01" stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {status === 'done' && (
        <>
          <circle cx={C} cy={C} r={R + 0.75} fill="var(--foreground)" />
          <motion.path
            d="M5.1 8.2l2 2 3.8-4.4" stroke="var(--background)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.04 }}
          />
        </>
      )}
    </svg>
  )
}

/** Signal bars: more bars, more important. Urgent is the only red one (red means "needs attention"). */
export function PriorityIcon({ priority, size = 16, className }: { priority: Priority; size?: number; className?: string }) {
  if (priority === 'urgent') {
    return (
      <svg className={cn('shrink-0', className)} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3.2" fill="var(--red)" />
        <path d="M8 5.2v3.4M8 10.7h.01" stroke="#1a0b0b" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
  const n = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  const tone = priority === 'high' ? 'text-foreground' : priority === 'medium' ? 'text-foreground/70' : 'text-muted-foreground'
  return (
    <svg className={cn('shrink-0', tone, className)} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {[{ x: 3, h: 4 }, { x: 7, h: 7 }, { x: 11, h: 10 }].map((b, i) => (
        <rect key={i} x={b.x - 1} y={13.5 - b.h} width="2.5" height={b.h} rx="1.1" fill={i < n ? 'currentColor' : 'var(--bar-off)'} />
      ))}
    </svg>
  )
}

/** Person as a coss Avatar: the memoji head on a soft tint disc in their colour. */
export function PersonAvatar({ who, size = 24, className }: { who: Person | null; size?: number; className?: string }) {
  const style = { ['--avatar-size' as string]: `${size}px`, ['--pc' as string]: who ? `var(--p-${who})` : undefined }
  if (!who) {
    return (
      <Avatar style={style} className={cn('bg-transparent text-muted-foreground/60 ring-1 ring-inset ring-muted-foreground/50', className)} aria-label="Unassigned">
        <UserIcon style={{ width: size * 0.56, height: size * 0.56 }} />
      </Avatar>
    )
  }
  return (
    <Avatar style={style} className={cn('bg-[color-mix(in_oklab,var(--pc)_26%,#1a1a1d)] ring-1 ring-inset ring-white/10', className)}>
      <AvatarImage src={memojiOf(who)} alt={PERSON[who].name} draggable={false} data-memoji />
      <AvatarFallback>{PERSON[who].name[0]}</AvatarFallback>
    </Avatar>
  )
}

export function ProjectDot({ hue, size = 8 }: { hue: number | null; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: hue == null ? 'var(--muted-foreground)' : `oklch(0.76 0.1 ${hue})` }} />
}

/** Traced mark from the design-engine logo library (tri-blade): three blades turning round a centre. */
export function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 99.66 100.07" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M67.29 0.04C67.87 0 68.45 0 69.03 0.04C69.47 0.07 69.9 0.17 70.32 0.27C70.72 0.36 71.12 0.47 71.5 0.61C72.06 0.83 72.61 1.08 73.14 1.34C73.48 1.51 73.8 1.7 74.11 1.91C74.51 2.17 74.9 2.47 75.27 2.77C75.58 3.02 75.89 3.28 76.17 3.57C76.6 4.01 77.02 4.47 77.41 4.95C77.7 5.32 77.96 5.71 78.2 6.1C78.49 6.56 78.74 7.04 78.99 7.51C79.17 7.85 79.34 8.2 79.48 8.56C79.74 9.22 80 9.88 80.18 10.56C80.42 11.43 80.63 12.32 80.75 13.22C80.91 14.46 80.99 15.72 81 16.97C81 18.29 80.88 19.62 80.77 20.93C80.72 21.48 80.63 22.02 80.54 22.55C80 25.72 79.43 28.88 78.9 32.04C78.81 32.57 78.77 33.11 78.69 33.64C78.59 34.24 78.43 34.83 78.33 35.43C77.93 37.8 77.6 40.17 77.2 42.54C77.1 43.14 76.94 43.73 76.84 44.34C76.58 45.88 76.39 47.43 76.14 48.97C76.03 49.58 75.87 50.18 75.76 50.8C75.62 51.63 75.53 52.46 75.38 53.29C75.34 53.52 75.27 53.74 75.19 53.95C75.12 54.12 75.02 54.29 74.92 54.45C74.8 54.63 74.68 54.82 74.52 54.97C74.36 55.13 74.18 55.26 73.99 55.38C73.84 55.48 73.67 55.58 73.5 55.65C73.32 55.73 73.13 55.8 72.93 55.83C72.69 55.88 72.45 55.88 72.2 55.87C72.02 55.87 71.84 55.87 71.66 55.82C71.43 55.77 71.19 55.69 70.98 55.58C70.73 55.45 70.5 55.29 70.28 55.11C70.14 55 70 54.87 69.9 54.71C68.93 53.15 68.02 51.56 67.09 49.99C60.58 38.95 47.57 16.88 47.57 16.88C47.57 16.88 47.63 16.65 47.7 16.55C48.08 16.04 48.5 15.55 48.92 15.07C50.31 13.47 51.69 11.86 53.14 10.3C54.4 8.94 55.69 7.61 57.02 6.32C58.31 5.07 59.64 3.85 60.99 2.67C61.34 2.36 61.73 2.1 62.12 1.85C62.39 1.66 62.68 1.5 62.97 1.35C63.31 1.17 63.65 0.99 64.01 0.86C64.6 0.64 65.2 0.44 65.81 0.29C66.3 0.17 66.79 0.08 67.29 0.04ZM43.72 40.09C44.01 40.05 44.31 40.01 44.6 40.02C44.9 40.04 45.2 40.09 45.48 40.18C45.7 40.25 45.91 40.37 46.1 40.5C46.33 40.65 46.56 40.83 46.74 41.04C46.94 41.26 47.12 41.52 47.25 41.8C47.37 42.04 47.44 42.31 47.49 42.57C47.53 42.81 47.55 43.06 47.53 43.3C47.5 43.61 47.47 43.93 47.33 44.21C40.48 57.11 26.57 82.8 26.57 82.8C26.57 82.8 26.37 82.93 26.25 82.92C25.22 82.82 24.2 82.65 23.18 82.47C21.41 82.17 19.64 81.85 17.89 81.48C16.3 81.15 14.71 80.79 13.14 80.39C11.53 79.97 9.93 79.5 8.34 79.02C7.76 78.85 7.2 78.65 6.63 78.44C6.44 78.36 6.25 78.26 6.07 78.16C5.61 77.91 5.15 77.67 4.73 77.38C4.28 77.08 3.85 76.74 3.44 76.38C3.1 76.07 2.78 75.74 2.48 75.39C2.18 75.04 1.89 74.67 1.64 74.28C1.35 73.8 1.09 73.3 0.85 72.78C0.66 72.36 0.5 71.93 0.38 71.48C0.23 70.9 0.1 70.31 0.04 69.71C-0.02 69.12 0.01 68.53 0.01 67.94C0.01 67.63 0 67.32 0.04 67.01C0.13 66.34 0.23 65.66 0.4 65.01C0.58 64.33 0.83 63.68 1.09 63.03C1.25 62.61 1.45 62.19 1.67 61.79C1.97 61.25 2.3 60.72 2.65 60.21C2.99 59.72 3.35 59.24 3.75 58.79C4.23 58.24 4.76 57.71 5.29 57.2C5.73 56.79 6.2 56.41 6.66 56.04C7.03 55.75 7.4 55.47 7.78 55.21C8.3 54.85 8.83 54.5 9.37 54.17C9.94 53.83 10.52 53.51 11.11 53.2C11.63 52.92 12.14 52.63 12.69 52.41C22.86 48.31 33.05 44.26 43.25 40.21C43.4 40.15 43.56 40.11 43.72 40.09ZM49.83 68.21C50.17 68.13 50.52 68.12 50.87 68.12C65.12 68.1 79.37 68.1 93.62 68.13C93.8 68.13 94.16 68.21 94.16 68.21C94.16 68.21 94.36 68.58 94.44 68.78C94.71 69.48 94.97 70.18 95.2 70.89C95.9 73.03 96.61 75.17 97.24 77.32C97.71 78.94 98.12 80.58 98.52 82.22C98.79 83.3 99.03 84.39 99.24 85.48C99.39 86.23 99.56 86.99 99.62 87.75C99.68 88.57 99.66 89.39 99.59 90.2C99.54 90.74 99.4 91.28 99.26 91.8C99.13 92.28 98.97 92.75 98.78 93.2C98.56 93.7 98.31 94.19 98.03 94.66C97.8 95.04 97.53 95.39 97.24 95.73C96.99 96.04 96.72 96.34 96.43 96.61C96.08 96.94 95.7 97.24 95.31 97.53C94.99 97.77 94.65 98 94.3 98.2C93.95 98.41 93.6 98.59 93.23 98.75C92.59 99.02 91.93 99.28 91.26 99.49C90.84 99.63 90.4 99.72 89.97 99.8C89.47 99.9 88.97 99.99 88.46 100.03C87.68 100.07 86.89 100.08 86.1 100.04C85.56 100.01 85.02 99.92 84.49 99.82C83.98 99.73 83.46 99.63 82.96 99.49C82.21 99.27 81.46 99.02 80.72 98.76C80.27 98.59 79.84 98.4 79.41 98.2C78.91 97.97 78.42 97.73 77.94 97.47C77.21 97.05 76.48 96.62 75.77 96.17C75.29 95.86 74.83 95.53 74.37 95.2C73.8 94.78 73.24 94.35 72.7 93.9C64.57 87.07 56.44 80.26 48.36 73.37C48.16 73.2 48.03 72.96 47.89 72.73C47.78 72.53 47.67 72.3 47.61 72.07C47.55 71.8 47.52 71.52 47.52 71.24C47.52 70.94 47.54 70.63 47.62 70.33C47.67 70.1 47.79 69.89 47.91 69.68C48.05 69.46 48.2 69.24 48.39 69.06C48.59 68.86 48.82 68.69 49.06 68.54C49.3 68.4 49.55 68.27 49.83 68.21Z" />
    </svg>
  )
}
