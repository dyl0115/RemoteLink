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

  // 파일 유틸리티
  file: {
    getFolderContents: (folderPath) =>
      ipcRenderer.invoke("file:getFolderContents", folderPath),
  },

  // SSH 연결 관련
  ssh: {
    testConnection: (serverId) =>
      ipcRenderer.invoke("ssh:testConnection", serverId),
    makeDirectory: (serverId, remoteDirPath) =>
      ipcRenderer.invoke("ssh:makeDirectory", serverId, remoteDirPath),
    sendFile: (serverId, localPath, remotePath) =>
      ipcRenderer.invoke("ssh:sendFile", serverId, localPath, remotePath),
  },

  // Docker 관련
  docker: {
    listContainer: (serverId) =>
      ipcRenderer.invoke("docker:listContainer", serverId),
    testContainer: (serverId, containerName) =>
      ipcRenderer.invoke("docker:testContainer", serverId, containerName),
    makeDirectory: (serverId, containerName, dirPath) =>
      ipcRenderer.invoke("docker:makeDirectory", serverId, containerName, dirPath),
    sendFile: (serverId, localPath, containerName, containerPath) =>
      ipcRenderer.invoke(
        "docker:sendFile",
        serverId,
        localPath,
        containerName,
        containerPath
      ),
  },

  // 경로 유틸리티 (크로스 플랫폼) - Main 프로세스에서 처리
  path: {
    basename: (filePath) => ipcRenderer.invoke("path:basename", filePath),
    dirname: (filePath) => ipcRenderer.invoke("path:dirname", filePath),
    join: (...paths) => ipcRenderer.invoke("path:join", ...paths),
  },
});
