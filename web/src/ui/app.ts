import { Bridge, PopoutPosition } from "../core/bridge";
import { boundsAreDockable } from "../core/dock";
import { loadPersisted, savePersisted } from "../core/storage";
import { playChime, playTick } from "../core/sound";
import {
  createInitialState,
  getRemainingMs,
  reset as resetTimer,
  setDurationParts,
  tick,
  toggleStartPause,
  updateSettings,
} from "../core/timer";
import { DEFAULT_SETTINGS, PopoutStatus, TimerState, WidgetBounds, WidgetKind } from "../core/types";
import { TimerClock } from "./clock";
import { TimerDisk } from "./disk";
import { ControlPanel } from "./panel";

export class App {
  private bridge: Bridge;
  private state: TimerState;
  private disk: TimerDisk;
  private clock: TimerClock;
  private panel: ControlPanel;
  private clockSlot: HTMLDivElement;
  private diskSlot: HTMLDivElement;
  private widgets: HTMLDivElement;
  private poppedOut: PopoutStatus = { timer: false, clock: false, combined: false };
  private lastAlarmSeqHandled = 0;
  private lastTickSecond = -1;
  private rafId = 0;
  /** Web only: latest reported screen position of each standalone pop-out, used to
   *  detect when the user drags the timer and clock pop-outs next to each other. */
  private lastPopoutBounds: Partial<Record<"timer" | "clock", WidgetBounds>> = {};

  constructor(root: HTMLElement, bridge: Bridge) {
    this.bridge = bridge;
    const persisted = loadPersisted();
    this.state = createInitialState(persisted.settings, persisted.durationMs);
    this.lastAlarmSeqHandled = this.state.alarmSeq;

    root.innerHTML = `
      <div class="layout" data-layout>
        <div class="widgets" data-widgets>
          <div class="disk-slot" data-disk-slot></div>
          <div class="clock-slot" data-clock-slot></div>
          <p class="empty-hint" data-empty-hint>Drag a pop-out window here to bring it back, or use the panel.</p>
        </div>
        <div class="panel-slot" data-panel-slot></div>
      </div>
    `;

    this.diskSlot = root.querySelector("[data-disk-slot]")!;
    this.clockSlot = root.querySelector("[data-clock-slot]")!;
    this.widgets = root.querySelector("[data-widgets]")!;
    const panelSlot = root.querySelector<HTMLDivElement>("[data-panel-slot]")!;
    const layout = root.querySelector<HTMLDivElement>("[data-layout]")!;
    if (bridge.environment === "electron") {
      layout.classList.add("is-electron");
    }

    this.disk = new TimerDisk({ onDragSetDuration: (ms) => this.setDurationMs(ms) });
    this.disk.mount(this.diskSlot);

    this.clock = new TimerClock();

    this.panel = new ControlPanel({
      onSetDuration: (h, m, s) => this.setState(setDurationParts(this.state, h, m, s)),
      onPreset: (minutes) => this.setState(setDurationParts(this.state, 0, minutes, 0)),
      onStartPause: () => this.setState(toggleStartPause(this.state)),
      onReset: () => this.setState(resetTimer(this.state)),
      onSettingsChange: (partial) => this.setState(updateSettings(this.state, partial)),
      onPopout: (kind) => this.openPopout(kind),
      onJoinPopouts: () => this.joinPopouts(),
      onResetSettings: () => this.setState(updateSettings(this.state, DEFAULT_SETTINGS)),
    });
    this.panel.mount(panelSlot);

    this.bridge.onMessage((msg) => {
      if (msg.type === "request-state") {
        this.bridge.send({ type: "state", state: this.state });
      } else if (msg.type === "popout-status") {
        // A popout window closed itself; merge that info in (only clears flags — this
        // window is the source of truth for opening them).
        this.poppedOut = { ...this.poppedOut, ...msg.status };
        this.applyPoppedOutVisibility();
      } else if (msg.type === "state") {
        // A pop-out's own controls (start/pause/reset) changed the shared state —
        // adopt it here too, without re-broadcasting (avoids an echo loop).
        this.state = msg.state;
        savePersisted(this.state.settings, this.state.durationMs);
        this.applySettingsUI();
        this.applyPoppedOutVisibility();
        this.render();
      } else if (msg.type === "popout-bounds") {
        this.handlePopoutBounds(msg.kind, msg.bounds);
      }
    });

    // Closing the main window while pop-outs are open orphans them. Electron blocks the
    // close outright (see electron/main.cjs); browsers only allow a generic confirmation
    // prompt on tab/window close, which is the most this can do on the web.
    window.addEventListener("beforeunload", (event) => {
      if (!this.anyPopoutOpen()) return;
      event.preventDefault();
      event.returnValue = "";
    });

    this.applySettingsUI();
    this.applyPoppedOutVisibility();
    this.render();
    this.loop();
  }

  private anyPopoutOpen(): boolean {
    return this.poppedOut.timer || this.poppedOut.clock || this.poppedOut.combined;
  }

