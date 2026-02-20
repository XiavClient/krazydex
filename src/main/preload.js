const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    terminal: {
        create: (cols, rows) => ipcRenderer.invoke("terminal:create", { cols, rows }),
        write: (data) => ipcRenderer.send("terminal:write", data),
        resize: (cols, rows) => ipcRenderer.send("terminal:resize", { cols, rows }),
        onData: (cb) => {
            const listener = (_evt, data) => cb(data);
            ipcRenderer.on("terminal:data", listener);
            return () => ipcRenderer.removeListener("terminal:data", listener);
        }
    },
    system: {
        onStats: (cb) => {
            const listener = (_evt, stats) => cb(stats);
            ipcRenderer.on("sys:stats", listener);
            return () => ipcRenderer.removeListener("sys:stats", listener);
        }
    }
});
