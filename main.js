const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const serverRepository = require("./repository/serverRepository");
const sshClient = require("./client/sshClient");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ========================================
// IPC 핸들러들
// ========================================

// 서버 목록 조회
ipcMain.handle("server:findAll", async () => {
  return serverRepository.findAll();
});

// 서버 조회
ipcMain.handle("server:findById", async (event, id) => {
  return serverRepository.findById(id);
});

// 서버 저장
ipcMain.handle("server:save", async (event, server) => {
  return serverRepository.save(server);
});

// 서버 삭제
ipcMain.handle("server:delete", async (event, id) => {
  return serverRepository.delete(id);
});

// 키 파일 선택 다이얼로그
ipcMain.handle("dialog:selectKeyFile", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "SSH 키 파일 선택",
    properties: ["openFile"],
    filters: [
      { name: "All Files", extensions: ["*"] },
      { name: "PEM Files", extensions: ["pem"] },
      { name: "KEY Files", extensions: ["key"] },
      { name: "PUB Files", extensions: ["pub"] },
    ],
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

// 파일 선택 다이얼로그
ipcMain.handle("dialog:selectFile", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "전송할 파일 선택",
    properties: ["openFile", "multiSelections"],
  });

  if (result.canceled) return null;
  return result.filePaths;
});

// 폴더 선택 다이얼로그
ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "전송할 폴더 선택",
    properties: ["openDirectory"],
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

// SSH 커넥션 테스트
ipcMain.handle("ssh:testConnection", async (event, serverId) => {
  const server = serverRepository.findById(serverId);
  return sshClient.testConnection(server);
});

// 파일 전송 (검토 하기)
ipcMain.handle(
  "ssh:sendFile",
  async (event, serverId, localPath, remotePath) => {
    const server = serverRepository.findById(serverId);
    return sshClient.sendFile(server, localPath, remotePath);
  }
);
