const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 서버 관련
  server: {
    findAll: () => ipcRenderer.invoke("server:findAll"),
    findById: (id) => ipcRenderer.invoke("server:findById", id),
    save: (server) => ipcRenderer.invoke("server:save", server),
    delete: (id) => ipcRenderer.invoke("server:delete", id),
  },

  // 다이얼로그
  dialog: {
    selectKeyFile: () => ipcRenderer.invoke("dialog:selectKeyFile"),
    selectFile: () => ipcRenderer.invoke("dialog:selectFile"),
    selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  },

  // SSH 연결 관련
  ssh: {
    testConnection: (serverId) =>
      ipcRenderer.invoke("ssh:testConnection", serverId),
    sendFile: (serverId, localPath, remotePath) =>
      ipcRenderer.invoke("ssh:sendFile", serverId, localPath, remotePath),
  },
});
