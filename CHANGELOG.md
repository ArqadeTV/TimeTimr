# Changelog

## v0.1.4 - 2026-09-30

### Added
- A real "Always on top" option for the browser version. When on (and your browser supports it — Chrome/Edge via the Document Picture-in-Picture API), pop-outs open as a genuinely chrome-less floating window with no address bar, tab strip, or extensions icon — the same mechanism behind things like Google Meet's floating call window — instead of a regular pop-up window. Falls back to a normal pop-out automatically where it isn't supported. Note: browsers currently allow only one such window at a time, so opening a second replaces the first; it also doesn't participate in the drag-to-dock/return-to-main gestures.

### Changed
- Visual refresh: a wordmark, a serif accent for headings and section titles, and a settings panel that reads as one connected panel with dividers instead of a stack of separate boxed cards.

## v0.1.3 - 2026-09-30

### Added
- Drag a pop-out window onto the main window and it pops back in, restoring that widget there — the reverse of dragging pop-outs together. Works the same way as the existing dock-together gesture (native window tracking on desktop, position polling on the web).
- The main window's widgets panel now becomes a proper square (with a hint on how to bring a widget back) when both the timer and clock are popped out, instead of collapsing into a thin strip shaped only by its padding.

### Changed
- The main window can no longer be closed while any pop-out is still open — closing it first would leave the pop-out(s) running with nothing driving the shared timer state. On desktop this is enforced outright with an explanation; browsers only allow a generic "are you sure" prompt on tab close, which is the closest the web version can get.

### Fixed
- Changing an unrelated setting (color, sound, etc.) while the clock was popped out could make it reappear in the main window even though it was still open elsewhere.

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
