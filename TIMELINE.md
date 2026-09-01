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

<!-- New entries append below this line. -->
