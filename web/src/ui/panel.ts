import { ClockPosition, ClockStyle, PopoutStatus, TimerSettings, WidgetKind } from "../core/types";
import { msToParts } from "../core/timer";

export interface PanelCallbacks {
  onSetDuration(h: number, m: number, s: number): void;
  onPreset(minutes: number): void;
  onStartPause(): void;
  onReset(): void;
  onSettingsChange(partial: Partial<TimerSettings>): void;
  onPopout(kind: WidgetKind): void;
  onJoinPopouts(): void;
  onResetSettings(): void;
}

const PRESETS_MIN = [1, 5, 10, 15, 20, 25, 30, 45, 60];

export class ControlPanel {
  readonly el: HTMLDivElement;
  private cb: PanelCallbacks;
  private hInput!: HTMLInputElement;
  private mInput!: HTMLInputElement;
  private sInput!: HTMLInputElement;
  private startPauseBtn!: HTMLButtonElement;
  private poppedOut: PopoutStatus = { timer: false, clock: false, combined: false };
  private popTimerBtn!: HTMLButtonElement;
  private popClockBtn!: HTMLButtonElement;
  private popCombinedBtn!: HTMLButtonElement;
  private joinBtn!: HTMLButtonElement;

  constructor(cb: PanelCallbacks) {
    this.cb = cb;
    this.el = document.createElement("div");
    this.el.className = "panel";
    this.el.innerHTML = this.template();
    this.bind();
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
  }

  setPoppedOut(status: PopoutStatus): void {
    this.poppedOut = status;
    const anyPopped = status.timer || status.clock || status.combined;

    this.popTimerBtn.textContent = status.timer && !status.combined ? "Timer popped out" : "Pop out timer";
    this.popTimerBtn.disabled = status.timer || status.combined;
    this.popClockBtn.textContent = status.clock && !status.combined ? "Clock popped out" : "Pop out clock";
    this.popClockBtn.disabled = status.clock || status.combined;
    this.popCombinedBtn.textContent = status.combined ? "Both popped out together" : "Pop out both together";
    this.popCombinedBtn.disabled = anyPopped;

    // Offer to join only once timer and clock are each out in their own separate window.
    const canJoin = status.timer && status.clock && !status.combined;
    this.joinBtn.hidden = !canJoin;
  }

  syncDurationInputs(ms: number): void {
    if (document.activeElement === this.hInput || document.activeElement === this.mInput || document.activeElement === this.sInput) {
      return; // don't fight the user while they're typing
    }
    const { h, m, s } = msToParts(ms);
    this.hInput.value = String(h);
    this.mInput.value = String(m);
    this.sInput.value = String(s);
  }

  setRunning(running: boolean): void {
    this.startPauseBtn.textContent = running ? "Pause" : "Start";
    this.startPauseBtn.classList.toggle("is-running", running);
    this.hInput.disabled = running;
    this.mInput.disabled = running;
    this.sInput.disabled = running;
  }

  applySettingsToForm(s: TimerSettings): void {
    this.q<HTMLInputElement>("[data-f=diskColor]").value = s.diskColor;
    this.q<HTMLInputElement>("[data-f=diskBackground]").value = s.diskBackground;
    this.q<HTMLInputElement>("[data-f=faceColor]").value = s.faceColor;
    this.q<HTMLInputElement>("[data-f=textColor]").value = s.textColor;
    this.q<HTMLInputElement>("[data-f=showDigitalReadout]").checked = s.showDigitalReadout;
    this.q<HTMLInputElement>("[data-f=showTickMarks]").checked = s.showTickMarks;
    this.q<HTMLInputElement>("[data-f=dragToSet]").checked = s.dragToSet;
    this.q<HTMLInputElement>("[data-f=showClock]").checked = s.showClock;
    this.q<HTMLSelectElement>("[data-f=clockStyle]").value = s.clockStyle;
    this.q<HTMLSelectElement>("[data-f=clockPosition]").value = s.clockPosition;
    this.q<HTMLInputElement>("[data-f=use24Hour]").checked = s.use24Hour;
    this.q<HTMLInputElement>("[data-f=playSoundAtEnd]").checked = s.playSoundAtEnd;
    this.q<HTMLInputElement>("[data-f=tickSound]").checked = s.tickSound;
    this.q<HTMLInputElement>("[data-f=volume]").value = String(s.volume);
    const aot = this.el.querySelector<HTMLInputElement>("[data-f=alwaysOnTopPopouts]");
    if (aot) aot.checked = s.alwaysOnTopPopouts;
  }

  private q<T extends Element>(sel: string): T {
    const found = this.el.querySelector<T>(sel);
    if (!found) throw new Error(`panel: missing element ${sel}`);
    return found;
  }

