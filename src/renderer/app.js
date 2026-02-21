import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const boot = $("boot");
const bootAscii = $("bootAscii");
const bootLog = $("bootLog");
const bootHex = $("bootHex");
const bootFill = $("bootFill");
const bootPct = $("bootPct");

const viewBtns = Array.from(document.querySelectorAll(".tab"));
const views = Array.from(document.querySelectorAll(".view"));
const bControls = $("bControls");

const btnFull = $("btnFull");
const btnAOT = $("btnAOT");
const btnPal = $("btnPal");

const sessList = $("sessList");
const newSess = $("newSess");
const killSess = $("killSess");
const toggleSplit = $("toggleSplit");

const cpuBar = $("cpuBar");
const memBar = $("memBar");
const gCpu = $("gCpu");
const gNet = $("gNet");
const hw = $("hw");

const status = $("status");
const line = $("line");
const mini = $("mini");

const tSearch = $("tSearch");
const tClear = $("tClear");
const tCopy = $("tCopy");
const tPaste = $("tPaste");
const tFontUp = $("tFontUp");
const tFontDn = $("tFontDn");

const paneB = $("paneB");
const selA = $("selA");
const selB = $("selB");
const mountA = $("mountA");
const mountB = $("mountB");
const stash = $("stash");

const bBack = $("bBack");
const bFwd = $("bFwd");
const bReload = $("bReload");
const bGo = $("bGo");
const bUrl = $("bUrl");
const bStar = $("bStar");
const marks = $("marks");

const procs = $("procs");
const disks = $("disks");

const chatLog = $("chatLog");
const chatForm = $("chatForm");
const chatInput = $("chatInput");

const calcIn = $("calcIn");
const calcRun = $("calcRun");
const calcOut = $("calcOut");
const notes = $("notes");
const b64Enc = $("b64Enc");
const b64Dec = $("b64Dec");
const b64Box = $("b64Box");
const jsonFmt = $("jsonFmt");
const jsonBox = $("jsonBox");

const themeSel = $("theme");
const scan = $("scan");
const grid = $("grid");
const motion = $("motion");
const bootToggle = $("bootToggle");

const palette = $("palette");
const palInput = $("palInput");
const palList = $("palList");

/* ---------- State ---------- */
let split = false;
let fontSize = Number(localStorage.getItem("fontSize") || 14);
let activeView = "terminal";
let browserState = { url: "", canGoBack: false, canGoForward: false, title: "" };

const sessions = new Map(); // id -> { term, fit, search, hostDiv }
let activeA = null;
let activeB = null;

/* ---------- Settings apply ---------- */
function applySettings() {
    const theme = localStorage.getItem("theme") || "cyan";
    document.body.dataset.theme = theme;
    themeSel.value = theme;

    const scanOn = (localStorage.getItem("scan") ?? "1") === "1";
    const gridOn = (localStorage.getItem("grid") ?? "1") === "1";
    const motionOn = (localStorage.getItem("motion") ?? "1") === "1";
    const bootOn = (localStorage.getItem("boot") ?? "1") === "1";

    scan.checked = scanOn;
    grid.checked = gridOn;
    motion.checked = motionOn;
    bootToggle.checked = bootOn;

    $("scanlines").style.display = scanOn ? "block" : "none";
    $("bgGrid").style.display = gridOn ? "block" : "none";
    $("bgGrid").style.animation = motionOn ? "" : "none";
}

applySettings();

themeSel.addEventListener("change", () => { localStorage.setItem("theme", themeSel.value); applySettings(); });
scan.addEventListener("change", () => { localStorage.setItem("scan", scan.checked ? "1" : "0"); applySettings(); });
grid.addEventListener("change", () => { localStorage.setItem("grid", grid.checked ? "1" : "0"); applySettings(); });
motion.addEventListener("change", () => { localStorage.setItem("motion", motion.checked ? "1" : "0"); applySettings(); });
bootToggle.addEventListener("change", () => localStorage.setItem("boot", bootToggle.checked ? "1" : "0"));

