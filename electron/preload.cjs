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
  openPopout(kind, atPosition) {
    ipcRenderer.send("ttr:open-popout", kind, atPosition);
  },
  closeSelf() {
    ipcRenderer.send("ttr:close-self");
  },
  setAlwaysOnTop(flag) {
    ipcRenderer.send("ttr:set-always-on-top", flag);
  },
});
