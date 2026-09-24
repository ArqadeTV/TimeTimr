import { TimerSettings, TimerState } from "../core/types";
import { formatDuration, getRemainingMs } from "../core/timer";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 140;
/** The dial always represents a fixed 60-minute face, like a physical Time Timer —
 *  a 5-minute duration fills 5/60 of the disk, and only 60+ minutes fills it entirely. */
const DIAL_REFERENCE_MS = 60 * 60 * 1000;

const SVG_NS = "http://www.w3.org/2000/svg";

export interface DiskOptions {
  /** Called with a new duration (ms) while the user drags the dial (idle only). */
  onDragSetDuration?: (ms: number) => void;
  /** Duration represented by one full turn of the drag gesture. */
  dragFullTurnMs?: number;
}

export class TimerDisk {
  readonly el: SVGSVGElement;
  private wedge: SVGPathElement;
  private face: SVGCircleElement;
  private rim: SVGCircleElement;
  private ticksGroup: SVGGElement;
  private digital: SVGTextElement;
  private dragging = false;
  private opts: DiskOptions;
  private lastState: TimerState | null = null;

  constructor(opts: DiskOptions = {}) {
    this.opts = { dragFullTurnMs: DIAL_REFERENCE_MS, ...opts };
    this.el = document.createElementNS(SVG_NS, "svg");
    this.el.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
    this.el.setAttribute("class", "timer-disk");
    this.el.setAttribute("role", "img");
    this.el.setAttribute("aria-label", "Countdown timer dial");

    this.face = document.createElementNS(SVG_NS, "circle");
    this.face.setAttribute("cx", String(CENTER));
    this.face.setAttribute("cy", String(CENTER));
    this.face.setAttribute("r", String(RADIUS));
    this.face.setAttribute("class", "disk-face");

    this.wedge = document.createElementNS(SVG_NS, "path");
    this.wedge.setAttribute("class", "disk-wedge");

    this.rim = document.createElementNS(SVG_NS, "circle");
    this.rim.setAttribute("cx", String(CENTER));
    this.rim.setAttribute("cy", String(CENTER));
    this.rim.setAttribute("r", String(RADIUS));
    this.rim.setAttribute("class", "disk-rim");
    this.rim.setAttribute("fill", "none");

    this.ticksGroup = document.createElementNS(SVG_NS, "g");
    this.ticksGroup.setAttribute("class", "disk-ticks");
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
      const rOuter = RADIUS - 4;
      const rInner = major ? RADIUS - 16 : RADIUS - 10;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(CENTER + rOuter * Math.cos(angle)));
      line.setAttribute("y1", String(CENTER + rOuter * Math.sin(angle)));
      line.setAttribute("x2", String(CENTER + rInner * Math.cos(angle)));
      line.setAttribute("y2", String(CENTER + rInner * Math.sin(angle)));
      line.setAttribute("class", major ? "tick tick-major" : "tick tick-minor");
      this.ticksGroup.appendChild(line);
    }

    this.digital = document.createElementNS(SVG_NS, "text");
    this.digital.setAttribute("x", String(CENTER));
    this.digital.setAttribute("y", String(CENTER + 8));
    this.digital.setAttribute("text-anchor", "middle");
    this.digital.setAttribute("class", "disk-digital");

    this.el.append(this.face, this.wedge, this.ticksGroup, this.rim, this.digital);

    this.el.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
  }

  destroy(): void {
    this.el.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.el.remove();
  }

  update(state: TimerState, now: number = Date.now()): void {
    this.lastState = state;
    const s = state.settings;
    this.applyTheme(s);
    this.ticksGroup.style.display = s.showTickMarks ? "" : "none";
    this.digital.style.display = s.showDigitalReadout ? "" : "none";

    const remaining = getRemainingMs(state, now);
    const fraction = Math.min(1, remaining / DIAL_REFERENCE_MS);
    this.setWedge(fraction);
    this.digital.textContent = formatDuration(remaining);
    this.el.classList.toggle("is-finished", state.status === "finished");
    this.el.classList.toggle("is-running", state.status === "running");
  }

  private applyTheme(s: TimerSettings): void {
    this.el.style.setProperty("--disk-color", s.diskColor);
    this.el.style.setProperty("--disk-bg", s.diskBackground);
    this.el.style.setProperty("--disk-face", s.faceColor);
    this.el.style.setProperty("--disk-text", s.textColor);
  }

  private setWedge(fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    if (clamped <= 0.0005) {
      this.wedge.setAttribute("d", "");
      return;
    }
    if (clamped >= 0.9995) {
      // Full circle: an arc path can't represent 360deg with equal start/end, draw two half-arcs.
      this.wedge.setAttribute(
        "d",
        `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`
      );
      return;
    }
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + clamped * 2 * Math.PI;
    const x1 = CENTER + RADIUS * Math.cos(startAngle);
    const y1 = CENTER + RADIUS * Math.sin(startAngle);
    const x2 = CENTER + RADIUS * Math.cos(endAngle);
    const y2 = CENTER + RADIUS * Math.sin(endAngle);
    const largeArc = clamped > 0.5 ? 1 : 0;
    this.wedge.setAttribute(
      "d",
      `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`
    );
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.lastState || !this.lastState.settings.dragToSet) return;
    if (this.lastState.status === "running") return;
    this.dragging = true;
    this.applyDragFromEvent(e);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.applyDragFromEvent(e);
  };

  private handlePointerUp = () => {
    this.dragging = false;
  };

  private applyDragFromEvent(e: PointerEvent): void {
    if (!this.opts.onDragSetDuration) return;
    const rect = this.el.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const x = (e.clientX - rect.left) * scale - CENTER;
    const y = (e.clientY - rect.top) * scale - CENTER;
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const fraction = angle / (2 * Math.PI);
    const fullTurn = this.opts.dragFullTurnMs ?? 60 * 60 * 1000;
    const ms = Math.round((fraction * fullTurn) / 1000) * 1000;
    this.opts.onDragSetDuration(Math.max(1000, ms));
  }
}
