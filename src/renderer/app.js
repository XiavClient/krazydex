import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

/* ---------- DOM ---------- */
const statusText = document.getElementById("statusText");

// left
const clockTime = document.getElementById("clockTime");
const clockDate = document.getElementById("clockDate");
const clockUptime = document.getElementById("clockUptime");
const sysType = document.getElementById("sysType");
const sysPlatform = document.getElementById("sysPlatform");
const sysHost = document.getElementById("sysHost");

const cpuPct = document.getElementById("cpuPct");
const memPct = document.getElementById("memPct");
const cpuBar = document.getElementById("cpuBar");
const memBar = document.getElementById("memBar");

const cpuGraph = document.getElementById("cpuGraph");
const netGraph = document.getElementById("netGraph");
const globe = document.getElementById("globe");

// center terminal
const termEl = document.getElementById("terminal");

// right
const tabs = Array.from(document.querySelectorAll(".rtab"));
const panes = {
    net: document.getElementById("tab-net"),
    bot: document.getElementById("tab-bot"),
    browser: document.getElementById("tab-browser")
};

const netState = document.getElementById("netState");
const netIPv4 = document.getElementById("netIPv4");
const netPing = document.getElementById("netPing");
const netDown = document.getElementById("netDown");
const netUp = document.getElementById("netUp");

// bot
const botMode = document.getElementById("botMode");
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

// browser controls
const urlInput = document.getElementById("urlInput");
const openUrlBtn = document.getElementById("openUrlBtn");
const toggleFullBtn = document.getElementById("toggleFullBtn");
const clearTermBtn = document.getElementById("clearTermBtn");

// dock
const dock = document.getElementById("dock");

// keyboard
const kbd = document.getElementById("kbd");

// boot
const boot = document.getElementById("boot");
const bootLog = document.getElementById("bootLog");
const bootBar = document.getElementById("bootBar");
const bootHint = document.getElementById("bootHint");

/* ---------- helpers ---------- */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function writeStatus(msg) {
    statusText.textContent = msg;
}

function addChatLine(role, text) {
    const line = document.createElement("div");
    line.textContent = `${role.toUpperCase()}: ${text}`;
    line.style.marginBottom = "8px";
    chatLog.appendChild(line);
    chatLog.scrollTop = chatLog.scrollHeight;
}

/* ---------- BOOT ---------- */
const bootLines = [
    "[core] verifying integrity…",
    "[ui] loading HUD layout…",
    "[term] binding PTY interface…",
    "[net] telemetry stream online…",
    "[bot] checking local model…",
    "[gfx] calibrating display…",
    "[core] ready."
];

let bootSkip = false;
window.addEventListener("keydown", () => { bootSkip = true; }, { once: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBoot() {
    bootLog.textContent = "";
    bootBar.style.width = "0%";
    bootHint.textContent = "binding subsystems…";

    for (let i = 0; i < bootLines.length; i++) {
        if (bootSkip) break;
        bootLog.textContent += bootLines[i] + "\n";
        bootBar.style.width = `${Math.round(((i + 1) / bootLines.length) * 100)}%`;
        await sleep(220);
    }
    bootHint.textContent = "entering HUD…";
    await sleep(250);
    boot.style.display = "none";
}
runBoot().catch(() => { boot.style.display = "none"; });

/* ---------- CLOCK ---------- */
const startMs = Date.now();
function updateClock() {
    const d = new Date();
    clockTime.textContent = d.toLocaleTimeString([], { hour12: false });
    clockDate.textContent = d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });

    const up = Math.floor((Date.now() - startMs) / 1000);
    const hh = String(Math.floor(up / 3600)).padStart(2, "0");
    const mm = String(Math.floor((up % 3600) / 60)).padStart(2, "0");
    const ss = String(up % 60).padStart(2, "0");
    clockUptime.textContent = `UPTIME ${hh}:${mm}:${ss}`;
}
setInterval(updateClock, 250);
updateClock();

/* ---------- TERMINAL ---------- */
const term = new Terminal({
    cursorBlink: true,
    scrollback: 8000,
    fontSize: 14,
    lineHeight: 1.15,
    theme: {
        background: "#000000",
        foreground: "#e6eef7",
        cursor: "#e6eef7",
        selection: "rgba(230,238,247,0.18)"
    }
});

