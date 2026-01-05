const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const serverRepository = require("./repository/serverRepository");
const sshClient = require("./client/sshClient");
const dockerClient = require("./client/dockerClient");
const { ERROR_CODES } = require("./shared/errorCodes");

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

// 원격 경로 저장
ipcMain.handle("server:saveRemotePath", async (event, serverId, remotePath) => {
  return serverRepository.addRemotePath(serverId, remotePath);
});

// 원격 경로 삭제
ipcMain.handle(
  "server:deleteRemotePath",
  async (event, serverId, remotePath) => {
    return serverRepository.removeRemotePath(serverId, remotePath);
  }
);

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

  if (!server) {
    return {
      success: false,
      error: "서버를 찾을 수 없습니다",
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  return sshClient.testConnection(server);
});

// 호스트에게 파일 전송
ipcMain.handle(
  "ssh:sendFile",
  async (event, serverId, localPath, remotePath) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    return sshClient.sendFile(server, localPath, remotePath);
  }
);

// 호스트의 도커 컨테이너 조회
ipcMain.handle("docker:listContainer", async (event, serverId) => {
  const server = serverRepository.findById(serverId);

  if (!server) {
    return {
      success: false,
      error: "서버를 찾을 수 없습니다",
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  return dockerClient.getContainers(server);
});

// 도커 컨테이너 연결 테스트
ipcMain.handle(
  "docker:testContainer",
  async (event, serverId, containerName) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    return dockerClient.testContainer(server, containerName);
  }
);

// 호스트의 도커 컨테이너에 파일 전송
ipcMain.handle(
  "docker:sendFile",
  async (event, serverId, localPath, containerName, containerPath) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    console.log(
      "main.js -> docker:sendFile:  serverId=" +
        serverId +
        " localPath=" +
        localPath +
        " containerName=" +
        containerName +
        " containerPath=" +
        containerPath
    );

    return dockerClient.sendFile(
      server,
      localPath,
      containerName,
      containerPath
    );
  }
);