  private setDurationMs(ms: number): void {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    this.setState(setDurationParts(this.state, h, m, s));
  }

  private setState(next: TimerState): void {
    const aotChanged = next.settings.alwaysOnTopPopouts !== this.state.settings.alwaysOnTopPopouts;
    this.state = next;
    savePersisted(this.state.settings, this.state.durationMs);
    this.bridge.send({ type: "state", state: this.state });
    if (aotChanged) this.bridge.setAlwaysOnTop?.(next.settings.alwaysOnTopPopouts);
    this.applySettingsUI();
    this.applyPoppedOutVisibility();
    this.render();
  }

  private applySettingsUI(): void {
    this.panel.applySettingsToForm(this.state.settings);
    this.panel.setRunning(this.state.status === "running");
    this.clockSlot.parentElement?.setAttribute("data-clock-position", this.state.settings.clockPosition);
    this.clock.applySettings(this.state.settings);
    if (this.state.settings.showClock && !this.clock.el.parentElement) {
      this.clock.mount(this.clockSlot);
    }
  }

  private applyPoppedOutVisibility(): void {
    const timerHidden = this.poppedOut.timer || this.poppedOut.combined;
    const clockHidden = this.poppedOut.clock || this.poppedOut.combined;
    const clockShowable = this.state.settings.showClock && !clockHidden;
    this.diskSlot.style.display = timerHidden ? "none" : "";
    this.clockSlot.style.display = clockShowable ? "" : "none";
    this.panel.setPoppedOut(this.poppedOut);

    // Nothing left to show in the widgets panel — give the empty space a square shape
    // (instead of the sliver that padding alone produces) with a hint on how to get a
    // widget back, rather than leaving an oddly-thin empty box.
    this.widgets.classList.toggle("is-empty", timerHidden && !clockShowable);
  }

  private openPopout(kind: WidgetKind): void {
    if (kind === "combined") {
      this.poppedOut = { timer: true, clock: true, combined: true };
    } else {
      this.poppedOut = { ...this.poppedOut, [kind]: true };
    }
    this.applyPoppedOutVisibility();
    this.bridge.openPopout(kind);
  }

  /** Closes the separate timer + clock pop-outs and reopens them together in one window. */
  private joinPopouts(atPosition?: PopoutPosition): void {
    this.bridge.send({ type: "close-popout", kind: "timer" });
    this.bridge.send({ type: "close-popout", kind: "clock" });
    this.poppedOut = { timer: true, clock: true, combined: true };
    this.lastPopoutBounds = {};
    this.applyPoppedOutVisibility();
    this.bridge.openPopout("combined", atPosition);
  }

  /** Web only (Electron tracks both of these natively in main.cjs). Any pop-out dragged
   *  onto the main window pops back in; otherwise, the timer and clock pop-outs dragged
   *  next to each other auto-join into one combined window. */
  private handlePopoutBounds(kind: WidgetKind, bounds: WidgetBounds): void {
    const mainBounds = this.ownWindowBounds();
    if (mainBounds && boundsAreDockable(mainBounds, bounds)) {
      this.bridge.send({ type: "close-popout", kind });
      if (kind === "timer" || kind === "clock") delete this.lastPopoutBounds[kind];
      return;
    }

    if (kind !== "timer" && kind !== "clock") return;
    this.lastPopoutBounds[kind] = bounds;
    if (this.poppedOut.combined || !this.poppedOut.timer || !this.poppedOut.clock) return;

    const timerBounds = this.lastPopoutBounds.timer;
    const clockBounds = this.lastPopoutBounds.clock;
    if (!timerBounds || !clockBounds) return;
    if (!boundsAreDockable(timerBounds, clockBounds)) return;

    this.joinPopouts({ x: Math.min(timerBounds.x, clockBounds.x), y: Math.min(timerBounds.y, clockBounds.y) });
  }

  private ownWindowBounds(): WidgetBounds | null {
    if (typeof window === "undefined") return null;
    return { x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight };
  }

  private render(now: number = Date.now()): void {
    this.disk.update(this.state, now);
    this.panel.syncDurationInputs(getRemainingMs(this.state, now));
  }

  private loop = (): void => {
    const now = Date.now();
    const next = tick(this.state, now);
    if (next !== this.state) {
      this.state = next;
      savePersisted(this.state.settings, this.state.durationMs);
      this.bridge.send({ type: "state", state: this.state });
      this.panel.setRunning(false);
    }

    if (this.state.alarmSeq !== this.lastAlarmSeqHandled) {
      this.lastAlarmSeqHandled = this.state.alarmSeq;
      if (this.state.settings.playSoundAtEnd) playChime(this.state.settings.volume);
    }

    if (this.state.status === "running" && this.state.settings.tickSound) {
      const second = Math.floor(now / 1000);
      if (second !== this.lastTickSecond) {
        this.lastTickSecond = second;
        playTick(this.state.settings.volume);
      }
    }

    this.clock.update(new Date(now));
    this.render(now);
    this.rafId = requestAnimationFrame(this.loop);
  };

  destroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
