import { TimerSettings } from "../core/types";

// Same footprint as the timer disk (SIZE/CENTER/RADIUS in disk.ts) so the two
// widgets render at identical sizes wherever they're shown side by side.
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 140;
const SVG_NS = "http://www.w3.org/2000/svg";

export class TimerClock {
  readonly el: HTMLDivElement;
  private svg: SVGSVGElement;
  private hourHand: SVGLineElement;
  private minuteHand: SVGLineElement;
  private secondHand: SVGLineElement;
  private digital: HTMLDivElement;
  private settings: TimerSettings | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "timer-clock";

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
    this.svg.setAttribute("class", "clock-face");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Current time");

    const face = document.createElementNS(SVG_NS, "circle");
    face.setAttribute("cx", String(CENTER));
    face.setAttribute("cy", String(CENTER));
    face.setAttribute("r", String(RADIUS));
    face.setAttribute("class", "clock-circle");
    this.svg.appendChild(face);

    // A thin "chapter ring" between the numerals and the hour ticks — a subtle,
    // structural touch the timer disk doesn't have, so the two are easy to tell
    // apart at a glance without reading hands or counting tick marks.
    const chapterRing = document.createElementNS(SVG_NS, "circle");
    chapterRing.setAttribute("cx", String(CENTER));
    chapterRing.setAttribute("cy", String(CENTER));
    chapterRing.setAttribute("r", String(RADIUS - 24));
    chapterRing.setAttribute("class", "clock-chapter-ring");
    chapterRing.setAttribute("fill", "none");
    this.svg.appendChild(chapterRing);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const rOuter = RADIUS - 6;
      const rInner = RADIUS - 18;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(CENTER + rOuter * Math.cos(angle)));
      line.setAttribute("y1", String(CENTER + rOuter * Math.sin(angle)));
      line.setAttribute("x2", String(CENTER + rInner * Math.cos(angle)));
      line.setAttribute("y2", String(CENTER + rInner * Math.sin(angle)));
      line.setAttribute("class", "clock-tick");
      this.svg.appendChild(line);
    }

    const numberRadius = RADIUS - 42;
    for (let hour = 1; hour <= 12; hour++) {
      const angle = (hour / 12) * 2 * Math.PI - Math.PI / 2;
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(CENTER + numberRadius * Math.cos(angle)));
      text.setAttribute("y", String(CENTER + numberRadius * Math.sin(angle)));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("class", "clock-number");
      text.textContent = String(hour);
      this.svg.appendChild(text);
    }

    this.hourHand = this.makeHand("clock-hand-hour");
    this.minuteHand = this.makeHand("clock-hand-minute");
    this.secondHand = this.makeHand("clock-hand-second");
    this.svg.append(this.hourHand, this.minuteHand, this.secondHand);

    const hub = document.createElementNS(SVG_NS, "circle");
    hub.setAttribute("cx", String(CENTER));
    hub.setAttribute("cy", String(CENTER));
    hub.setAttribute("r", "6");
    hub.setAttribute("class", "clock-hub");
    this.svg.appendChild(hub);

    this.digital = document.createElement("div");
    this.digital.className = "clock-digital";

    this.el.append(this.svg, this.digital);
  }

  private makeHand(className: string): SVGLineElement {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(CENTER));
    line.setAttribute("y1", String(CENTER));
    line.setAttribute("class", className);
    return line;
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
  }

  destroy(): void {
    this.el.remove();
  }

  applySettings(settings: TimerSettings): void {
    this.settings = settings;
    this.svg.style.setProperty("--disk-color", settings.diskColor);
    this.svg.style.setProperty("--disk-face", settings.faceColor);
    this.svg.style.setProperty("--disk-text", settings.textColor);
    this.svg.style.display = settings.clockStyle === "digital" ? "none" : "";
    this.digital.style.display = settings.clockStyle === "analog" ? "none" : "";
  }

  update(now: Date = new Date()): void {
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();

    this.setHand(this.hourHand, ((h + m / 60) / 12) * 360, RADIUS * 0.5);
    this.setHand(this.minuteHand, ((m + s / 60) / 60) * 360, RADIUS * 0.75);
    this.setHand(this.secondHand, (s / 60) * 360, RADIUS * 0.85);

    const use24 = this.settings?.use24Hour ?? false;
    let hours = now.getHours();
    let suffix = "";
    if (!use24) {
      suffix = hours >= 12 ? " PM" : " AM";
      hours = hours % 12 || 12;
    }
    const hh = String(hours).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    this.digital.textContent = `${hh}:${mm}:${ss}${suffix}`;
  }

  private setHand(line: SVGLineElement, degrees: number, length: number): void {
    const angle = (degrees * Math.PI) / 180 - Math.PI / 2;
    line.setAttribute("x2", String(CENTER + length * Math.cos(angle)));
    line.setAttribute("y2", String(CENTER + length * Math.sin(angle)));
  }
}
