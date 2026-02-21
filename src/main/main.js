const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const pty = require("node-pty");
const si = require("systeminformation");

let win;

// ---------- Terminal sessions ----------
const sessions = new Map(); // id -> { pty }
let nextId = 1;

function shell() {
    if (process.platform === "win32") return "powershell.exe";
    return process.env.SHELL || "bash";
}

function createSession(cols, rows) {
    const id = String(nextId++);
    const proc = pty.spawn(shell(), [], {
        name: "xterm-color",
        cols: Math.max(10, cols || 120),
        rows: Math.max(5, rows || 30),
        cwd: os.homedir(),
        env: process.env
    });

    sessions.set(id, { pty: proc });

    proc.onData((data) => {
        win?.webContents.send("term:data", { id, data });
    });

    proc.onExit(() => {
        sessions.delete(id);
        win?.webContents.send("term:closed", { id });
    });

    return id;
}

// ---------- BrowserView ----------
let browserView = null;
let browserVisible = false;

function normalizeUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "https://example.com";
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s;
}

function ensureBrowserView() {
    if (browserView) return browserView;

    browserView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    browserView.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    browserView.webContents.loadURL("https://example.com").catch(() => { });

    const emit = () => {
        if (!win) return;
        win.webContents.send("browser:state", {
            url: browserView.webContents.getURL(),
            title: browserView.webContents.getTitle(),
            canGoBack: browserView.webContents.canGoBack(),
            canGoForward: browserView.webContents.canGoForward()
        });
    };

    browserView.webContents.on("did-navigate", emit);
    browserView.webContents.on("did-navigate-in-page", emit);
    browserView.webContents.on("page-title-updated", emit);
    browserView.webContents.on("did-finish-load", emit);

    return browserView;
}

// ---------- Window ----------
function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 950,
        backgroundColor: "#05080d",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.removeMenu();
    win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

    win.once("ready-to-show", () => {
        win.show();
        win.maximize();
    });

    win.on("resize", () => {
        if (browserVisible) win.webContents.send("browser:requestBounds");
    });

    win.on("closed", () => {
        win = null;
    });
}

// ---------- Telemetry loops ----------
let statsTimer, procsTimer, disksTimer, hwOnce = false;

async function startTelemetry() {
    if (statsTimer) clearInterval(statsTimer);
    if (procsTimer) clearInterval(procsTimer);
    if (disksTimer) clearInterval(disksTimer);

    // one-time hardware info
    if (!hwOnce) {
        hwOnce = true;
        try {
            const [cpu, osInfo] = await Promise.all([si.cpu(), si.osInfo()]);
            win?.webContents.send("sys:hw", {
                cpu: `${cpu.manufacturer} ${cpu.brand}`,
                platform: `${osInfo.distro} ${osInfo.release}`,
                hostname: os.hostname()
            });
        } catch { }
    }

    // fast stats
    statsTimer = setInterval(async () => {
        if (!win) return;
        try {
            const [load, mem, net, bat] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.networkStats(),
                si.battery().catch(() => null)
            ]);

            const total = mem.total || 1;
            const used = total - (mem.available ?? 0);
            const net0 = Array.isArray(net) && net.length ? net[0] : {};

            win.webContents.send("sys:stats", {
                cpu: Math.round(load.currentLoad ?? 0),
                memUsedMB: Math.round(used / 1024 / 1024),
                memTotalMB: Math.round(total / 1024 / 1024),
                rxKBs: Math.round((net0.rx_sec ?? 0) / 1024),
                txKBs: Math.round((net0.tx_sec ?? 0) / 1024),
                batteryPct: bat?.hasBattery ? Math.round(bat.percent ?? 0) : null,
                charging: bat?.hasBattery ? !!bat.isCharging : null
            });
        } catch { }
    }, 900);

    // processes
    procsTimer = setInterval(async () => {
        if (!win) return;
        try {
            const p = await si.processes();
            const list = (p.list || [])
                .map(x => ({
                    pid: x.pid,
                    name: x.name,
                    cpu: Math.round((x.pcpu || 0) * 10) / 10,
                    memMB: Math.round((x.mem_rss || 0) / 1024 / 1024)
                }))
                .sort((a, b) => b.cpu - a.cpu)
                .slice(0, 14);

            win.webContents.send("sys:procs", { list });
        } catch { }
    }, 2000);

    // disks
    disksTimer = setInterval(async () => {
        if (!win) return;
        try {
            const fsList = await si.fsSize();
            const disks = (fsList || []).slice(0, 10).map(d => ({
                fs: d.fs,
                sizeGB: Math.round((d.size || 0) / 1024 / 1024 / 1024),
                usedGB: Math.round((d.used || 0) / 1024 / 1024 / 1024),
                usePct: Math.round(d.use || 0)
            }));
            win.webContents.send("sys:disks", { disks });
        } catch { }
    }, 5000);
}

// ---------- IPC: terminal ----------
ipcMain.handle("term:new", (_e, { cols, rows }) => ({ id: createSession(cols, rows) }));
ipcMain.handle("term:list", () => Array.from(sessions.keys()).map(id => ({ id })));

ipcMain.handle("term:kill", (_e, { id }) => {
    const s = sessions.get(String(id));
    if (!s) return false;
    try { s.pty.kill(); } catch { }
    sessions.delete(String(id));
    return true;
});

ipcMain.on("term:write", (_e, { id, data }) => {
    const s = sessions.get(String(id));
    if (s) s.pty.write(String(data));
});

ipcMain.on("term:resize", (_e, { id, cols, rows }) => {
    const s = sessions.get(String(id));
    if (s) {
        try { s.pty.resize(cols, rows); } catch { }
    }
});

// ---------- IPC: browser ----------
ipcMain.handle("browser:show", (_e, { bounds, url }) => {
    if (!win) return false;
    const view = ensureBrowserView();
    win.setBrowserView(view);
    if (bounds) view.setBounds(bounds);
    browserVisible = true;
    if (url) view.webContents.loadURL(normalizeUrl(url)).catch(() => { });
    return true;
});

ipcMain.handle("browser:hide", () => {
    if (!win) return false;
    win.setBrowserView(null);
    browserVisible = false;
    return true;
});

ipcMain.handle("browser:setBounds", (_e, bounds) => {
    if (!browserView || !browserVisible) return false;
    browserView.setBounds(bounds);
    return true;
});

ipcMain.handle("browser:navigate", (_e, url) => ensureBrowserView().webContents.loadURL(normalizeUrl(url)));
ipcMain.handle("browser:back", () => { if (browserView?.webContents.canGoBack()) browserView.webContents.goBack(); return true; });
ipcMain.handle("browser:fwd", () => { if (browserView?.webContents.canGoForward()) browserView.webContents.goForward(); return true; });
ipcMain.handle("browser:reload", () => { browserView?.webContents.reload(); return true; });

// ---------- IPC: window controls ----------
ipcMain.handle("win:toggleFullscreen", () => {
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
});

ipcMain.handle("win:toggleAOT", () => {
    if (!win) return false;
    win.setAlwaysOnTop(!win.isAlwaysOnTop());
    return win.isAlwaysOnTop();
});

// ---------- App lifecycle ----------
app.whenReady().then(async () => {
    createWindow();
    await startTelemetry();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    if (statsTimer) clearInterval(statsTimer);
    if (procsTimer) clearInterval(procsTimer);
    if (disksTimer) clearInterval(disksTimer);

    for (const s of sessions.values()) {
        try { s.pty.kill(); } catch { }
    }
});