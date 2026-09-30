const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

const DEV_SERVER_URL = process.env.TIMETIMR_DEV_SERVER_URL || "http://localhost:5173";
const isDev = !app.isPackaged;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Map<'timer'|'clock'|'combined', BrowserWindow>} */
const popouts = new Map();
let alwaysOnTopForPopouts = false;

const POPOUT_TITLES = {
  timer: "TimeTimr — Timer",
  clock: "TimeTimr — Clock",
  combined: "TimeTimr — Timer & Clock",
};
const POPOUT_SIZES = {
  timer: { width: 460, height: 560 },
  clock: { width: 380, height: 440 },
  combined: { width: 780, height: 500 },
};

// How close (in px) two separate pop-out windows' edges need to be, while being
// dragged, before they auto-dock into one combined window.
const DOCK_MARGIN_PX = 60;

function rectsAreDockable(a, b, margin) {
  const ax1 = a.x - margin;
  const ay1 = a.y - margin;
  const ax2 = a.x + a.width + margin;
  const ay2 = a.y + a.height + margin;
  return !(b.x > ax2 || b.x + b.width < ax1 || b.y > ay2 || b.y + b.height < ay1);
}

function indexUrl() {
  if (isDev) return `${DEV_SERVER_URL}/index.html`;
  return `file://${path.join(__dirname, "web-dist", "index.html")}`;
}

function popoutUrl(kind) {
  if (isDev) return `${DEV_SERVER_URL}/popout.html?widget=${kind}`;
  return `file://${path.join(__dirname, "web-dist", "popout.html")}?widget=${kind}`;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 640,
    minHeight: 560,
    title: "TimeTimr",
    backgroundColor: "#f4f2ee",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(indexUrl());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
}

function createPopoutWindow(kind, atPosition) {
  const existing = popouts.get(kind);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const { width, height } = POPOUT_SIZES[kind];
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 260,
    minHeight: 260,
    x: atPosition ? Math.round(atPosition.x) : undefined,
    y: atPosition ? Math.round(atPosition.y) : undefined,
    title: POPOUT_TITLES[kind],
    backgroundColor: "#f4f2ee",
    alwaysOnTop: alwaysOnTopForPopouts,
    // Popout widgets shouldn't look like a normal app window — no menu bar chrome.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(popoutUrl(kind));
  win.on("closed", () => {
    popouts.delete(kind);
  });
  popouts.set(kind, win);

  // Only the standalone timer/clock pop-outs can be dragged together to dock;
  // the combined window has nothing left to merge with.
  if (kind === "timer" || kind === "clock") {
    win.on("move", () => maybeAutoDock());
  }
}

/** Checks whether the standalone timer and clock pop-outs have been dragged next to
 *  each other and, if so, merges them into one combined window in their place. */
function maybeAutoDock() {
  const timerWin = popouts.get("timer");
  const clockWin = popouts.get("clock");
  if (!timerWin || timerWin.isDestroyed() || !clockWin || clockWin.isDestroyed()) return;

  const a = timerWin.getBounds();
  const b = clockWin.getBounds();
  if (!rectsAreDockable(a, b, DOCK_MARGIN_PX)) return;

  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  // destroy() (not close()) skips each window's own beforeunload/close lifecycle —
  // we're reporting the resulting state ourselves below, in one authoritative message,
  // rather than racing with each window's own "I closed" broadcast.
  timerWin.destroy();
  clockWin.destroy();
  popouts.delete("timer");
  popouts.delete("clock");

  createPopoutWindow("combined", { x, y });
  broadcastToAll({ type: "popout-status", status: { timer: true, clock: true, combined: true } });
}

function broadcastToAll(message) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send("ttr:message", message);
  }
}

function broadcastFrom(senderWebContents, message) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents === senderWebContents) continue;
    if (win.isDestroyed()) continue;
    win.webContents.send("ttr:message", message);
  }
}

ipcMain.on("ttr:broadcast", (event, message) => {
  broadcastFrom(event.sender, message);
});

ipcMain.on("ttr:open-popout", (_event, kind, atPosition) => {
  if (kind === "timer" || kind === "clock" || kind === "combined") createPopoutWindow(kind, atPosition);
});

ipcMain.on("ttr:close-self", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});

ipcMain.on("ttr:set-always-on-top", (_event, flag) => {
  alwaysOnTopForPopouts = !!flag;
  for (const win of popouts.values()) {
    if (!win.isDestroyed()) win.setAlwaysOnTop(alwaysOnTopForPopouts);
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
