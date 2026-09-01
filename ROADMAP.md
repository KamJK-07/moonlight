# Moonlight — Roadmap

Moonlight is Kameron's personal creative hub: calendar, tasks, projects,
progress tracking, and idea capture — native on iOS and Windows, with
GitHub and Claude wired in as first-class citizens rather than bolt-ons.

This document is the standard the build is measured against. Each system
below carries 5–10 concrete capabilities. `[x]` shipped and works on both
the iOS app and the Windows app (verified: unit tests, a real Electron
build, and a real Metro/iOS bundle export — see README.md's CI section
for how that verification continues past this session). `[~]` means the
data model and part of the feature exist but the UI isn't wired up yet.
`[ ]` is backlog. Nothing here is aspirational filler.

## 1. Today (home)

- [x] Personalized greeting + live date
- [x] Stat strip: due today, overdue, active projects, day streak
- [x] "On deck" — merged overdue + due-today task list, one tap to complete
- [x] Today's calendar events at a glance
- [x] Quick progress-log capture inline, no tab switch
- [x] GitHub activity snippet (latest commit/PR today)
- [ ] Global quick-add (task/event/log/idea from one button, any screen)

## 2. Calendar

- [x] Month grid with event dots
- [x] Tap a day → agenda list + add/edit/delete event
- [x] Jump-to-today
- [x] Week view toggle
- [ ] Recurring events (daily/weekly/monthly)
- [ ] Local notification reminders for upcoming events
- [x] Project-linked events — picker in the add-event form, shown as a tag on each event
- [ ] GitHub milestones surfaced on the calendar

## 3. Tasks

- [x] Add task: title, due date, project link, priority
- [x] Complete/uncomplete, delete
- [x] Grouped view: overdue / today / upcoming / no date / done
- [x] Priority levels with visual indicator
- [x] Search & filter
- [x] Subtasks / checklist within a task
- [ ] Push notification reminders
- [x] Link task ↔ GitHub Issue — two-way: completing a linked task
      closes the Issue (and reopens it on undo), and a "→ Issue" action
      pushes a task with no linked Issue out as a new one
- [x] Swipe gestures on mobile (complete / delete), additive to the
      existing tap controls

## 4. Projects

- [x] Create project: name, status, description
- [x] Status pill (active / paused / done)
- [x] Progress bar computed from linked tasks
- [x] Notes field
- [x] Link project → GitHub repo — picker sourced from Settings' linked repos
- [x] Project detail view: tasks + log entries + GitHub activity in one place
- [x] Archive completed projects — Archive action + a restore list
- [x] Color tag per project — swatch picker, shared palette in core

## 5. Progress log

- [x] Daily freeform journal entries
- [x] Day-streak tracking
- [x] Quick-log from Today
- [x] Group entries by week/month, weekly digest view
- [x] Attach a log entry to a specific project — picker in the add-entry form, shown as a tag on each entry
- [ ] Auto-entry from GitHub commits ("shipped 4 commits to moonlight")

## 6. Creative hub (ideas)

- [x] Quick capture: text + tag
- [x] "Ask Claude to riff" — real Anthropic API call (not a stub), on
      both platforms; needs an API key connected in Settings
- [x] Convert an idea → Project or Task in one tap
- [x] Board view by status — kanban columns on desktop, filter chips + a
      per-idea status selector on mobile
- [x] Attach reference links — `Idea.links: string[]`; image attachment
      is a separate, larger scope (file picker + storage design) and
      isn't started
- [x] Search/filter by tag
- [x] Star / archive favorites

## 7. GitHub

- [x] Connect via personal access token (encrypted on-device storage)
- [x] Repo picker
- [x] Recent commit/PR/issue activity feed
- [x] Create a new Issue directly from the app (both platforms)
- [x] Task ↔ Issue sync — see Tasks section above, now two-way
- [x] PR status indicators surfaced on linked projects
- [x] New-activity badge since last visit

## 8. Settings & system-wide

- [x] Theme: light / dark / system + 3 accent themes (amber, violet, teal)
- [x] Data export / import (JSON backup — native save/open dialogs on
      desktop, share sheet + paste-to-import on mobile)
- [ ] Cross-device sync via the private GitHub repo (app data as JSON,
      committed on change, pulled on launch) — no custom backend needed;
      genuinely not started
- [ ] Notification preferences
- [~] Accessibility — desktop respects `prefers-reduced-motion`; dynamic
      text scaling not explicitly tuned on either platform
- [x] About / version screen

---

## Why this shape

- **iOS + Windows from shared logic, not shared UI.** `packages/core`
  holds every domain type, the storage interface, the GitHub client, and
  the Anthropic client. `packages/mobile` (Expo/React Native) and
  `packages/desktop` (Electron) each render their own native-feeling UI
  on top of it — a phone and a desktop window earn different navigation
  and interaction patterns. All 32 of `core`'s behaviors are unit tested;
  both app shells are verified by an actual production build (Electron)
  and an actual Metro bundle export (iOS + Android) every time this repo
  is checked.
- **The verification gap is closed by CI, not glossed over.** This
  sandbox can run TypeScript, ESLint, Jest, an Electron build, and a
  Metro/iOS export for real — so those all gate locally. It cannot run
  Xcode or produce a signed Windows installer. `.github/workflows/ci.yml`
  hands those two steps to GitHub's own macOS and Windows runners, which
  is the actual pass/fail signal for "does the iOS app build" and "does
  the Windows app build" going forward.
- **GitHub, three ways.** Hosts the source itself; surfaces your own
  commit/PR activity as part of "progress"; and lets you pull an open
  Issue in as a Task or push a new Task out as an Issue, so the tracker
  and the repo don't drift into two separate lists.
- **Claude, for real.** "Ask Claude to riff" calls the Anthropic API
  directly with a key you provide — there's no ambient connection to
  Claude available to a plain native app, so this is what makes that
  button actually do something rather than sit there as a mockup.
