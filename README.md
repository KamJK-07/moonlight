# Moonlight

Kameron's personal creative hub — calendar, tasks, projects, a daily
progress log, and an idea board wired to Claude and GitHub. Native on iOS
and Windows, built from one shared TypeScript core.

See [ROADMAP.md](./ROADMAP.md) for the full feature checklist this build
is measured against — what's shipped, what's backlog.

## How this repo is put together

```
moonlight/
├── packages/
│   ├── core/       Shared TypeScript: types, storage interfaces, business
│   │                logic, the GitHub client, the Anthropic client. No
│   │                React, no platform APIs — pure logic, fully unit tested.
│   ├── mobile/      Expo / React Native app (iOS + Android). Persists via
│   │                AsyncStorage, secrets via expo-secure-store (Keychain).
│   └── desktop/     Electron app (Windows, + incidentally Linux/macOS).
│                    Persists to a JSON file under the OS's per-user app
│                    data folder; secrets via Electron's safeStorage
│                    (Windows Credential Manager / DPAPI).
└── .github/workflows/ci.yml
```

Mobile and desktop each render their own native-feeling UI — a phone and
a desktop window earn different interaction patterns — but share every
line of domain logic through `@moonlight/core`.

## Running it

You'll need Node 18+ and npm.

```bash
npm install                          # installs all three workspaces
npm run build --workspace packages/core   # builds core's dist/ (needed for typecheck)
npm run verify                       # lint + typecheck + unit tests
```

**Desktop (Windows or your current OS):**

```bash
cd packages/desktop
npm run dev        # launch in dev mode
npm run build:win  # produce a Windows .exe (nsis installer + portable)
```

**Mobile (iOS):**

```bash
cd packages/mobile
npx expo start      # scan the QR code with Expo Go, or press i for a simulator (needs a Mac + Xcode)
```

A real installable iOS build needs either a Mac with Xcode
(`npx expo run:ios`) or [EAS Build](https://docs.expo.dev/build/introduction/)
(`eas build --platform ios`), which can produce one without you owning a
Mac at all.

## Connecting GitHub and Claude

Both are opt-in, from inside the app:

- **GitHub** (Settings/GitHub tab): paste a personal access token — a
  fine-grained token scoped to the repos you want, with Contents + Issues
  read/write, or a classic token with the `repo` scope. It's encrypted
  on-device and used to talk to `api.github.com` directly; nothing is
  sent anywhere else.
- **Claude** (Settings): paste an API key from
  [console.anthropic.com](https://console.anthropic.com). This is what
  actually powers "Ask Claude to riff" in the Creative Hub — there's no
  ambient connection to Claude from inside a plain native app, so this
  key is what makes that real rather than a stub.

Neither key is ever written into the app's own data (so a JSON backup or
a future GitHub-repo sync of your tasks/projects never leaks it).

## CI

`.github/workflows/ci.yml` runs three jobs on every push:

- **verify** (ubuntu-latest, fast): lint, typecheck, unit tests, an
  Electron production build, and a Metro bundle export for both iOS and
  Android. Everything here was hand-verified while this repo was built.
- **ios-build** (macos-14): a real `expo prebuild` + CocoaPods +
  `xcodebuild` build against the iOS Simulator SDK — this is the actual
  pass/fail signal for "does the iOS app build," since a Linux sandbox
  can't run Xcode.
- **windows-build** (windows-latest): a real `electron-builder --win`
  build, uploaded as a workflow artifact.

## Design notes

- **Why two UI layers instead of one shared one.** A phone and a desktop
  window want different navigation (bottom tabs + a "More" stack vs. a
  persistent sidebar) and different input patterns. Sharing `core` and
  duplicating the view layer keeps each platform feeling native instead
  of feeling like a web page wrapped twice.
- **Why the GitHub token and the Anthropic key are handled differently
  on desktop.** Electron's renderer is Chromium — real web content,
  worth treating like an untrusted browser page. The GitHub token is
  handed to the renderer (it needs to call `api.github.com` itself); the
  Anthropic key never leaves the main process — the renderer sends idea
  text over IPC and gets a riff back, nothing more. Mobile has no such
  boundary (there's no web page in between), so both secrets live
  directly behind `expo-secure-store` there.
