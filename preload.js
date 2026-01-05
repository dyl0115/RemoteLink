const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 서버 관련
  server: {
    findAll: () => ipcRenderer.invoke("server:findAll"),
    findById: (id) => ipcRenderer.invoke("server:findById", id),
    save: (server) => ipcRenderer.invoke("server:save", server),
    delete: (id) => ipcRenderer.invoke("server:delete", id),
    saveRemotePath: (serverId, remotePath) =>
      ipcRenderer.invoke("server:saveRemotePath", serverId, remotePath),
    deleteRemotePath: (serverId, remotePath) =>
      ipcRenderer.invoke("server:deleteRemotePath", serverId, remotePath),
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

  // Docker 관련
  docker: {
    listContainer: (serverId) =>
      ipcRenderer.invoke("docker:listContainer", serverId),
    testContainer: (serverId, containerName) =>
      ipcRenderer.invoke("docker:testContainer", serverId, containerName),
    sendFile: (serverId, localPath, containerName, containerPath) =>
      ipcRenderer.invoke(
        "docker:sendFile",
        serverId,
        localPath,
        containerName,
        containerPath
      ),
  },
});
