# Trio direction

Built with the design-engine (Cortex brain): house-style dark borderless graphite, product-UI motion system (live UI, not recorded content), Linear dark benchmark for density, memoji avatars, a Pinterest-traced mark from `system/logo/library`.

scope: "a really simple but super well designed, round corners, dark mode, borderless sleek look, animated framer motion... linear type shit just simpler" — a shared task board for three people. Nothing outside tasks, projects, people, dates, priority, progress, list/board/calendar.

## The five lines
direction.product: Trio is the shared task board for Augustas, Barbora and Rokas: write what needs doing, hand it to one of the three, give it a day, and watch it move to done.
direction.character: quick, hand-held, steady.
direction.world: three desks pushed together in a studio after hours. One lamp, three chairs. A task is an index card: you write it, clip it on someone's rail, and slide it down the bench until it's done.
direction.moments: (1) the create sheet, a big blank card you just write on; (2) the status ring, the one glyph that is the status, the progress and the done button.
direction.signature: the status ring. It is a ring that fills in lamp amber as the work does. Click it and it closes into a solid disc with a drawn check. Nothing else in the product is as alive as that ring.
direction.tint: graphite #0E0E0F page, #151517 panel, #171719 wells, #1F1F22 cards, ring white 7.5%. Never blue.
direction.accent: lamp amber oklch(0.80 0.14 75). Used only for work in progress and keyboard focus. The primary button is the pale inverse pill (house dark ink).
direction.type: Inter (opsz, cv11, ss01) 14/20 500 for product, tabular figures for dates, counts and percentages. One family: no mono in the product (founder 2026-11-25: date text looked inconsistent).
personality: inter / round (squircle) / minimal buttons inside product, one pale primary per view.

## Metaphor (HD-01)
Trio hands work to a person; handing looks like clipping an index card to their rail.

## Colour meaning (one job each)
- red = something is wrong: urgent, escalated, overdue. Nothing else is red.
- amber = work in motion: in-progress ring, focus.
- person tints (3) = who: a ring around the memoji and a small dot in filters. Never a fill on a card.
- everything else is graphite and near-white.
override: one-accent because the brief names three person colours and a priority scale; each is a tint on a 20-28px circle or a 6-8px dot, never a fill, chromatic pixels stay well under 3% of the screen.

## Motion (live product, `motion-system.md`)
- one settle curve cubic-bezier(.16,1,.3,1); 160 quick, 240 standard, 320 slow.
- springs only for things you touch (sliding view pill 260/26, board card drop).
- popovers grow from their trigger (--transform-origin) from scale .96; dialogs from centre; never scale(0).
- exits shorter than entrances; removed rows leave layout at once.
- keyboard-triggered actions and anything used all day (toggle done by key, filter) do not animate their layout.
- reduced motion: final state, no layout travel.

## Break it before showing (break-ui)
empty, 1 task, 1,000 tasks (`?fixtures=0|1|1000` on the local build, no visible label); long titles; no assignee; no date; image-only task; 390px phone; two tabs editing at once.

## Template check (UNS-84)
template-check: swap Trio for Linear: the shell, density and status glyph family fit Linear on purpose (the brief says "linear type shit just simpler"); the three-person rails, index-card create sheet and the ring that is also the done button do not fit Linear: no, not a template.

## Stack and mobile (round 2)
stack: Vite + React 19 + Tailwind v4 + coss ui (Base UI) + Motion, one self-contained page. coss tokens carry the graphite canon; `--radius` is scaled by the squircle factor.
mobile.shape: phone is a separate composition at 640px: bottom tab bar in the layout flow, thumb-reach "+", drawers for every picker, one board column per screen.
mobile.gestures: swipe-right completes (track 1:1, spring seeded with release velocity, dismiss on distance or flick), long-press opens actions (menu stays open until the pressing finger lifts), drawers swipe down. Board paging and month change use native scroll-snap and a plain horizontal swipe.
mobile.baseline: skill `mobile-native` applied (16px inputs, dvh, safe areas, hover only where hover exists, no tap flash, overscroll none).
gate: `tools/check.mjs` 0 fail / 34 pass at 1440 and 390; `concentric_audit.cjs` clean after fixes. Real-touch Playwright suite: swipe, long-press, drawer dismiss, paging.
