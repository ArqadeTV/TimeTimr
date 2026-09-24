import { Bridge } from "../core/bridge";
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
import { DEFAULT_SETTINGS, PopoutStatus, TimerState, WidgetKind } from "../core/types";
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
  private poppedOut: PopoutStatus = { timer: false, clock: false };
  private lastAlarmSeqHandled = 0;
  private lastTickSecond = -1;
  private rafId = 0;

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
        </div>
        <div class="panel-slot" data-panel-slot></div>
      </div>
    `;

    this.diskSlot = root.querySelector("[data-disk-slot]")!;
    this.clockSlot = root.querySelector("[data-clock-slot]")!;
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
        this.render();
      }
    });

    this.applySettingsUI();
    this.render();
    this.loop();
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
    this.render();
  }

  private applySettingsUI(): void {
    this.panel.applySettingsToForm(this.state.settings);
    this.panel.setRunning(this.state.status === "running");
    this.clockSlot.style.display = this.state.settings.showClock ? "" : "none";
    this.clockSlot.parentElement?.setAttribute("data-clock-position", this.state.settings.clockPosition);
    this.clock.applySettings(this.state.settings);
    if (this.state.settings.showClock && !this.clock.el.parentElement) {
      this.clock.mount(this.clockSlot);
    }
  }

  private applyPoppedOutVisibility(): void {
    this.diskSlot.style.display = this.poppedOut.timer ? "none" : "";
    if (!this.poppedOut.clock) {
      this.clockSlot.style.display = this.state.settings.showClock ? "" : "none";
    } else {
      this.clockSlot.style.display = "none";
    }
    this.panel.setPoppedOut(this.poppedOut);
  }

  private openPopout(kind: WidgetKind): void {
    this.poppedOut = { ...this.poppedOut, [kind]: true };
    this.applyPoppedOutVisibility();
    this.bridge.openPopout(kind);
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
