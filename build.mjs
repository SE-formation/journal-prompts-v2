// Static build: copies the site sources from src/ into dist/.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const out = join(root, "dist");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });
console.log("Built to dist/");
