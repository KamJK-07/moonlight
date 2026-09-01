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

---

<!-- New entries append below this line. -->
