import { BridgeMessage, PopoutStatus, TimerState, WidgetKind } from "./types";

export interface PopoutPosition {
  x: number;
  y: number;
}

export interface Bridge {
  readonly environment: "web" | "electron";
  send(message: BridgeMessage): void;
  onMessage(handler: (message: BridgeMessage) => void): () => void;
  /** Open a widget in its own window. In Electron this is a real OS window; on the web it's window.open().
   *  `atPosition`, when given, places the new window's top-left corner there (used when auto-docking
   *  two dragged-together pop-outs into one, so the combined window appears where they met). */
  openPopout(kind: WidgetKind, atPosition?: PopoutPosition): void;
  /** Only meaningful inside a popout window. */
  closeSelf(): void;
  setAlwaysOnTop?(flag: boolean): void;
}

declare global {
  interface Window {
    timetimrElectron?: {
      send(message: BridgeMessage): void;
      onMessage(handler: (message: BridgeMessage) => void): () => void;
      openPopout(kind: WidgetKind, atPosition?: PopoutPosition): void;
      closeSelf(): void;
      setAlwaysOnTop(flag: boolean): void;
    };
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.timetimrElectron;
}

export function sendState(bridge: Bridge, state: TimerState): void {
  bridge.send({ type: "state", state });
}

export function sendPopoutStatus(bridge: Bridge, status: Partial<PopoutStatus>): void {
  bridge.send({ type: "popout-status", status });
}