/* ---------- Boot animation (ultra) ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ascii = [
    "██╗  ██╗██████╗  █████╗ ███████╗██╗   ██╗██████╗ ███████╗██╗  ██╗",
    "██║ ██╔╝██╔══██╗██╔══██╗╚══███╔╝╚██╗ ██╔╝██╔══██╗██╔════╝╚██╗██╔╝",
    "█████╔╝ ██████╔╝███████║  ███╔╝  ╚████╔╝ ██║  ██║█████╗   ╚███╔╝ ",
    "██╔═██╗ ██╔══██╗██╔══██║ ███╔╝    ╚██╔╝  ██║  ██║██╔══╝   ██╔██╗ ",
    "██║  ██╗██║  ██║██║  ██║███████╗   ██║   ██████╔╝███████╗██╔╝ ██╗",
    "╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝"
];

const lines = [
    "[core] ignition",
    "[mem] scan ok",
    "[ui ] compositing",
    "[pty] linking sessions",
    "[sys] telemetry online",
    "[net] counters armed",
    "[sec] sandbox locked",
    "[gfx] glow pipeline",
    "[core] READY"
];

function hexLine() {
    const addr = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
    const bytes = Array.from({ length: 26 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"));
    return `${addr}: ${bytes.join(" ")}`;
}

async function runBoot() {
    const bootOn = (localStorage.getItem("boot") ?? "1") === "1";
    if (!bootOn) { boot.style.display = "none"; return; }

    bootAscii.textContent = "";
    bootLog.textContent = "";
    bootHex.textContent = "";
    bootFill.style.width = "0%";
    bootPct.textContent = "0%";

    for (const l of ascii) {
        bootAscii.textContent += l + "\n";
        await sleep(25);
    }

    for (let i = 0; i < lines.length; i++) {
        bootLog.textContent += lines[i] + "\n";
        for (let k = 0; k < 3; k++) bootHex.textContent += hexLine() + "\n";

        const hx = bootHex.textContent.split("\n");
        if (hx.length > 60) bootHex.textContent = hx.slice(-60).join("\n");

        const pct = Math.round(((i + 1) / lines.length) * 100);
        bootFill.style.width = `${pct}%`;
        bootPct.textContent = `${pct}%`;

        await sleep(120 + Math.floor(Math.random() * 120));
    }

    await sleep(220);
    boot.classList.add("done");
    await sleep(520);
    boot.style.display = "none";
}

runBoot().catch(() => { });

/* ---------- Views ---------- */
function showView(name) {
    activeView = name;
    viewBtns.forEach(b => b.classList.toggle("active", b.dataset.view === name));
    views.forEach(v => v.classList.toggle("show", v.dataset.view === name));
    bControls.classList.toggle("hidden", name !== "browser");

    if (name === "browser") showBrowser();
    else window.api.browser.hide();
}

viewBtns.forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));

/* ---------- Palette ---------- */
const actions = [
    { name: "Go: Terminal", run: () => showView("terminal") },
    { name: "Go: System", run: () => showView("system") },
    { name: "Go: Browser", run: () => showView("browser") },
    { name: "Go: Knowledge", run: () => showView("knowledge") },
    { name: "Go: Tools", run: () => showView("tools") },
    { name: "Go: Settings", run: () => showView("settings") },
    { name: "Terminal: New session", run: () => createSession() },
    { name: "Terminal: Toggle split", run: () => toggleSplitUI() },
    { name: "Browser: Open example.com", run: () => { showView("browser"); window.api.browser.navigate("https://example.com"); } },
];

function openPalette() {
    palette.classList.remove("hidden");
    palInput.value = "";
    renderPal("");
    palInput.focus();
}
function closePalette() { palette.classList.add("hidden"); }
function renderPal(q) {
    palList.innerHTML = "";
    const f = q.toLowerCase();
    const shown = actions.filter(a => a.name.toLowerCase().includes(f)).slice(0, 12);
    for (const a of shown) {
        const d = document.createElement("div");
        d.className = "palItem";
        d.textContent = a.name;
        d.onclick = () => { a.run(); closePalette(); };
        palList.appendChild(d);
    }
}

