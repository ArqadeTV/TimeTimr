const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("timetimrElectron", {
  send(message) {
    ipcRenderer.send("ttr:broadcast", message);
  },
  onMessage(handler) {
    const listener = (_event, message) => handler(message);
    ipcRenderer.on("ttr:message", listener);
    return () => ipcRenderer.removeListener("ttr:message", listener);
  },
  openPopout(kind) {
    ipcRenderer.send("ttr:open-popout", kind);
  },
  closeSelf() {
    ipcRenderer.send("ttr:close-self");
  },
  setAlwaysOnTop(flag) {
    ipcRenderer.send("ttr:set-always-on-top", flag);
  },
});
