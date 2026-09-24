import { BridgeMessage, PopoutStatus, TimerState, WidgetKind } from "./types";

export interface Bridge {
  readonly environment: "web" | "electron";
  send(message: BridgeMessage): void;
  onMessage(handler: (message: BridgeMessage) => void): () => void;
  /** Open a widget in its own window. In Electron this is a real OS window; on the web it's window.open(). */
  openPopout(kind: WidgetKind): void;
  /** Only meaningful inside a popout window. */
  closeSelf(): void;
  setAlwaysOnTop?(flag: boolean): void;
}

declare global {
  interface Window {
    timetimrElectron?: {
      send(message: BridgeMessage): void;
      onMessage(handler: (message: BridgeMessage) => void): () => void;
      openPopout(kind: WidgetKind): void;
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