btnPal.addEventListener("click", openPalette);
palInput.addEventListener("input", () => renderPal(palInput.value));
palInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePalette();
    if (e.key === "Enter") palList.firstChild?.click();
});
palette.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
    if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); showView("terminal"); tSearch.focus(); }
    if (e.key === "Escape" && !palette.classList.contains("hidden")) closePalette();
});

/* ---------- Window controls ---------- */
btnFull.addEventListener("click", async () => {
    const on = await window.api.win.toggleFullscreen();
    btnFull.textContent = on ? "FULL*" : "FULL";
});
btnAOT.addEventListener("click", async () => {
    const on = await window.api.win.toggleAOT();
    btnAOT.textContent = on ? "AOT*" : "AOT";
});

/* ---------- Browser ---------- */
function browserBounds() {
    const center = document.querySelector(".center").getBoundingClientRect();
    const c = bControls.getBoundingClientRect();
    return {
        x: Math.round(center.left),
        y: Math.round(c.bottom),
        width: Math.round(center.width),
        height: Math.round(center.bottom - c.bottom)
    };
}

async function showBrowser(url) {
    const b = browserBounds();
    await window.api.browser.show(b, url || browserState.url || "https://example.com");
    await window.api.browser.setBounds(b);
}

window.api.browser.onRequestBounds(() => {
    if (activeView === "browser") window.api.browser.setBounds(browserBounds());
});

window.api.browser.onState((s) => {
    browserState = s || browserState;
    bUrl.value = browserState.url || bUrl.value;
    bBack.disabled = !browserState.canGoBack;
    bFwd.disabled = !browserState.canGoForward;
});

bBack.onclick = () => window.api.browser.back();
bFwd.onclick = () => window.api.browser.fwd();
bReload.onclick = () => window.api.browser.reload();
bGo.onclick = () => { const u = bUrl.value.trim(); if (u) window.api.browser.navigate(u); };
bUrl.addEventListener("keydown", (e) => { if (e.key === "Enter") bGo.click(); });

/* Bookmarks */
function getMarks() {
    try { return JSON.parse(localStorage.getItem("marks") || "[]"); } catch { return []; }
}
function setMarks(arr) { localStorage.setItem("marks", JSON.stringify(arr)); renderMarks(); }

function renderMarks() {
    marks.innerHTML = "";
    const arr = getMarks();
    for (const u of arr) {
        const m = document.createElement("div");
        m.className = "mark";
        m.textContent = u;
        m.onclick = () => { showView("browser"); window.api.browser.navigate(u); };
        marks.appendChild(m);
    }
}

bStar.onclick = () => {
    const u = (bUrl.value || browserState.url || "").trim();
    if (!u) return;
    const arr = getMarks();
    if (!arr.includes(u)) arr.unshift(u);
    setMarks(arr.slice(0, 12));
};

renderMarks();

/* ---------- Terminal sessions + split ---------- */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function addSessItem(id) {
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.id = id;
    el.textContent = `#${id}`;
    el.onclick = () => { setPane("A", id); };
    return el;
}

function renderSessList() {
    sessList.innerHTML = "";
    for (const id of sessions.keys()) {
        const el = addSessItem(id);
        if (id === activeA || id === activeB) el.classList.add("active");
        sessList.appendChild(el);
    }
    refreshSelects();
}

function refreshSelects() {
    const ids = Array.from(sessions.keys());
    const fill = (sel, active) => {
        sel.innerHTML = "";
        for (const id of ids) {
            const o = document.createElement("option");
            o.value = id;
            o.textContent = `#${id}`;
            if (id === active) o.selected = true;
            sel.appendChild(o);
        }
    };
    fill(selA, activeA);
    fill(selB, activeB);
}

function makeTerminalHost() {
    const host = document.createElement("div");
    host.style.height = "100%";
    host.style.width = "100%";
    return host;
}

