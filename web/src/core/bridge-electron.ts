import { Bridge } from "./bridge";
import { BridgeMessage, WidgetKind } from "./types";

/**
 * Electron implementation of the cross-window bridge. Delegates to the API
 * exposed on window.timetimrElectron by electron/preload.cjs, which relays
 * messages through the main process to every open BrowserWindow.
 */
export class ElectronBridge implements Bridge {
  readonly environment = "electron" as const;

  private get api() {
    if (!window.timetimrElectron) {
      throw new Error("ElectronBridge used outside an Electron renderer");
    }
    return window.timetimrElectron;
  }

  send(message: BridgeMessage): void {
    this.api.send(message);
  }

  onMessage(handler: (message: BridgeMessage) => void): () => void {
    return this.api.onMessage(handler);
  }

  openPopout(kind: WidgetKind): void {
    this.api.openPopout(kind);
  }

  closeSelf(): void {
    this.api.closeSelf();
  }

  setAlwaysOnTop(flag: boolean): void {
    this.api.setAlwaysOnTop(flag);
  }
}
