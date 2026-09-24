import { Bridge, isElectron } from "./bridge";
import { ElectronBridge } from "./bridge-electron";
import { WebBridge } from "./bridge-web";

export function createBridge(): Bridge {
  return isElectron() ? new ElectronBridge() : new WebBridge();
}
