# Trio: handover

A shared task board (list, kanban, calendar) for three people. React 19, Vite, Tailwind v4, coss ui (Base UI), Motion. One static page, no server. Read this first, then `README.md` and `DIRECTION.md` (design direction).

## Run, test, ship

```bash
npm install
npm run dev            # http://localhost:5174 (plain URL = local-only data)
npm run build          # tsc + vite single file + dist/artifact.html
bash scripts/deploy-pages.sh   # publishes dist/ to the gh-pages branch
```

- `?fixtures=N&as=augustas` loads N fake tasks and skips the first-run question. Local only, never syncs. Use it for every manual check.
- There is no test runner in the repo. Checks were Playwright scripts kept outside it. A good first job is to move them in (`tests/`). They covered: create / done / undo, task view, board and calendar drag, bulk select, command menu, shortcuts, projects (create / copy / move / delete), phone touch flows, two-browser sync.
- The deploy script pins a noreply git identity on purpose. Never commit with a personal email (the repo is public).

## Where things are

```
src/types.ts                types
src/data/store.ts           all state and actions (one small store, no library)
src/data/backend.ts         Backend interface; artifact backend; local backend
src/data/room.ts            shared sync over public Nostr relays (see below)
src/data/people.ts          people, statuses, priorities; isClosed()
src/lib/keys.ts             project codes + issue keys (PRO-001)
src/components/ui/          coss ui primitives (copied in; use size props, do not restyle with padding)
src/components/trio/        the app: list, board, calendar, shell (sidebar/toolbar), surfaces (dialogs, task view),
                            phone*.tsx (phone layout), palette (Cmd+K), bulk, sync, picker, parts
src/App.tsx                 layout switch (phone vs desktop) + ALL keyboard shortcuts (useShortcuts)
public/                     favicons, og.png, manifest, robots, sitemap
```

## Data model

`Task`: `id, key (PRO-001, never changes), body (first line = title), project, status, priority, assignees[] (+ assignee = first, kept for old copies), due (YYYY-MM-DD), progress 0-100, images[] (data URLs), rank, createdBy, createdAt, updatedAt, doneAt, prev`.
`Project`: `id, name, code (2-3 chars), hue, rank`. "General" is built in (`GENERAL_ID`, code `GEN`).
Statuses: `backlog, todo, in_progress, done, cancelled, escalated`. Done and cancelled are "closed" (`isClosed`). The Escalated and Cancelled board columns only show when non-empty or while dragging.

Docs are stored as plain objects (`toDoc`) and normalised on read (`normTask`). Old docs with a single `assignee` still load.

Issue keys: no shared counter. The next free number per project code is computed locally; duplicates are fixed by the device that created them; tasks without a key are back-filled in creation order (`reconcileKeys`).

## How sync works today (the part you will probably replace)

Three backends implement `Backend` (`subscribe / set / update / remove / uploadImage / loadMe / saveMe`):
1. **Artifact backend**: inside the Claude artifact viewer (`window.claude.use('db')`). Separate data, lives in the owner's Claude account.
2. **Local backend**: localStorage, used on localhost and `?fixtures`.
3. **Room backend** (`room.ts`): on `*.github.io` every visitor joins ONE shared board. Each task/project is an encrypted replaceable Nostr event (kind 30078) on four public relays. The encryption and signing keys are derived from a secret string. Newest write per doc wins (`_t` timestamp); deletes are tombstones. Devices re-publish what a relay is missing after it answers.

Known problems with the room backend, which is why a real database is the next step:
- The room secret is a constant in `room.ts` (`PUBLIC_ROOM`) in a PUBLIC repo, so anyone can read and edit the board. It is not an API key, but it is not private.
- Public relays can drop events; there is no guarantee or backup.
- Images are shrunk to ~36 KB each because relays reject big events.
- No users, no permissions, no history, no export.
- Whole-document last-write-wins: two people editing the same task within a second lose one change.

**Moving to a database** is mostly one file: write a new `Backend` (e.g. Supabase/Postgres with realtime) next to `room.ts` and choose it in `src/main.tsx` (`boot()`). Everything above the store stays the same. Do these in order:
1. Add an **export** (JSON of tasks + projects) to the current board first, so nothing is lost.
2. Create tables `tasks` and `projects` with the fields above (store `assignees` as an array, keep `key` unique per project), add auth (even just a shared invite) and row-level rules.
3. Import the export, keeping `id` and `key` unchanged (keys are referenced inside task text and links).
4. Switch `boot()`, remove `PUBLIC_ROOM`, delete `room.ts` and the `@noble/*` dependencies.
5. Move images to object storage and store URLs (the size limits go away).

Existing browsers hold a cache (`trio:room-cache`) and a one-time import flag (`trio:room-imported`). A new backend should ignore both.

## Behaviour worth keeping

- Phone is its own layout under 640 px (bottom dock, drawers, swipe to complete, long-press actions). Create is a full-screen layer pinned to the visual viewport so the keyboard never covers the property pills.
- Past dates are blocked in every date picker and in calendar drops.
- Every destructive action has Undo. Closing the create screen with text offers to bring the draft back.
- Keyboard: `?` lists them. Shortcuts live only in `useShortcuts` in `App.tsx`. Do not also bind keys on rows (it double-fires).
- Cmd+K palette acts on the open or focused task.
- Colour meaning is fixed: red = needs attention, amber = work in motion, person tints = who, project colour = which project (coloured edge + tinted chip in All).
- Greys are neutral on purpose (no blue cast). Font is Geist, one weight heavier than regular.

## Gotchas that already bit us

- Components inside `AnimatePresence` must not read store state that becomes null on exit (it crashed phone create once). Pass props instead.
- Scroll containers that hold Motion `layout` children need `layoutScroll` (list and board have it).
- The Base UI toast is also `role="dialog"`: shortcut blocking matches `data-slot` popups, not roles.
- The app is inert behind the phone create layer.
- Pages serves `dist/` with `base: './'`. The share image and canonical URL in `index.html`, `public/sitemap.xml` and `public/robots.txt` are absolute and still say `augustas-armalis.github.io`. Update them after the repo moved.
- `dist/artifact.html` is the page fragment for the Claude artifact tool. It is separate from Pages and has its own data.

## Open ideas

Export/import, a real database, user accounts, comments on tasks, notifications, recurring tasks, saved views per project, true multi-field merge instead of whole-task last-write-wins, a test suite in the repo.