function createXterm() {
    const term = new Terminal({
        cursorBlink: true,
        scrollback: 12000,
        fontSize,
        lineHeight: 1.14,
        theme: {
            background: "#05080d",
            foreground: getComputedStyle(document.body).getPropertyValue("--fg").trim() || "#cfe7ff",
            cursor: getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#6fe7ff",
            selection: "rgba(111,231,255,0.20)"
        }
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    const links = new WebLinksAddon((_e, uri) => {
        showView("browser");
        window.api.browser.navigate(uri);
    });

    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(links);

    return { term, fit, search };
}

async function createSession() {
    const host = makeTerminalHost();
    stash.appendChild(host);

    const { term, fit, search } = createXterm();
    term.open(host);
    fit.fit();

    const dims = fit.proposeDimensions() || { cols: 120, rows: 30 };
    const res = await window.api.term.new(dims.cols, dims.rows);
    const id = res.id;

    sessions.set(id, { term, fit, search, host });

    term.onData((data) => window.api.term.write(id, data));
    term.writeln(`\x1b[1;36mKrazyDEX ULTRA session #${id}\x1b[0m`);
    term.writeln(`\x1b[2;37mCtrl+K palette • Ctrl+F search • links click => Browser\x1b[0m`);

    if (!activeA) setPane("A", id);
    if (split && !activeB && id !== activeA) setPane("B", id);

    renderSessList();
    status.textContent = `session #${id} online`;
    return id;
}

function attachTo(mount, id) {
    const s = sessions.get(id);
    if (!s) return;
    mount.innerHTML = "";
    mount.appendChild(s.host);
    s.fit.fit();
    const dims = s.fit.proposeDimensions();
    if (dims) window.api.term.resize(id, dims.cols, dims.rows);
    s.term.focus();
}

function setPane(which, id) {
    if (!sessions.has(id)) return;
    if (which === "A") activeA = id;
    if (which === "B") activeB = id;

    attachTo(which === "A" ? mountA : mountB, id);
    renderSessList();
}

selA.addEventListener("change", () => setPane("A", selA.value));
selB.addEventListener("change", () => setPane("B", selB.value));

function toggleSplitUI() {
    split = !split;
    paneB.classList.toggle("hidden", !split);

    if (split) {
        if (!activeB) {
            const other = Array.from(sessions.keys()).find(x => x !== activeA);
            if (other) setPane("B", other);
        } else {
            attachTo(mountB, activeB);
        }
    } else {
        // stash pane B host if exists
        if (activeB) {
            const s = sessions.get(activeB);
            if (s) stash.appendChild(s.host);
        }
        activeB = null;
    }

    renderSessList();
}

toggleSplit.addEventListener("click", toggleSplitUI);

newSess.addEventListener("click", () => createSession());
killSess.addEventListener("click", async () => {
    const id = activeA;
    if (!id) return;
    await window.api.term.kill(id);
});

window.api.term.onClosed(({ id }) => {
    const sid = String(id);
    const s = sessions.get(sid);
    s?.host?.remove();
    sessions.delete(sid);

    if (activeA === sid) activeA = null;
    if (activeB === sid) activeB = null;

    const first = Array.from(sessions.keys())[0] || null;
    if (first) setPane("A", first);

    if (split) {
        const second = Array.from(sessions.keys()).find(x => x !== activeA) || null;
        if (second) setPane("B", second);
    }

    renderSessList();
});

window.api.term.onData(({ id, data }) => {
    const s = sessions.get(String(id));
    if (s) s.term.write(data);
});

function activeSearchObj() {
    if (!activeA) return null;
    return sessions.get(activeA);
}

tSearch.addEventListener("keydown", (e) => {
    const q = tSearch.value.trim();
    if (!q) return;
    if (e.key === "Enter") {
        const s = activeSearchObj();
        if (!s) return;
        if (e.shiftKey) s.search.findPrevious(q);
        else s.search.findNext(q);
    }
});

tClear.onclick = () => sessions.get(activeA)?.term.clear();

tCopy.onclick = async () => {
    const s = sessions.get(activeA);
    const text = s?.term.getSelection() || "";
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch { }
};

tPaste.onclick = async () => {
    const txt = await navigator.clipboard.readText().catch(() => "");
    if (txt && activeA) window.api.term.write(activeA, txt);
};

function applyFont(newSize) {
    fontSize = clamp(newSize, 10, 22);
    localStorage.setItem("fontSize", String(fontSize));
    for (const [id, s] of sessions) {
        s.term.options.fontSize = fontSize;
        s.fit.fit();
        const dims = s.fit.proposeDimensions();
        if (dims) window.api.term.resize(id, dims.cols, dims.rows);
    }
}
tFontUp.onclick = () => applyFont(fontSize + 1);
tFontDn.onclick = () => applyFont(fontSize - 1);

/* quick buttons */
$("qSys").onclick = () => activeA && window.api.term.write(activeA, "systeminfo\r\n");
$("qIP").onclick = () => activeA && window.api.term.write(activeA, "ipconfig\r\n");
$("qDir").onclick = () => activeA && window.api.term.write(activeA, "dir\r\n");
$("qWiki").onclick = () => { showView("browser"); window.api.browser.navigate("https://en.wikipedia.org"); };

/* first session */
createSession().catch(() => { });

/* ---------- Telemetry UI ---------- */
const cpuHist = Array(80).fill(0);
const netHist = Array(80).fill(0);

function drawGraph(canvas, arr, label) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = Math.round((h * i) / 4);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,255,123,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
        const x = (i / (arr.length - 1)) * w;
        const y = h - (arr[i] * h);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(207,231,255,0.75)";
    ctx.font = "12px monospace";
    ctx.fillText(label, 8, 14);
}

window.api.sys.onHw((p) => {
    hw.textContent = `CPU: ${p.cpu}\nOS: ${p.platform}\nHOST: ${p.hostname}`;
});

window.api.sys.onStats((s) => {
    const cpu = clamp(s.cpu, 0, 100);
    const memPct = Math.round((s.memUsedMB / Math.max(1, s.memTotalMB)) * 100);

    cpuBar.style.width = `${cpu}%`;
    memBar.style.width = `${clamp(memPct, 0, 100)}%`;

    const bat = s.batteryPct == null ? "" : ` • BAT ${s.batteryPct}%${s.charging ? "⚡" : ""}`;
    line.textContent = `CPU ${cpu}% • MEM ${s.memUsedMB}/${s.memTotalMB} MB • NET ↓${s.rxKBs} ↑${s.txKBs} KB/s${bat}`;
    mini.textContent = `CPU ${cpu}% • MEM ${memPct}%`;

    cpuHist.push(cpu / 100); cpuHist.shift();
    const net = Math.min(1, (s.rxKBs + s.txKBs) / 4000);
    netHist.push(net); netHist.shift();

    drawGraph(gCpu, cpuHist, "CPU LOAD");
    drawGraph(gNet, netHist, "NET");
});

window.api.sys.onProcs(({ list }) => {
    const rows = [];
    rows.push(`<div class="tr head"><div>PID</div><div>NAME</div><div>CPU%</div><div>MEM</div></div>`);
    for (const p of (list || [])) {
        rows.push(`<div class="tr"><div>${p.pid}</div><div>${p.name}</div><div>${p.cpu.toFixed(1)}</div><div>${p.memMB}MB</div></div>`);
    }
    procs.innerHTML = rows.join("");
});

window.api.sys.onDisks(({ disks: d }) => {
    const rows = [];
    rows.push(`<div class="tr head"><div>FS</div><div>SIZE</div><div>USED</div><div>%</div></div>`);
    for (const x of (d || [])) {
        rows.push(`<div class="tr"><div>—</div><div>${x.fs}</div><div>${x.usedGB}/${x.sizeGB}GB</div><div>${x.usePct}%</div></div>`);
    }
    disks.innerHTML = rows.join("");
});

/* ---------- Knowledge (Wikipedia) ---------- */
function addChat(role, text) {
    const row = document.createElement("div");
    row.className = "chatRow";
    const tag = document.createElement("div");
    tag.className = "chatTag";
    tag.textContent = role.toUpperCase();
    const bubble = document.createElement("div");
    bubble.className = "chatBubble";
    bubble.textContent = text;
    row.appendChild(tag);
    row.appendChild(bubble);
    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;
}

const wikiCache = new Map();

async function wikiSearch(q) {
    const query = encodeURIComponent(q);
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${query}&limit=1&namespace=0&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Wiki search failed (${res.status})`);
    const data = await res.json();
    return { title: (data?.[1] || [])[0] || null, link: (data?.[3] || [])[0] || null };
}

async function wikiSummary(title) {
    const t = encodeURIComponent(title);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${t}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Wiki summary failed (${res.status})`);
    const data = await res.json();
    return { extract: (data?.extract || "").trim(), pageUrl: data?.content_urls?.desktop?.page || null };
}

