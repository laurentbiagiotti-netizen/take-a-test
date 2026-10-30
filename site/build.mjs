/**
 * Construit la démo statique dans site/dist (pour GitHub Pages).
 * Usage : npm run build:pages
 */
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "site/dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, "site/main.tsx")],
  bundle: true, minify: true, format: "iife", target: "es2020",
  outdir: out, entryNames: "main", assetNames: "fonts/[name]-[hash]",
  loader: { ".woff": "file", ".woff2": "file" },
  jsx: "automatic",
  alias: { "node:crypto": path.join(root, "site/shims/crypto.ts"), "@": root },
  inject: [path.join(root, "site/shims/buffer.ts")],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

execSync(`npx tailwindcss -c tailwind.config.ts -i app/globals.css -o ${path.join(out, "app.css")} --minify --content "./components/**/*.tsx,./site/**/*.tsx,./site/index.html"`, { cwd: root, stdio: "inherit" });
cpSync(path.join(root, "site/index.html"), path.join(out, "index.html"));
cpSync(path.join(root, "public/cybersup-logo-blanc.svg"), path.join(out, "cybersup-logo-blanc.svg"));
writeFileSync(path.join(out, ".nojekyll"), "");
writeFileSync(path.join(out, "404.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./">');
console.log("Démo statique prête dans site/dist");
