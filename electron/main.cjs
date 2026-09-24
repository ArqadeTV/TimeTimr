const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

const DEV_SERVER_URL = process.env.TIMETIMR_DEV_SERVER_URL || "http://localhost:5173";
const isDev = !app.isPackaged;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Map<'timer'|'clock', BrowserWindow>} */
const popouts = new Map();
let alwaysOnTopForPopouts = false;

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

function createPopoutWindow(kind) {
  const existing = popouts.get(kind);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const win = new BrowserWindow({
    width: kind === "timer" ? 460 : 380,
    height: kind === "timer" ? 560 : 440,
    minWidth: 260,
    minHeight: 260,
    title: kind === "timer" ? "TimeTimr — Timer" : "TimeTimr — Clock",
    backgroundColor: "#f4f2ee",
    alwaysOnTop: alwaysOnTopForPopouts,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(popoutUrl(kind));
  win.on("closed", () => {
    popouts.delete(kind);
  });
  popouts.set(kind, win);
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

ipcMain.on("ttr:open-popout", (_event, kind) => {
  if (kind === "timer" || kind === "clock") createPopoutWindow(kind);
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
