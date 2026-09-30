# Changelog

## v0.1.2 - 2026-09-30

### Added
- Drag one pop-out window onto another (the standalone timer and clock windows) and they now auto-dock into a single combined window, right where you dropped them. On desktop this is a real native window-drag; on the web, where browsers don't expose one window's position to another, pop-outs periodically report their own position so the main window can detect the same thing. The "Join into one window" button still works too — this is purely additive.
- The standalone timer pop-out (and the combined pop-out) now has the same hour/min/sec duration inputs as the main window — previously they only had Start/Pause/Reset, with no way to set an exact custom duration.

### Fixed
- Manual duration editing from a pop-out window didn't actually apply (reported as "can't change the time in the popped-out clock" / "manual time-editing doesn't work") — the inputs simply didn't exist yet; see Added above.

## v0.1.1 - 2026-09-24

### Changed
- The clock now matches the timer disk's size everywhere it's shown (main window, standalone pop-out, and combined pop-out).
- The clock face now shows hour numerals (1-12).
- Added a subtle "chapter ring" between the numerals and the hour ticks on the clock only — a quiet, color-independent way to tell the clock apart from the timer disk at a glance, without having to read the hands or count tick marks.

## v0.1.0 - 2026-09-24

First release.

### Added
- Time Timer-style depletion disk: a full circle always represents a fixed 60-minute face, so a 5-minute timer fills 5/60 of the dial — just like the physical device.
- Set the duration by hour/minute/second inputs, quick presets (1m-60m), or by dragging the dial directly.
- Optional analog/digital/both clock, positionable beside, above, or below the timer.
- Full appearance customization: disk color, track color, face color, text color, tick marks, digital readout toggle.
- Optional chime on finish and per-second tick sound, with a volume control.
- Pop the timer and/or clock out into independent windows that stay live-synced with the main window (real browser windows on the web, native windows on desktop).
- Pop out the timer and clock together into one combined window, or join two already-separate pop-outs into one via "Join into one window."
- Pop-out windows open with minimal browser chrome on the web (no toolbar/address bar/extensions row) and no menu bar on desktop.
- Settings and duration persist locally between sessions.
- Runs as a static website (deployed to GitHub Pages) and as a desktop app for Windows, macOS, and Linux (Electron), from the same codebase.
- "Always on top" option for desktop pop-out windows.

### Known limitations
- Desktop installers are unsigned — Windows SmartScreen and macOS Gatekeeper will warn on first launch.
- The dial's minute tick marks are decorative for durations over 60 minutes (the disk still depletes correctly; only the tick spacing is nominal).