const fit = new FitAddon();
term.loadAddon(fit);
term.open(termEl);
fit.fit();
term.focus();

function getDims() {
    const d = fit.proposeDimensions();
    if (!d) return { cols: 120, rows: 30 };
    return d;
}

(async () => {
    const { cols, rows } = getDims();
    await window.api.terminal.create(cols, rows);
    writeStatus("online");
})();

window.api.terminal.onData((data) => term.write(data));
term.onData((data) => window.api.terminal.write(data));

window.addEventListener("resize", () => {
    fit.fit();
    const { cols, rows } = getDims();
    window.api.terminal.resize(cols, rows);
});

/* ---------- TAB SWITCH ---------- */
tabs.forEach(btn => {
    btn.addEventListener("click", () => {
        tabs.forEach(b => b.classList.remove("rtab--active"));
        btn.classList.add("rtab--active");
        const which = btn.dataset.tab;
        Object.entries(panes).forEach(([k, el]) => {
            el.classList.toggle("tabpane--active", k === which);
        });
    });
});

/* ---------- graphs ---------- */
function drawSpark(canvas, data) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background grid
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#e6eef7";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (data.length < 2) return;

    ctx.strokeStyle = "#e6eef7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * (w - 6) + 3;
        const y = h - ((data[i] / 100) * (h - 6) + 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

const cpuHist = [];
const netHist = [];

function pushHist(arr, v, max = 60) {
    arr.push(v);
    while (arr.length > max) arr.shift();
}

/* ---------- stylized globe ---------- */
function drawGlobe() {
    const ctx = globe.getContext("2d");
    const w = globe.width, h = globe.height;
    ctx.clearRect(0, 0, w, h);

    // sphere outline
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
    ctx.strokeStyle = "rgba(230,238,247,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // dot field on sphere
    ctx.fillStyle = "rgba(230,238,247,0.55)";
    for (let i = 0; i < 900; i++) {
        const a = Math.random() * Math.PI * 2;
        const b = (Math.random() - 0.5) * Math.PI;
        const x = cx + Math.cos(a) * Math.cos(b) * r;
        const y = cy + Math.sin(b) * r;
        // simple shading
        const shade = (Math.cos(a) * Math.cos(b) + 1) / 2;
        if (Math.random() > shade) continue;
        ctx.globalAlpha = 0.15 + shade * 0.65;
        ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // latitude lines
    ctx.strokeStyle = "rgba(230,238,247,0.10)";
    for (let t = -2; t <= 2; t++) {
        const yy = cy + (t * r) / 3;
        ctx.beginPath();
        ctx.ellipse(cx, yy, r * Math.cos((t / 3) * 1.05), r * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}
drawGlobe();

/* ---------- SYSTEM STATS ---------- */
sysType.textContent = "win";
sysPlatform.textContent = navigator.platform || "unknown";
sysHost.textContent = "local";

window.api.system.onStats((s) => {
    // bars
    const memP = clamp(Math.round((s.memUsedMB / Math.max(1, s.memTotalMB)) * 100), 0, 100);
    cpuBar.style.width = `${clamp(s.cpu, 0, 100)}%`;
    memBar.style.width = `${memP}%`;
    cpuPct.textContent = `${clamp(s.cpu, 0, 100)}%`;
    memPct.textContent = `${memP}%`;

    // graphs
    pushHist(cpuHist, clamp(s.cpu, 0, 100));
    drawSpark(cpuGraph, cpuHist);

    const down = clamp(s.rxKBs ?? 0, 0, 999999);
    const up = clamp(s.txKBs ?? 0, 0, 999999);
    netDown.textContent = `${down} KB/s`;
    netUp.textContent = `${up} KB/s`;

    // normalize traffic to 0-100 for sparkline
    const trafficNorm = clamp(Math.log10(1 + down + up) * 25, 0, 100);
    pushHist(netHist, trafficNorm);
    drawSpark(netGraph, netHist);

    netState.textContent = "ONLINE";
    netPing.textContent = `${Math.round(30 + Math.random() * 25)}ms`; // placeholder ping
    netIPv4.textContent = "(runner/local)";
});

/* ---------- DOCK ---------- */
dock.addEventListener("click", (e) => {
    const btn = e.target.closest(".dock-item");
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === "browser") {
        tabs.find(x => x.dataset.tab === "browser")?.click();
        urlInput.focus();
    } else if (a === "help") {
        term.write("\r\nKrazyDEX shortcuts:\r\n- Dock: Browser / Help / Clear / Full\r\n- Right tabs: Network / Bot / Browser\r\n\r\n");
    } else if (a === "clear") {
        term.clear();
    } else if (a === "fullscreen") {
        window.api.window.toggleFullscreen();
    }
});

/* ---------- BROWSER ---------- */
openUrlBtn.addEventListener("click", async () => {
    const raw = (urlInput.value || "").trim();
    if (!raw) return;
    await window.api.browser.open(raw);
});

toggleFullBtn.addEventListener("click", () => window.api.window.toggleFullscreen());
clearTermBtn.addEventListener("click", () => term.clear());

/* ---------- ON-SCREEN KEYBOARD ---------- */
const layout = [
    ["ESC", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "BACK"],
    ["TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
    ["CAPS", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "ENTER"],
    ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "SHIFT"],
    ["CTRL", "FN", "ALT", "SPACE", "ALT", "CTRL"]
];

function keyToSend(k) {
    if (k === "ENTER") return "\r\n";
    if (k === "TAB") return "\t";
    if (k === "SPACE") return " ";
    if (k === "BACK") return "\x7f"; // backspace
    if (k === "ESC") return "\x1b";
    return k.length === 1 ? k : "";
}

function buildKeyboard() {
    kbd.innerHTML = "";
    layout.forEach((row) => {
        row.forEach((k) => {
            const b = document.createElement("div");
            b.className = "key";
            b.textContent = k;

            // widths
            if (k === "BACK") b.classList.add("w2");
            if (k === "TAB") b.classList.add("w2");
            if (k === "CAPS") b.classList.add("w2");
            if (k === "ENTER") b.classList.add("w2");
            if (k === "SHIFT") b.classList.add("w3");
            if (k === "SPACE") b.classList.add("w6");

            b.addEventListener("click", () => {
                term.focus();
                const send = keyToSend(k);
                if (send) window.api.terminal.write(send);
                if (k === "ENTER") window.api.terminal.write(""); // noop
            });

            kbd.appendChild(b);
        });
    });
}
buildKeyboard();

/* ---------- “REAL” OFFLINE CHATBOT (LOCAL LLM OPTION) ---------- */
/**
 * If you install Ollama locally:
 * 1) Install Ollama
 * 2) Run: ollama pull llama3.2
 * 3) Keep Ollama running
 * This app will talk to it at http://localhost:11434 (local machine only).
 */
const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "llama3.2"; // change if you want

let ollamaOk = null;

async function ollamaGenerate(prompt) {
    const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false
        })
    });
    if (!res.ok) throw new Error("ollama http " + res.status);
    const data = await res.json();
    return (data.response || "").trim();
}

