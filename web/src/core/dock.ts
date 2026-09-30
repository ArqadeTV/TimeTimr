import { WidgetBounds } from "./types";

/** How close two pop-out windows' edges need to be (in px) before they auto-dock into one. */
export const DOCK_MARGIN_PX = 60;

/** True if `b` overlaps `a` once `a` is expanded by `margin` px on every side — i.e. the two
 *  windows are touching, overlapping, or close enough to read as "dragged together." */
export function boundsAreDockable(a: WidgetBounds, b: WidgetBounds, margin = DOCK_MARGIN_PX): boolean {
  const ax1 = a.x - margin;
  const ay1 = a.y - margin;
  const ax2 = a.x + a.width + margin;
  const ay2 = a.y + a.height + margin;
  return !(b.x > ax2 || b.x + b.width < ax1 || b.y > ay2 || b.y + b.height < ay1);
}
