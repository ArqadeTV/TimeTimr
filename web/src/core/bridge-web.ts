import { Bridge } from "./bridge";
import { BridgeMessage, WidgetKind } from "./types";

const CHANNEL_NAME = "timetimr-channel";

/**
 * Web implementation of the cross-window bridge. Uses BroadcastChannel to sync
 * state between the main tab/window and any popped-out widget windows opened
 * with window.open() — this only works because they share the same origin.
 */
export class WebBridge implements Bridge {
  readonly environment = "web" as const;
  private channel: BroadcastChannel;

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
  }

  send(message: BridgeMessage): void {
    this.channel.postMessage(message);
  }

  onMessage(handler: (message: BridgeMessage) => void): () => void {
    const listener = (event: MessageEvent<BridgeMessage>) => handler(event.data);
    this.channel.addEventListener("message", listener);
    return () => this.channel.removeEventListener("message", listener);
  }

  openPopout(kind: WidgetKind): void {
    const url = `${popoutBaseUrl()}?widget=${kind}`;
    const features = "popup=yes,width=480,height=480,noopener";
    window.open(url, `timetimr-${kind}`, features);
  }

  closeSelf(): void {
    window.close();
  }
}

function popoutBaseUrl(): string {
  // Resolve popout.html next to the current page regardless of deployment sub-path.
  const url = new URL("popout.html", window.location.href);
  return url.toString();
}