function topic(text) {
    const t = text.trim();
    const pats = [/^what is (.+)$/i, /^who is (.+)$/i, /^tell me about (.+)$/i, /^define (.+)$/i, /^explain (.+)$/i];
    for (const re of pats) {
        const m = t.match(re);
        if (m?.[1]) return m[1].trim();
    }
    if (t.length <= 60 && !t.includes("?")) return t;
    return null;
}

async function answer(text) {
    const top = topic(text);
    if (!top) return "Ask: “what is …”, “who is …”, “tell me about …”.";
    const key = top.toLowerCase();
    if (wikiCache.has(key)) return wikiCache.get(key);

    const { title, link } = await wikiSearch(top);
    if (!title) return "No match. Try different words.";

    const { extract, pageUrl } = await wikiSummary(title);
    const out = (extract || `Found: ${title}`) + (pageUrl || link ? `\n\nMore: ${pageUrl || link}` : "");
    wikiCache.set(key, out);
    return out;
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    addChat("you", text);
    chatInput.value = "";

    addChat("bot", "…searching");
    const row = chatLog.lastElementChild;

    try {
        const out = await answer(text);
        row.querySelector(".chatBubble").textContent = out;
    } catch (err) {
        row.querySelector(".chatBubble").textContent =
            "Wikipedia unreachable. Use Browser tab.\n\n" + String(err?.message || err);
    }
});

