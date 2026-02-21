const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    term: {
        new: (cols, rows) => ipcRenderer.invoke("term:new", { cols, rows }),
        list: () => ipcRenderer.invoke("term:list"),
        kill: (id) => ipcRenderer.invoke("term:kill", { id }),
        write: (id, data) => ipcRenderer.send("term:write", { id, data }),
        resize: (id, cols, rows) => ipcRenderer.send("term:resize", { id, cols, rows }),
        onData: (cb) => {
            const fn = (_e, payload) => cb(payload);
            ipcRenderer.on("term:data", fn);
            return () => ipcRenderer.removeListener("term:data", fn);
        },
        onClosed: (cb) => {
            const fn = (_e, payload) => cb(payload);
            ipcRenderer.on("term:closed", fn);
            return () => ipcRenderer.removeListener("term:closed", fn);
        }
    },

    browser: {
        show: (bounds, url) => ipcRenderer.invoke("browser:show", { bounds, url }),
        hide: () => ipcRenderer.invoke("browser:hide"),
        setBounds: (bounds) => ipcRenderer.invoke("browser:setBounds", bounds),
        navigate: (url) => ipcRenderer.invoke("browser:navigate", url),
        back: () => ipcRenderer.invoke("browser:back"),
        fwd: () => ipcRenderer.invoke("browser:fwd"),
        reload: () => ipcRenderer.invoke("browser:reload"),
        onState: (cb) => {
            const fn = (_e, payload) => cb(payload);
            ipcRenderer.on("browser:state", fn);
            return () => ipcRenderer.removeListener("browser:state", fn);
        },
        onRequestBounds: (cb) => {
            const fn = () => cb();
            ipcRenderer.on("browser:requestBounds", fn);
            return () => ipcRenderer.removeListener("browser:requestBounds", fn);
        }
    },

    sys: {
        onHw: (cb) => {
            const fn = (_e, p) => cb(p);
            ipcRenderer.on("sys:hw", fn);
            return () => ipcRenderer.removeListener("sys:hw", fn);
        },
        onStats: (cb) => {
            const fn = (_e, p) => cb(p);
            ipcRenderer.on("sys:stats", fn);
            return () => ipcRenderer.removeListener("sys:stats", fn);
        },
        onProcs: (cb) => {
            const fn = (_e, p) => cb(p);
            ipcRenderer.on("sys:procs", fn);
            return () => ipcRenderer.removeListener("sys:procs", fn);
        },
        onDisks: (cb) => {
            const fn = (_e, p) => cb(p);
            ipcRenderer.on("sys:disks", fn);
            return () => ipcRenderer.removeListener("sys:disks", fn);
        }
    },

    win: {
        toggleFullscreen: () => ipcRenderer.invoke("win:toggleFullscreen"),
        toggleAOT: () => ipcRenderer.invoke("win:toggleAOT")
    }
});