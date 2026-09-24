# TimeTimr

A customizable, [Time Timer](https://www.timetimer.com/)-inspired visual countdown timer — a shrinking colored disk that shows how much time is left at a glance. Set it in hours, minutes, and seconds (or drag the dial), optionally show a clock alongside it, and pop either widget out into its own window.

Runs two ways from the same codebase:

- **As a website** — a single-page app you can open in any browser.
- **As a desktop app** — an Electron build for Windows, macOS, and Linux.

Pop-outs work in both: on the web they're real `window.open()` browser windows; on desktop they're native OS windows. You never have to pop anything out, either — the app is fully usable as a single window/page on its own.

## Features

- Time Timer-style depletion disk (SVG), full circle = whatever duration you set
- Set duration by hour / minute / second, quick presets, or drag the dial
- Optional clock (analog, digital, or both) shown beside, above, or below the timer
- Fully customizable colors (disk, track, face, text), tick marks, digital readout
- Optional chime on finish and per-second tick sound, with a volume control
- Pop out the timer and/or the clock into independent windows that stay live-synced
- Settings persist locally (`localStorage`)
- "Always on top" option for pop-out windows on desktop

## Project layout

```
TimeTimr/
├─ web/          # The actual app: Vite + TypeScript, no framework.
│                 # Builds to a static site (index.html + popout.html).
├─ electron/     # Thin Electron shell that loads web/'s build output
│                 # and manages native pop-out windows.
└─ .github/workflows/
   ├─ build.yml        # CI: builds the web app + Win/Mac/Linux desktop installers
   └─ deploy-web.yml    # Deploys web/ to GitHub Pages on push to main
```

The web app and the desktop app share 100% of the UI and timer logic. Electron only adds native window management (see `web/src/core/bridge-electron.ts` vs `bridge-web.ts`) — the app auto-detects which environment it's in at startup.

## Getting started

Requires Node.js 18+.

```bash
npm install
```

### Run as a website (dev server)

```bash
npm run dev:web
```

Opens at http://localhost:5173. This alone is the full "website version" — no Electron involved.

### Run as a desktop app (dev mode)

```bash
npm run dev
```

Starts the Vite dev server and launches the Electron shell pointed at it.

### Build the website for deployment

```bash
npm run build:web
```

Static output lands in `web/dist/` — deploy it anywhere that serves static files (GitHub Pages, Netlify, S3, etc). A GitHub Actions workflow (`.github/workflows/deploy-web.yml`) already deploys it to GitHub Pages on every push to `main` (enable Pages → "GitHub Actions" as the source in repo settings).

### Build the desktop app

```bash
npm run dist:win     # Windows installer (.exe via NSIS)
npm run dist:mac      # macOS (.dmg / .zip) — must be run on macOS, or via the CI workflow
npm run dist:linux    # Linux (.AppImage / .deb)
npm run dist:all       # all three (needs the right OS/toolchain per target)
```

electron-builder can only produce a macOS build on macOS. `.github/workflows/build.yml` builds installers for all three platforms on every push using a Windows/macOS/Linux CI matrix, and uploads them as workflow artifacts — that's the easiest way to get all three without owning all three machines.

## How pop-outs & sync work

The timer's state (running/paused, remaining time, settings) lives in the main window and is broadcast to every other open window through a small `Bridge` abstraction:

- **Web**: `BroadcastChannel`, since pop-outs are same-origin `window.open()` windows.
- **Electron**: a preload-exposed API that relays messages through the main process to every `BrowserWindow`.

Countdown time itself is never "ticked" over the wire — each window derives the remaining time from a shared end-timestamp, so there's no drift and no single window has to stay open for the countdown to stay accurate.

## License

CC0 1.0 — public domain dedication, see [LICENSE](LICENSE).
