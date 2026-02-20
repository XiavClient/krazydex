import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

const termEl = document.getElementById("terminal");
const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");

const cpuBar = document.getElementById("cpuBar");
const memBar = document.getElementById("memBar");

const term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontSize: 14,
    lineHeight: 1.15,
    theme: {
        background: "#05070a",
        foreground: "#cfe7ff",
        cursor: "#6fe7ff",
        selection: "rgba(111,231,255,0.25)",
        black: "#0a0f14",
        brightBlack: "#22313f",
        green: "#6dff95",
        brightGreen: "#b7ffc9",
        cyan: "#6fe7ff",
        brightCyan: "#aef2ff"
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
    statusEl.textContent = "online";
})();

term.onData((data) => window.api.terminal.write(data));
window.api.terminal.onData((data) => term.write(data));

window.addEventListener("resize", () => {
    fit.fit();
    const { cols, rows } = getDims();
    window.api.terminal.resize(cols, rows);
});

window.api.system.onStats((s) => {
    statsEl.innerHTML =
        `<span>CPU: ${s.cpu}%</span>` +
        `<span>MEM: ${s.memUsedMB}/${s.memTotalMB} MB</span>` +
        `<span>NET: ↓${s.rxKBs} KB/s ↑${s.txKBs} KB/s</span>`;

    cpuBar.style.width = `${Math.max(0, Math.min(100, s.cpu))}%`;

    const memPct = Math.round((s.memUsedMB / Math.max(1, s.memTotalMB)) * 100);
    memBar.style.width = `${Math.max(0, Math.min(100, memPct))}%`;
});

term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "l") {
        term.clear();
    }
    return true;
});