function offlineFallbackAnswer(q) {
    const t = q.trim().toLowerCase();
    if (t.includes("time")) return `Time: ${new Date().toLocaleTimeString()}`;
    if (t.includes("date") || t.includes("day")) return `Date: ${new Date().toLocaleDateString()}`;
    if (t.includes("hello") || t.includes("hi")) return "Hello. (Tip: install Ollama locally for full answers.)";
    return "I’m running in fallback mode. Install Ollama locally to get real Siri-like Q&A offline.";
}

async function ensureOllama() {
    if (ollamaOk !== null) return ollamaOk;
    try {
        await ollamaGenerate("Say 'OK' only.");
        ollamaOk = true;
        botMode.textContent = `LOCAL LLM (${OLLAMA_MODEL})`;
        return true;
    } catch {
        ollamaOk = false;
        botMode.textContent = "OFFLINE (FALLBACK)";
        return false;
    }
}
ensureOllama().catch(() => { });

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = (chatInput.value || "").trim();
    if (!q) return;
    chatInput.value = "";

    addChatLine("you", q);
    writeStatus("bot: thinking…");

    const ok = await ensureOllama();
    try {
        if (ok) {
            const a = await ollamaGenerate(q);
            addChatLine("bot", a || "(no response)");
        } else {
            addChatLine("bot", offlineFallbackAnswer(q));
        }
    } catch (err) {
        addChatLine("bot", "Error talking to local model. Is Ollama running?");
    } finally {
        writeStatus("online");
    }
});