/* ---------- Tools ---------- */
function safeCalc(expr) {
    const ok = /^[0-9+\-*/().\s%]+$/.test(expr);
    if (!ok) return "Blocked.";
    try {
        // eslint-disable-next-line no-new-func
        return String(Function(`"use strict"; return (${expr});`)());
    } catch {
        return "Error";
    }
}

calcRun.onclick = () => {
    const x = calcIn.value.trim();
    if (!x) return;
    calcOut.textContent = `Result: ${safeCalc(x)}`;
};

notes.value = localStorage.getItem("notes") || "";
notes.addEventListener("input", () => localStorage.setItem("notes", notes.value));

b64Enc.onclick = () => { b64Box.value = btoa(unescape(encodeURIComponent(b64Box.value))); };
b64Dec.onclick = () => {
    try { b64Box.value = decodeURIComponent(escape(atob(b64Box.value))); }
    catch { b64Box.value = "INVALID BASE64"; }
};

jsonFmt.onclick = () => {
    try { jsonBox.value = JSON.stringify(JSON.parse(jsonBox.value), null, 2); }
    catch { jsonBox.value = "INVALID JSON"; }
};

/* ---------- Resize handling ---------- */
window.addEventListener("resize", () => {
    // refit both panes
    if (activeA) {
        const s = sessions.get(activeA);
        s?.fit.fit();
        const d = s?.fit.proposeDimensions();
        if (d) window.api.term.resize(activeA, d.cols, d.rows);
    }
    if (split && activeB) {
        const s = sessions.get(activeB);
        s?.fit.fit();
        const d = s?.fit.proposeDimensions();
        if (d) window.api.term.resize(activeB, d.cols, d.rows);
    }
    if (activeView === "browser") window.api.browser.setBounds(browserBounds());
});

/* Start */
showView("terminal");
status.textContent = "online";