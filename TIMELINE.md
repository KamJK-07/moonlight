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

<!-- New entries append below this line. -->
