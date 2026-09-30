// The Document Picture-in-Picture API (Chromium-only as of this writing) is how a web
// page gets a genuinely chrome-less, real always-on-top window — no tab strip, address
// bar, or extensions row, the same mechanism behind things like Google Meet's floating
// call window. TypeScript doesn't ship types for it yet, so it's declared minimally here.
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function isPipSupported(): boolean {
  return typeof window !== "undefined" && !!window.documentPictureInPicture;
}

/** Opens a Document Picture-in-Picture window and copies this page's styles into it —
 *  a PiP window starts with a blank document, so nothing is styled until this runs. */
export async function openPipWindow(width: number, height: number): Promise<Window> {
  if (!window.documentPictureInPicture) {
    throw new Error("Document Picture-in-Picture is not supported in this browser");
  }
  const pipWindow = await window.documentPictureInPicture.requestWindow({ width, height });
  copyStylesInto(pipWindow);
  return pipWindow;
}

function copyStylesInto(pipWindow: Window): void {
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      const cssText = Array.from(styleSheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = pipWindow.document.createElement("style");
      style.textContent = cssText;
      pipWindow.document.head.appendChild(style);
    } catch {
      // Cross-origin sheet (cssRules threw) — fall back to linking it directly.
      if (!styleSheet.href) continue;
      const link = pipWindow.document.createElement("link");
      link.rel = "stylesheet";
      link.href = styleSheet.href;
      pipWindow.document.head.appendChild(link);
    }
  }
}