  private template(): string {
    return `
      <section class="panel-section">
        <h2>Set duration</h2>
        <div class="duration-row">
          <label>Hr <input data-f="h" type="number" min="0" max="23" value="0" inputmode="numeric" /></label>
          <label>Min <input data-f="m" type="number" min="0" max="59" value="5" inputmode="numeric" /></label>
          <label>Sec <input data-f="s" type="number" min="0" max="59" value="0" inputmode="numeric" /></label>
          <button data-a="apply-duration" type="button">Set</button>
        </div>
        <div class="preset-row">
          ${PRESETS_MIN.map((m) => `<button type="button" class="preset" data-preset="${m}">${m}m</button>`).join("")}
        </div>
        <div class="transport-row">
          <button data-a="start-pause" type="button" class="btn-primary">Start</button>
          <button data-a="reset" type="button">Reset</button>
        </div>
      </section>

      <section class="panel-section">
        <h2>Pop-out windows</h2>
        <div class="transport-row">
          <button data-a="popout-timer" type="button">Pop out timer</button>
          <button data-a="popout-clock" type="button">Pop out clock</button>
        </div>
        <div class="transport-row">
          <button data-a="popout-combined" type="button">Pop out both together</button>
          <button data-a="join-popouts" type="button" class="btn-subtle" hidden>Join into one window</button>
        </div>
        <p class="hint">Pops the widget into its own window you can drag to another screen. The main window keeps working as a single page either way. Already popped both out separately? Join them into a single window instead.</p>
      </section>

      <section class="panel-section">
        <h2>Appearance</h2>
        <div class="field-grid">
          <label>Disk color <input data-f="diskColor" type="color" /></label>
          <label>Disk track <input data-f="diskBackground" type="color" /></label>
          <label>Face color <input data-f="faceColor" type="color" /></label>
          <label>Text color <input data-f="textColor" type="color" /></label>
        </div>
        <label class="checkbox"><input data-f="showDigitalReadout" type="checkbox" /> Show digital readout on dial</label>
        <label class="checkbox"><input data-f="showTickMarks" type="checkbox" /> Show minute tick marks</label>
        <label class="checkbox"><input data-f="dragToSet" type="checkbox" /> Drag dial to set time</label>
      </section>

      <section class="panel-section">
        <h2>Clock</h2>
        <label class="checkbox"><input data-f="showClock" type="checkbox" /> Show clock next to timer</label>
        <div class="field-grid">
          <label>Style
            <select data-f="clockStyle">
              <option value="analog">Analog</option>
              <option value="digital">Digital</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label>Position
            <select data-f="clockPosition">
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </label>
        </div>
        <label class="checkbox"><input data-f="use24Hour" type="checkbox" /> Use 24-hour time</label>
      </section>

      <section class="panel-section">
        <h2>Sound</h2>
        <label class="checkbox"><input data-f="playSoundAtEnd" type="checkbox" /> Play chime when finished</label>
        <label class="checkbox"><input data-f="tickSound" type="checkbox" /> Tick each second while running</label>
        <label>Volume <input data-f="volume" type="range" min="0" max="1" step="0.05" /></label>
      </section>

      <section class="panel-section electron-only" data-electron-only>
        <h2>Desktop</h2>
        <label class="checkbox"><input data-f="alwaysOnTopPopouts" type="checkbox" /> Pop-outs stay always on top</label>
      </section>

      <section class="panel-section">
        <button data-a="reset-settings" type="button" class="btn-subtle">Reset appearance to defaults</button>
      </section>
    `;
  }

  private bind(): void {
    this.hInput = this.q("[data-f=h]");
    this.mInput = this.q("[data-f=m]");
    this.sInput = this.q("[data-f=s]");
    this.startPauseBtn = this.q("[data-a=start-pause]");
    this.popTimerBtn = this.q("[data-a=popout-timer]");
    this.popClockBtn = this.q("[data-a=popout-clock]");
    this.popCombinedBtn = this.q("[data-a=popout-combined]");
    this.joinBtn = this.q("[data-a=join-popouts]");

    this.q<HTMLButtonElement>("[data-a=apply-duration]").addEventListener("click", () => {
      this.cb.onSetDuration(this.numOf(this.hInput), this.numOf(this.mInput), this.numOf(this.sInput));
    });

    this.el.querySelectorAll<HTMLButtonElement>(".preset").forEach((btn) => {
      btn.addEventListener("click", () => this.cb.onPreset(Number(btn.dataset.preset)));
    });

    this.startPauseBtn.addEventListener("click", () => this.cb.onStartPause());
    this.q<HTMLButtonElement>("[data-a=reset]").addEventListener("click", () => this.cb.onReset());
    this.popTimerBtn.addEventListener("click", () => this.cb.onPopout("timer"));
    this.popClockBtn.addEventListener("click", () => this.cb.onPopout("clock"));
    this.popCombinedBtn.addEventListener("click", () => this.cb.onPopout("combined"));
    this.joinBtn.addEventListener("click", () => this.cb.onJoinPopouts());
    this.q<HTMLButtonElement>("[data-a=reset-settings]").addEventListener("click", () => this.cb.onResetSettings());

    const bindField = <K extends keyof TimerSettings>(name: K, transform: (v: string) => TimerSettings[K]) => {
      const input = this.el.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-f=${name}]`);
      if (!input) return;
      const evt = input.tagName === "SELECT" || input.getAttribute("type") === "color" ? "change" : "input";
      input.addEventListener(evt, () => {
        const value = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value;
        this.cb.onSettingsChange({ [name]: transform(value as string) } as Partial<TimerSettings>);
      });
    };

    bindField("diskColor", (v) => v);
    bindField("diskBackground", (v) => v);
    bindField("faceColor", (v) => v);
    bindField("textColor", (v) => v);
    bindField("clockStyle", (v) => v as ClockStyle);
    bindField("clockPosition", (v) => v as ClockPosition);
    bindField("volume", (v) => Number(v));

    (["showDigitalReadout", "showTickMarks", "dragToSet", "showClock", "use24Hour", "playSoundAtEnd", "tickSound", "alwaysOnTopPopouts"] as const).forEach(
      (name) => {
        const input = this.el.querySelector<HTMLInputElement>(`[data-f=${name}]`);
        if (!input) return;
        input.addEventListener("change", () => {
          this.cb.onSettingsChange({ [name]: input.checked } as Partial<TimerSettings>);
        });
      }
    );
  }

  private numOf(input: HTMLInputElement): number {
    const n = Number(input.value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
}
