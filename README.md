# Trio

A shared task board for three people. Write a task, hand it to Augustas, Barbora or Rokas, give it a day, watch it move to done.

Built in the house stack: **React 19, Tailwind v4, [coss ui](https://coss.com/ui) (Base UI), Motion**, bundled with Vite into one self-contained page. Designed with the design-engine dark canon: graphite, borderless, squircle corners, memoji people, one traced mark.

## What it does

- **One big text box.** First line is the task, the rest is the detail. Paste links (they become chips) or paste/add images.
- **For, due, priority in one tap.** Assignee, due presets (Today, Tomorrow, In 2 days, Next week) or a calendar, priority Low to Urgent.
- **Status ring.** Backlog, To do, In progress, Done, Escalated. The ring is the status, the progress (the amber arc) and the done button.
- **Projects.** Group tasks, or leave them in General. Create one empty, or pick existing tasks to click into it.
- **Three views.** List (group by status, person, priority or date), Board, Calendar. Filter by person and priority; search with `/`.
- **Keys (desktop).** `C` new task, `/` search, `1` `2` `3` views, `X` on a focused row marks it done, `Cmd+Enter` creates.

## Issue keys

Every project has a short code (`WEB`, `GEN` for General) and every task gets a key like `WEB-12`. Keys never change, even if the task moves project.

- Type a key in a description, then a space: it becomes a chip. Click the chip to open that issue.
- Or type `#` and pick an issue from the list.
- Click the key in a task's header to copy it. Search finds keys too.
- No shared counter: a new task takes the next free number, and if two people create at the same moment the later one is renumbered. Tasks that predate keys are numbered in creation order on every device.

## On a phone

Phone mode is its own design (it switches at 640px), built bottom-first.

- **A dock under your thumb:** List, Board, Calendar, Filter and the big "+". Content ends above it, never under it.
- **The title is the switcher:** tap "All tasks" for a bottom drawer of My tasks, All tasks and every project.
- **Search and filter** are one bottom drawer.
- **Create:** the text is the screen; everything you can set is one row of value pills (who, due, priority, project, status, image) with the send button, right above the keyboard.
- **Swipe a task right to complete it, left for its actions.** Long-press does the same. Swipes follow the finger 1:1 and release on a spring.
- **Detail:** a big Mark done button at the bottom. Every picker is a swipeable drawer with big rows.
- **Board:** one column per screen with native scroll-snap paging; the status strip sits above the dock.
- **Calendar:** person-coloured dots, a day agenda, swipe to change month.
- **Keyboard:** the app is sized to the visual viewport, so the dock and the create bar lift above the keyboard on iOS and Android.
- Baseline: 16px inputs (no zoom), safe-area insets, no tap flash, hover only where hover exists.

## Where it syncs

| Build | Sync |
|---|---|
| Claude artifact (`dist/artifact.html`, capabilities `db`, `user`, `assets`) | Live between everyone it is shared with. Nothing to set up: no server, no keys. Needs Contributor or Editor access to write. |
| Any other host (GitHub Pages, `dist/index.html` from disk) | This browser only: nothing is shared and nothing leaves the device. |

The app uses the artifact's built-in storage when it finds it, and falls back to local storage when it doesn't.

## Develop

```bash
npm install
npm run dev        # http://localhost:5174  (?fixtures=24 sample data, ?fixtures=1000 stress, add &as=barbora to skip the first-run question)
npm run typecheck
npm run build      # dist/index.html (single file) and dist/artifact.html (the artifact fragment)
```

`?fixtures=N` seeds N tasks in memory without touching saved data; it is how the empty, one-task and 1,000-task cases were checked.

## Layout

```
src/components/ui/     coss ui (copied in, owned)
src/components/trio/   status ring, pickers, list, board, calendar, create + detail, shell, phone drawers
src/data/              store (all task rules), backends (cloud + local), fixtures
src/lib/               dates, drag-and-drop, image shrinking
DIRECTION.md           the design direction written before the first line of UI
```

## Notes

- Memoji heads are Memoji-style avatars from github.com/alohe/avatars and github.com/Wimell/Tapback-Memojis (both MIT), used here as placeholder people. The mark is `tri-blade` from the design-engine's traced logo library.
- Removing a status or priority needs a data migration: both are stored as strings on each task.
