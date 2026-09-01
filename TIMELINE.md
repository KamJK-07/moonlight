# Moonlight — Build Timeline

A running log of what's been done, how, and why — kept up to date as work
lands. `ROADMAP.md` is the checklist of *what*; this is the history of
*when and how* each item got done. Entries are appended, not rewritten.

Each entry: what shipped, how it was built (solo edit vs. agent-drafted +
reviewed + polished), and verification (typecheck/lint/test/build/CI).

---

## 2026-09-01 — CI: iOS simulator build fixed

**What**: `.github/workflows/ci.yml`'s `ios-build` job, broken since the
initial commit, now passes.

**How**: Solo diagnosis via `gh run view --log-failed` against the real
GitHub Actions run. Two sequential root causes:
1. `macos-15` runners default to Xcode 16.4 (Swift 6.1); `expo-modules-jsi`
   requires Swift tools-version 6.2 → selected Xcode 26.3.
2. Xcode 26.0–26.3's Swift 6.2.x compiler hard-errors on
   `expo-modules-jsi`'s `RuntimeScheduler` `SWIFT_RETURNS_RETAINED`
   constructor annotations — a confirmed upstream bug
   ([expo/expo#49426](https://github.com/expo/expo/issues/49426)), fixed
   in Xcode 26.4+. Switched the job to `macos-26` (default Xcode 26.6).

**Verified**: All three CI jobs green on
[run 33470665426](https://github.com/KamJK-07/moonlight/actions/runs/33470665426).

Commits: [`a7ac736`](https://github.com/KamJK-07/moonlight/commit/a7ac736),
[`29d4065`](https://github.com/KamJK-07/moonlight/commit/29d4065).

---

## 2026-09-01 — Projects: color tags, GitHub repo link, archive/restore

**What**: Wired up three `Project` fields that already existed in the data
model but had no UI (`ROADMAP.md` §4): `color` (swatch picker, shared
`PROJECT_COLORS` palette added to `packages/core`), `githubRepo` (picker
sourced from `Settings.linkedRepos`), `archived` (an Archive action plus a
restore list, replacing the old hard-delete-only path).

**How**: Solo edit — small enough, and touching shared design tokens, to
do directly rather than delegate.

**Verified**: `npm run lint`, `typecheck` (both packages), `test` (32/32),
`build --workspace packages/desktop`, `expo export --platform ios` all
clean. CI: [run 33472283934](https://github.com/KamJK-07/moonlight/actions/runs/33472283934).

Commit: [`062d646`](https://github.com/KamJK-07/moonlight/commit/062d646).

---

## 2026-09-01 — Tasks: subtasks/checklist, and Ideas: board view by status

**What**: Two roadmap items shipped in parallel:
- Tasks §3: `[ ] Subtasks / checklist within a task` → `[x]`. New `Subtask`
  type + `Task.subtasks` field, three store methods
  (`addSubtask`/`toggleSubtask`/`deleteSubtask`, all defensive against
  legacy persisted tasks missing the field), and an expandable checklist
  on `TaskRow` on both platforms with a "n/total" progress pill.
- Creative hub §6: `[~] Board view by status` → `[x]`. Desktop gets a
  real 4-column kanban; mobile gets a status filter chip row + a
  per-idea status selector (four columns don't fit a phone). Both call
  the pre-existing `store.setIdeaStatus` — no core changes needed for
  this one.

**How**: Two independent background agents, dispatched in parallel since
they touch disjoint files (Task-related files + core vs. Ideas-related
files only). Each was briefed with the exact existing conventions to
match (store method shape, TaskRow/screen structure, CSS token usage)
and told to self-verify before reporting back. Both diffs were then
reviewed by hand — read in full, checked against house conventions,
checked for the usual failure modes (missing call-site wiring, unguarded
legacy-data access) — before independently re-running the full
verification suite on the combined tree and committing.

**Verified**: `lint`, `typecheck` (all three workspaces), `test`
(37/37, 13 new), `build --workspace packages/desktop`,
`expo export` for both `ios` and `android` all clean, run independently
after both agents' changes were combined (not just trusted from either
agent's own report). CI: [run 33473146534](https://github.com/KamJK-07/moonlight/actions/runs/33473146534).

Commits: [`40a0df5`](https://github.com/KamJK-07/moonlight/commit/40a0df5)
(subtasks), [`020a375`](https://github.com/KamJK-07/moonlight/commit/020a375)
(idea board), [`1193953`](https://github.com/KamJK-07/moonlight/commit/1193953)
(ROADMAP.md checkoffs, also covering the color/repo/archive Projects
work from the previous entry that hadn't been checked off yet).

---

## 2026-09-01 — Calendar and Progress log: project pickers

**What**: Two more `[~]` roadmap items closed out:
- Calendar §2: `[~] Project-linked events` → `[x]` — a project picker in
  the add-event form on both platforms, shown as a tag/pill on each
  event row.
- Progress log §5: `[~] Attach a log entry to a specific project` →
  `[x]` — same pattern, add-entry form + tag/pill on each entry.

Neither needed core changes — `store.addEvent`/`store.addLogEntry`
already accepted `projectId`; this was purely wiring existing store
capability into a picker UI, the same shape as the earlier Projects
color/repo/archive work.

**How**: Two more independent background agents, dispatched in parallel
(disjoint files: Calendar screens vs. Log screens). Each reused this
app's existing picker idioms (desktop `<select>`, mobile chip row) by
being pointed at the established examples rather than inventing new UI.
Reviewed by hand, then re-verified independently on the combined tree.

**Verified**: `lint`, `typecheck`, `test` (37/37), desktop build, and
`expo export --platform ios` all clean, run after combining both agents'
changes.

Commits: [`6f672d8`](https://github.com/KamJK-07/moonlight/commit/6f672d8)
(log picker), [`1fd0e8a`](https://github.com/KamJK-07/moonlight/commit/1fd0e8a)
(calendar picker).

**Noted for a later polish pass**: on mobile, the calendar's project-chip
row renders below the Add button instead of above it — works correctly,
just a slightly odd visual order.

---

## 2026-09-01 — Tasks: search & filter, and Ideas: search/filter by tag

**What**:
- Tasks §3: `[ ] Search & filter` → `[x]` — a text search (substring on
  task text) plus a project filter, applied before `groupTasks` so the
  existing grouped-section rendering and empty state keep working
  unchanged on the filtered subset.
- Creative hub §6: `[ ] Search/filter by tag` → `[x]` — a tag search
  that composes with the status filter/board view added in the previous
  entry (an idea must match both to show).

**How**: Two more independent background agents, dispatched in parallel
against disjoint files (Tasks screens vs. Ideas screens — the Ideas
agent was explicitly briefed on the just-landed status-filter/kanban
work so it composed with it instead of clobbering it). Reviewed by
hand — in particular double-checked the Tasks empty-state logic
(`sections.filter(([, arr]) => arr.length > 0)`, unchanged by this diff)
still fires correctly when a filter zeroes out every group — then
re-verified independently on the combined tree.

**Verified**: `lint`, `typecheck`, `test` (37/37), desktop build, and
`expo export --platform ios` all clean.

Commits: [`66d3ee6`](https://github.com/KamJK-07/moonlight/commit/66d3ee6)
(Tasks search/filter), [`d32a29f`](https://github.com/KamJK-07/moonlight/commit/d32a29f)
(Ideas tag search).

---

## 2026-09-01 — Progress log weekly digest, and Ideas: star/archive/convert

**What**:
- Progress log §5: `[ ] Group entries by week/month, weekly digest view`
  → `[x]` — new `groupLogEntriesByWeek` core selector (Monday-start
  weeks, most recent first) and a `startOfWeek` date helper shared by
  both platforms. Entries now render under "This week" / "Last week" /
  date-range headers with a count, replacing the old flat list.
- Creative hub §6: `[ ] Star / archive favorites` and
  `[ ] Convert an idea → Project or Task in one tap` → both `[x]`.
  `Idea` gains `starred`/`archived` booleans and two store methods.
  Archive mirrors the Projects archive/restore pattern exactly; starred
  ideas sort first; "→ Task" / "→ Project" buttons call the existing
  `addTask`/`addProject` with the idea's text, then mark it `shipped`.

**How**: Two more independent background agents (disjoint files: Log
screens + a shared selector vs. Idea-related core fields + Ideas
screens). The idea-work agent was briefed to read the Ideas screens'
current state carefully first, since they'd already been through two
prior rounds of changes (status board, then tag search) in this same
session — it composed cleanly with both rather than reverting anything.
Reviewed by hand: verified the week-bucketing correctly relies on
`sortLogEntries`' date-primary sort (so same-week entries are always
contiguous — a `Sunday` edge case is covered by a dedicated test), and
that the star/archive/convert additions don't touch the recently-added
kanban/status-filter/tag-search logic beyond composing with it.

**Verified**: `lint`, `typecheck`, `test` (43/43), desktop build, and
`expo export --platform ios` all clean, run after combining both
agents' changes.

Commits: [`18d7579`](https://github.com/KamJK-07/moonlight/commit/18d7579)
(weekly digest), [`d0d8d4f`](https://github.com/KamJK-07/moonlight/commit/d0d8d4f)
(idea star/archive/convert).

---

## 2026-09-01 — Polish pass over the session's mobile UI work

**What**: A dedicated cleanup pass over everything shipped in this
session's feature rounds (Projects color/repo/archive → idea
star/archive/convert), not a new feature. Fixed the one known nit
(mobile Calendar's project-chip row rendered below the Add button
instead of above it — reordered, no logic change) and extracted a
`Chip` component (`packages/mobile/src/components/Chip.tsx`) for the
selectable-chip pattern that had been copy-pasted verbatim across four
screens (Tasks, Log, Calendar, Ideas) as each feature round added its
own picker. Net effect: same behavior, less code.

**How**: One more background agent, explicitly scoped to polish only —
briefed on the full commit range (`feca42e..HEAD`) and told not to
touch `packages/core`, not to rename anything exported, and to only
make changes it could justify as "strictly better, same behavior."
It also considered and declined a couple of consolidations (e.g. the
`chipsScroll` container's per-screen margin differences) as legitimate
per-screen variation rather than duplication worth collapsing —
included in this log because "declined to over-consolidate" is as much
a polish-pass outcome as "extracted a component."

**Verified**: reviewed the new `Chip` component and all 11 call-site
conversions by hand (each is a 1:1 behavior-preserving swap), then
independently re-ran `lint`, `typecheck`, `test` (43/43), desktop
build, and `expo export --platform ios` — all clean.

Commit: [`bdd08d4`](https://github.com/KamJK-07/moonlight/commit/bdd08d4).

---

## 2026-09-01 — Today: GitHub activity snippet, and Ideas: reference links

**What**:
- Today §1: `[ ] GitHub activity snippet (latest commit/PR today)` →
  `[x]` — a card that only appears when GitHub is connected and at
  least one repo is linked, showing a one-line summary ("2 commits,
  1 PR today") plus up to 5 items, reusing the exact
  `fetchActivityFeed`/`Pill`/row idiom `GithubScreen.tsx` already uses.
- Creative hub §6: `[ ] Attach reference links/images` → `[x]` for the
  **links** half only. `Idea` gains `links: string[]` and
  `addIdeaLink`/`removeIdeaLink`. Image attachment was deliberately
  scoped out — it needs a file/image picker and a binary storage
  design, a meaningfully larger and riskier lift than a plain string
  array. Worth splitting into its own roadmap line if picked up later.

**How**: Two more independent background agents (Today screens vs.
Idea-related core + Ideas screens). The links agent found existing,
unused precedent for opening external links safely — desktop's Electron
main process already has a `setWindowOpenHandler` whose own comment
anticipated exactly this ("a GitHub PR URL" opening in the real
browser) — and used it instead of inventing new IPC plumbing. Reviewed
by hand (in particular checked the commit/PR pill-class fallback in the
Today snippet matches `GithubScreen.tsx`'s existing, slightly-odd
"commits render with the 'open' pill style" behavior rather than being
a new inconsistency), then re-verified independently on the combined
tree.

**Verified**: `lint`, `typecheck`, `test` (47/47), desktop build, and
`expo export --platform ios` all clean.

Commits: [`21353be`](https://github.com/KamJK-07/moonlight/commit/21353be)
(Today GitHub snippet), [`98ee56e`](https://github.com/KamJK-07/moonlight/commit/98ee56e)
(idea reference links).

---

## 2026-09-01 — Project detail view, PR indicators, calendar week view, GitHub badge

**What**: The highest-risk batch of the session — one item involved
restructuring mobile navigation, so it ran as its own careful review
rather than being lumped in with lighter changes:
- Projects §4 + GitHub §7: `[ ] Project detail view` and
  `[ ] PR status indicators surfaced on linked projects` → both `[x]`.
  Mobile's Projects tab became a nested stack (`ProjectsHome` +
  `ProjectDetail`), mirroring the existing `MoreStack` pattern exactly;
  desktop got equivalent state-based routing in `Shell` (no router
  library added). The detail view shows a project's header, open PRs,
  GitHub activity (both scoped to just that project's repo), its tasks,
  and its log entries, all in one place. The Projects list also gained
  an open-PR-count pill per project.
- Calendar §2: `[ ] Week view toggle` → `[x]` — a Month/Week toggle,
  reusing a new `weekDates` core helper built on the existing
  `startOfWeek`.
- GitHub §7: `[ ] New-activity badge since last visit` → `[x]` —
  `Settings.githubActivitySeenAt` + a small dot in the nav when
  there's unseen activity.

**How**: Three agents dispatched in parallel, the first time this
session three ran concurrently. Two of the three touched
`packages/desktop/src/renderer/src/App.tsx` (project-detail routing
and the GitHub badge dot) — they applied cleanly on top of each other
with no conflict since they touched disjoint lines, confirmed by
reading the merged diff by hand rather than assuming it was fine. The
navigation restructuring got the most scrutiny of anything this
session: re-read `RootNavigator.tsx`'s typed param lists line by line
against the precedented `MoreStack` pattern, traced that the new
`ProjectsStack`'s `Tab.Screen` entry still satisfies `TabParamList`,
and ran `expo export` for *both* `ios` and `android` (not just ios)
given the stakes. Also traced through `fetchActivityFeed` (which
already folds in PRs) alongside the new dedicated open-PR fetch and
confirmed the resulting UI overlap (an open PR can appear in both the
"Open pull requests" and "GitHub activity" cards) is cosmetic
redundancy, not a bug.

**Verified**: `lint`, `typecheck`, `test` (47/47), desktop build, and
`expo export` for **both** `ios` and `android` all clean — re-run after
combining all three agents' changes and again after splitting into
three separate commits, since `App.tsx` needed care to get right.

Commits: [`8770563`](https://github.com/KamJK-07/moonlight/commit/8770563)
(project detail + PR indicators), [`6c59a96`](https://github.com/KamJK-07/moonlight/commit/6c59a96)
(calendar week view), [`9cfd2e8`](https://github.com/KamJK-07/moonlight/commit/9cfd2e8)
(GitHub activity badge).

All three CI jobs passed on this push, including the real native iOS
Xcode build against the restructured navigation — the strongest
available confirmation the mobile stack change is sound.

---

## 2026-09-01 — Two-way GitHub Issue sync for tasks

**What**: Tasks §3 / GitHub §7's shared line, `[~] Link task ↔ GitHub
Issue`, → `[x]`. Completing a task with a linked Issue now closes the
real Issue (reopens on undo); a new "→ Issue" action on tasks whose
project has a linked repo pushes them out as a new Issue. Both
directions were already partially there (import-as-task existed); this
closes the loop.

**How**: One more agent, explicitly scoped to avoid duplicating the
close/reopen logic across TaskRow's 10 render call sites — briefed to
extract one shared `useTaskGithubSync()` hook per platform instead, used
only on the main Tasks screen (Today and Project-detail's task rows
intentionally left untouched, out of scope). The sync call is
fire-and-forget with errors swallowed, so a network hiccup or
disconnected GitHub never blocks the local toggle — consistent with how
this app treats GitHub everywhere else as an enhancement, never a
dependency.

**Verified**: reviewed the new hook (identical on both platforms) and
every call-site change by hand, then `lint`, `typecheck`, `test`
(47/47), desktop build, and `expo export --platform ios` all clean.

Commit: [`6c56039`](https://github.com/KamJK-07/moonlight/commit/6c56039).

---

## 2026-09-01 — Swipe gestures on mobile TaskRow

**What**: Tasks §3, `[ ] Swipe gestures on mobile (complete / delete)`
→ `[x]`. Swipe right to complete/undo, swipe left to delete, additive
to the existing tap controls.

**How**: This one needed a new native dependency
(`react-native-gesture-handler`), so it was staged rather than handed
straight to an agent: installed it myself via `npx expo install` (picks
an SDK-57-compatible version automatically), wrapped the app root in
the required `GestureHandlerRootView`, and pushed that alone first so
CI's real Xcode/CocoaPods build could confirm the native module links
cleanly *before* any UI was built on top of it — isolating the riskiest
part (a new native dependency) from the part more likely to need
iteration (the swipe UI). Once that came back green, an agent built the
actual `Swipeable` wiring on `TaskRow`. It independently verified the
library's real exported API by reading `node_modules` source rather
than assuming from a different version's docs, since gesture-handler's
`Swipeable` export changed shape across versions. Reviewed by hand: the
`onSwipeableOpen(direction)` → complete-vs-delete mapping is easy to
get backwards, so I re-verified the `direction === 'left'` ⟷
`renderLeftActions` (revealed by swiping *right*) correspondence
directly against the library's source rather than trusting the
self-report.

**Verified**: `lint`, `typecheck`, and `expo export` for both `ios` and
`android` clean, for both the dependency-only commit and the UI commit.

Commits: [`aedf14a`](https://github.com/KamJK-07/moonlight/commit/aedf14a)
(dependency + root setup), [`1730d45`](https://github.com/KamJK-07/moonlight/commit/1730d45)
(swipe UI).

---

## 2026-09-01 — Local notification reminders (tasks + calendar events)

**What**: Calendar §2 (`[ ] Local notification reminders for upcoming
events`), Tasks §3 (`[ ] Push notification reminders`), and Settings §8
(`[ ] Notification preferences`) → all `[x]`. Calendar events with a
time get a reminder N minutes before (default 30, configurable); tasks
with a due date get one at 9am local on the due date. "Push" reminders
for tasks are local, not server-sent — this app has no custom backend
by design, so that's the only honest interpretation available.

**How**: The most product-design-heavy item this session. Staged in
three steps rather than one shot:
1. Added the `expo-notifications` dependency myself (same staged
   pattern as `react-native-gesture-handler` earlier) — `npx expo
   install`, registered its config plugin in `app.json`, verified with
   a real `expo prebuild --platform ios` and pushed alone so CI's real
   Xcode build confirmed it links cleanly before anything was built on
   top.
2. Spec'd an architecture up front rather than leaving it to the
   agent to discover: a pure, fully unit-tested core function
   (`computeReminders`) doing all the date math once, with thin
   platform adapters translating its output into actual OS calls —
   specifically to avoid subtly-different date logic drifting between
   mobile and desktop.
3. One agent built it all: the core function + 7 tests (disabled,
   no-time-event, done-task, past-fireAt, the 15-minute-offset case,
   the 7-day boundary at the exact edge, and the 60-item cap with
   soonest-first ordering — exact expected values, not just
   happy-path), the mobile scheduler (cancel-and-reschedule-everything
   on every state change, no per-item ID tracking needed), the desktop
   poller (Electron has no OS-level scheduling primitive, so it polls
   every 60s and fires while running — documented as a real limitation
   in the Settings UI, not hidden), and the Settings UI with a mobile
   permission-request flow that correctly refuses to enable the
   setting if the OS denies it.

Found and fixed one real bug in review: the desktop poller's
"already fired" tracking was keyed by reminder id alone, not
id+fireAt. Reschedule a task's due date after its original reminder
had already fired this session, and the new reminder would silently
never fire — same id, permanently marked "done" for the rest of the
app's runtime. Traced the poller's lookback-window logic by hand
(it deliberately backdates the `now` it passes to `computeReminders`
by slightly more than the poll interval, since that function excludes
anything already in the past — otherwise a reminder that became due
between two polls would never appear in either poll's results) before
finding the dedup-key issue underneath it.

**Verified**: reviewed every file by hand (the `computeReminders` date
math against `parseDateKey`'s local-time semantics in particular, to
rule out a UTC/local mismatch), then `build --workspace core`, `lint`,
`typecheck`, `test` (55/55), `build --workspace packages/desktop`, and
`expo export --platform ios` all clean — re-run after the poller fix.

Commit: [`c535d06`](https://github.com/KamJK-07/moonlight/commit/c535d06)
(feature). Dependency setup: [`245af0f`](https://github.com/KamJK-07/moonlight/commit/245af0f).

---

## 2026-09-01 — Global quick-add, GitHub milestones, commit auto-log

**What**: Three more items closed out:
- Today §1: `[ ] Global quick-add` → `[x]` — a FAB open from any screen,
  type-picker → single-field form → the same `store.add*` calls each
  screen's own full form already uses.
- Calendar §2: `[ ] GitHub milestones surfaced on the calendar` →
  `[x]` — a new `GithubClient.listMilestones`, a second dot on day
  cells, a labeled row in the agenda panel.
- Progress log §5: `[ ] Auto-entry from GitHub commits` → `[x]` — a
  manual "Sync commits to log" action, cursor-based dedup via a new
  `Settings.lastCommitLogSyncAt`, one log entry per commit (not an
  aggregated summary — more useful that way).

**How**: Two agents in parallel — one on the app-shell/navigation files
for quick-add, one on `github.ts` + Calendar + GitHub screens for the
other two (bundled together since both needed new `GithubClient`
methods, keeping edits to that file in one place rather than risking
two agents on it at once). Both were explicitly told to stay out of
each other's files. Reviewed by hand, then independently re-verified
on the combined tree.

**Verified**: `lint`, `typecheck`, `test` (56/56), desktop build, and
`expo export --platform ios` all clean.

Commits: [`30e3ad9`](https://github.com/KamJK-07/moonlight/commit/30e3ad9)
(milestones + commit log), [`49a4173`](https://github.com/KamJK-07/moonlight/commit/49a4173)
(quick-add).

---

## 2026-09-01 — Cross-device sync via a dedicated GitHub repo

**What**: Settings §8, `[ ] Cross-device sync via the private GitHub
repo` → `[x]` — the last big-ticket item, and the one with the most at
stake: this app holds real personal data (tasks, journal entries,
ideas), so anything that can overwrite it needed to be handled with
more care than a typical UI feature.

**Scope decision**: implemented as a manual "Sync now" button, not
automatic sync on launch or on every change (the roadmap line's
literal wording). Automatically syncing a whole app-state blob on
every mutation risks silently clobbering data on conflict without a
real merge strategy — this pass's comparison is "whichever side has
the newer overall timestamp wins wholesale," not a field-level merge,
which is fine for a manual, always-confirmed action but not safe to
run unattended in the background. That's an honest, deliberate
narrowing of scope, not an oversight.

**How**: Designed the protocol myself before delegating anything —
this was the one place this session where getting the architecture
right up front mattered more than usual, because the failure mode
(silent data loss) isn't something a typical review catches after the
fact if the design itself is wrong. Two things were resolved directly
rather than left to the implementing agent:
1. **Portability**: neither `btoa`/`atob` nor a `TextEncoder`
   polyfill exist in this app's React Native/Hermes runtime (confirmed
   by grepping `node_modules` and finding nothing) — needed for
   base64-encoding file content for GitHub's Contents API. Added
   `base64-js` (pure JS, operates on plain `Uint8Array`, zero
   environment dependency) as `packages/core`'s first-ever runtime
   dependency, and hand-wrote a UTF-8-safe encode/decode pair around
   it, smoke-tested myself across ASCII/emoji/CJK/astral-plane-surrogate-
   pair/control-character strings *before* handing the verified
   algorithm to the implementing agent verbatim — landed as its own
   commit, dependency-only, so CI could confirm it independently.
2. **The confirmation invariant**: every push (local → remote) and
   every pull (remote → local) must be gated behind the user
   explicitly confirming that specific action, with the dialog naming
   what gets overwritten — no exceptions, no automatic path. Wrote
   this as the literal first line of the agent's brief.

The resulting implementation: a pure `planSync(local, remote)` decision
function (`push`/`pull`/`noop`, based on comparing each side's freshest
record timestamp), `GithubClient.getFileContent`/`putFileContent`
(handles the "file doesn't exist yet" 404 case and GitHub's
base64-with-embedded-newlines response format), and a "Cross-device
sync" Settings card with a repo input (deliberately separate from
`linkedRepos` — this is meant to be a dedicated, typically-private data
repo) and the "Sync now" button.

**Verified**: this got the deepest review of anything this session.
Beyond the usual `lint`/`typecheck`/`test`/build/export pass, traced
every reachable code path on both platforms by hand — confirmed
`putFileContent` is only ever invoked from inside the push confirm
dialog's affirmative button, and `store.replaceState` only from the
pull confirm dialog's affirmative button, with no other call sites and
no path (deserialize failure, noop, network error) that reaches either
without that gate. Also independently re-verified `base64.ts` is
byte-for-byte the pre-tested algorithm, not a paraphrase.

Commit: [`61b5d91`](https://github.com/KamJK-07/moonlight/commit/61b5d91).
Dependency setup: [`e39d3bd`](https://github.com/KamJK-07/moonlight/commit/e39d3bd).

---

<!-- New entries append below this line. -->
