const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const os = require("os");
const pty = require("node-pty");
const si = require("systeminformation");

let win = null;
let ptyProcess = null;
let statsTimer = null;

function getDefaultShell() {
    if (process.platform === "win32") return "powershell.exe";
    return process.env.SHELL || "bash";
}

function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 980,
        backgroundColor: "#000000",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.removeMenu();

    const indexHtml = path.join(__dirname, "..", "renderer", "index.html");
    win.loadFile(indexHtml);

    win.once("ready-to-show", () => {
        win.show();
        win.maximize();
    });

    win.on("closed", () => {
        win = null;
    });
}

async function startStatsLoop() {
    if (statsTimer) clearInterval(statsTimer);

    statsTimer = setInterval(async () => {
        if (!win) return;

        try {
            const [load, mem, net] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.networkStats()
            ]);

            const total = mem.total || 1;
            const used = total - (mem.available ?? 0);

            const net0 = Array.isArray(net) && net.length ? net[0] : {};
            const payload = {
                cpu: Math.round(load.currentLoad ?? 0),
                memUsedMB: Math.round(used / 1024 / 1024),
                memTotalMB: Math.round(total / 1024 / 1024),
                rxKBs: Math.round((net0.rx_sec ?? 0) / 1024),
                txKBs: Math.round((net0.tx_sec ?? 0) / 1024)
            };

            win.webContents.send("sys:stats", payload);
        } catch {
            // ignore
        }
    }, 1000);
}

function spawnPty(cols, rows) {
    if (ptyProcess) return;

    const shellExe = getDefaultShell();
    const cwd = os.homedir();

    ptyProcess = pty.spawn(shellExe, [], {
        name: "xterm-color",
        cols: Math.max(10, cols || 120),
        rows: Math.max(5, rows || 30),
        cwd,
        env: process.env
    });

    ptyProcess.onData((data) => {
        if (win) win.webContents.send("terminal:data", data);
    });

    ptyProcess.onExit(() => {
        ptyProcess = null;
    });
}

app.whenReady().then(async () => {
    createWindow();
    await startStatsLoop();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    if (statsTimer) clearInterval(statsTimer);
    if (ptyProcess) {
        try { ptyProcess.kill(); } catch { }
    }
});

/* ----- IPC: terminal ----- */
ipcMain.handle("terminal:create", (_evt, { cols, rows }) => {
    spawnPty(cols, rows);
    return true;
});

ipcMain.on("terminal:write", (_evt, data) => {
    if (ptyProcess) ptyProcess.write(String(data));
});

ipcMain.on("terminal:resize", (_evt, { cols, rows }) => {
    if (ptyProcess) {
        try { ptyProcess.resize(cols, rows); } catch { }
    }
});

/* ----- IPC: fullscreen ----- */
ipcMain.handle("window:toggleFullscreen", () => {
    if (!win) return false;
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return next;
});

/* ----- IPC: browser window ----- */
ipcMain.handle("browser:open", async (_evt, { url }) => {
    let u = String(url || "").trim();
    if (!u) return false;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;

    const bw = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#000000",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    bw.setMenuBarVisibility(false);

    bw.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    await bw.loadURL(u);
    return true;
});