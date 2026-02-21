import * as esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const distMain = path.join(dist, "main");
const distR = path.join(dist, "renderer");
const distV = path.join(distR, "vendor");

async function rmrf(p) { await fs.rm(p, { recursive: true, force: true }); }
async function mkdirp(p) { await fs.mkdir(p, { recursive: true }); }
async function copy(src, dst) {
    await mkdirp(path.dirname(dst));
    await fs.copyFile(src, dst);
}

await rmrf(dist);
await mkdirp(distMain);
await mkdirp(distR);
await mkdirp(distV);

// main/preload
await copy("src/main/main.js", "dist/main/main.js");
await copy("src/main/preload.js", "dist/main/preload.js");

// renderer
await copy("src/renderer/index.html", "dist/renderer/index.html");
await copy("src/renderer/ui.css", "dist/renderer/ui.css");
await copy("node_modules/@xterm/xterm/css/xterm.css", "dist/renderer/vendor/xterm.css");

// bundle renderer JS
await esbuild.build({
    entryPoints: ["src/renderer/app.js"],
    bundle: true,
    platform: "browser",
    format: "iife",
    minify: true,
    target: ["chrome120"],
    outfile: "dist/renderer/bundle.js",
    define: { "process.env.NODE_ENV": "\"production\"" }
});

console.log("✅ Build complete: dist/");