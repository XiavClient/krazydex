import * as esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const distMain = path.join(distDir, "main");
const distRenderer = path.join(distDir, "renderer");
const distVendor = path.join(distRenderer, "vendor");

async function clean() {
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.mkdir(distMain, { recursive: true });
    await fs.mkdir(distRenderer, { recursive: true });
    await fs.mkdir(distVendor, { recursive: true });
}

async function copyFile(src, dest) {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
}

async function copyStatic() {
    await copyFile("src/main/main.js", "dist/main/main.js");
    await copyFile("src/main/preload.js", "dist/main/preload.js");

    await copyFile("src/renderer/index.html", "dist/renderer/index.html");
    await copyFile("src/renderer/ui.css", "dist/renderer/ui.css");

    await copyFile(
        "node_modules/@xterm/xterm/css/xterm.css",
        "dist/renderer/vendor/xterm.css"
    );
}

async function bundleRenderer() {
    await esbuild.build({
        entryPoints: ["src/renderer/app.js"],
        bundle: true,
        platform: "browser",
        format: "iife",
        minify: true,
        sourcemap: false,
        target: ["chrome120"],
        outfile: "dist/renderer/bundle.js",
        define: {
            "process.env.NODE_ENV": "\"production\""
        }
    });
}

await clean();
await copyStatic();
await bundleRenderer();

console.log("✅ Build complete: dist/");