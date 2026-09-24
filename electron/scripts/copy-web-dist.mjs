import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "..", "web", "dist");
const dest = path.resolve(here, "..", "web-dist");

if (!existsSync(src)) {
  console.error(`[timetimr] ${src} not found — run "npm run build:web" first.`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[timetimr] copied web/dist -> electron/web-dist`);
