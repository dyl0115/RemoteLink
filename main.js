const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const serverRepository = require("./repository/serverRepository");
const sshClient = require("./client/sshClient");
const dockerClient = require("./client/dockerClient");
const terminalSession = require("./shared/terminalSession");
const { ERROR_CODES } = require("./shared/errorCodes");
const logger = require("./shared/logger");
const fileUtils = require("./shared/fileUtils");

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

  logger.info("App", "메인 윈도우 생성 완료");
}

// 앱 초기화
app.whenReady().then(() => {
  // 로거 초기화 (파일 로깅 활성화)
  logger.init({ level: "DEBUG", file: true });
  logger.info("App", "RemoteLink 시작");

  createWindow();
});

app.on("window-all-closed", () => {
  logger.info("App", "모든 윈도우 닫힘");

  // 모든 터미널 세션 종료
  terminalSession.closeAll();

  logger.close();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ========================================
// IPC 핸들러들
// ========================================

// 경로 유틸리티 (크로스 플랫폼)
ipcMain.handle("path:basename", (event, filePath) => {
  return path.basename(filePath);
});

ipcMain.handle("path:dirname", (event, filePath) => {
  return path.dirname(filePath);
});

ipcMain.handle("path:join", (event, ...paths) => {
  return path.join(...paths);
});

// 폴더 내 파일 목록 조회
ipcMain.handle("file:getFolderContents", (event, folderPath) => {
  logger.debug("IPC", "file:getFolderContents 호출", { folderPath });
  return fileUtils.getFolderContents(folderPath);
});

// 서버 목록 조회
ipcMain.handle("server:findAll", async () => {
  logger.debug("IPC", "server:findAll 호출");
  return serverRepository.findAll();
});

// 서버 조회
ipcMain.handle("server:findById", async (event, id) => {
  logger.debug("IPC", "server:findById 호출", { id });
  return serverRepository.findById(id);
});

// 서버 저장
ipcMain.handle("server:save", async (event, server) => {
  logger.info("IPC", "server:save 호출", { serverName: server.name });
  return serverRepository.save(server);
});

// 서버 삭제
ipcMain.handle("server:delete", async (event, id) => {
  logger.info("IPC", "server:delete 호출", { id });
  return serverRepository.delete(id);
});

// 원격 경로 저장
ipcMain.handle("server:saveRemotePath", async (event, serverId, remotePath) => {
  logger.info("IPC", "server:saveRemotePath 호출", { serverId, remotePath });
  return serverRepository.addRemotePath(serverId, remotePath);
});

// 원격 경로 삭제
ipcMain.handle(
  "server:deleteRemotePath",
  async (event, serverId, remotePath) => {
    logger.info("IPC", "server:deleteRemotePath 호출", {
      serverId,
      remotePath,
    });
    return serverRepository.removeRemotePath(serverId, remotePath);
  }
);

// 키 파일 선택 다이얼로그
ipcMain.handle("dialog:selectKeyFile", async () => {
  logger.debug("IPC", "dialog:selectKeyFile 호출");

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
  logger.debug("IPC", "dialog:selectFile 호출");

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "전송할 파일 선택",
    properties: ["openFile", "multiSelections"],
  });

  if (result.canceled) return null;
  return result.filePaths;
});

// 폴더 선택 다이얼로그
ipcMain.handle("dialog:selectFolder", async () => {
  logger.debug("IPC", "dialog:selectFolder 호출");

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
    logger.warn("SSH", "서버를 찾을 수 없음", { serverId });
    return {
      success: false,
      error: "서버를 찾을 수 없습니다",
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  logger.info("SSH", "연결 테스트 시작", { host: server.host });
  const result = await sshClient.testConnection(server);

  if (result.success) {
    logger.info("SSH", "연결 테스트 성공", { host: server.host });
  } else {
    logger.error("SSH", "연결 테스트 실패", {
      host: server.host,
      error: result.error,
    });
  }

  return result;
});

// 호스트에 디렉토리 생성
ipcMain.handle("ssh:makeDirectory", async (event, serverId, remoteDirPath) => {
  const server = serverRepository.findById(serverId);

  if (!server) {
    logger.warn("SSH", "서버를 찾을 수 없음", { serverId });
    return {
      success: false,
      error: "서버를 찾을 수 없습니다",
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  logger.debug("SSH", "디렉토리 생성", { remoteDirPath });
  return sshClient.makeDirectory(server, remoteDirPath);
});

// 호스트에게 파일 전송
ipcMain.handle(
  "ssh:sendFile",
  async (event, serverId, localPath, remotePath) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      logger.warn("SSH", "서버를 찾을 수 없음", { serverId });
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    logger.info("SSH", "파일 전송 시작", {
      host: server.host,
      localPath,
      remotePath,
    });
    const result = await sshClient.sendFile(server, localPath, remotePath);

    if (result.success) {
      logger.info("SSH", "파일 전송 성공", { remotePath });
    } else {
      logger.error("SSH", "파일 전송 실패", {
        remotePath,
        error: result.error,
      });
    }

    return result;
  }
);

// 호스트의 도커 컨테이너 조회
ipcMain.handle("docker:listContainer", async (event, serverId) => {
  const server = serverRepository.findById(serverId);

  if (!server) {
    logger.warn("Docker", "서버를 찾을 수 없음", { serverId });
    return {
      success: false,
      error: "서버를 찾을 수 없습니다",
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  logger.info("Docker", "컨테이너 목록 조회", { host: server.host });
  const result = await dockerClient.getContainers(server);

  if (result.success) {
    logger.info("Docker", "컨테이너 목록 조회 성공", {
      count: result.containers.length,
    });
  } else {
    logger.error("Docker", "컨테이너 목록 조회 실패", { error: result.error });
  }

  return result;
});

// 도커 컨테이너 연결 테스트
ipcMain.handle(
  "docker:testContainer",
  async (event, serverId, containerName) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      logger.warn("Docker", "서버를 찾을 수 없음", { serverId });
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    logger.info("Docker", "컨테이너 연결 테스트", {
      host: server.host,
      containerName,
    });
    const result = await dockerClient.testContainer(server, containerName);

    if (result.success) {
      logger.info("Docker", "컨테이너 연결 테스트 성공", { containerName });
    } else {
      logger.error("Docker", "컨테이너 연결 테스트 실패", {
        containerName,
        error: result.error,
      });
    }

    return result;
  }
);

// 컨테이너 내 디렉토리 생성
ipcMain.handle(
  "docker:makeDirectory",
  async (event, serverId, containerName, dirPath) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      logger.warn("Docker", "서버를 찾을 수 없음", { serverId });
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    logger.debug("Docker", "컨테이너 내 디렉토리 생성", {
      containerName,
      dirPath,
    });
    return dockerClient.makeDirectoryInContainer(
      server,
      containerName,
      dirPath
    );
  }
);

// 호스트의 도커 컨테이너에 파일 전송
ipcMain.handle(
  "docker:sendFile",
  async (event, serverId, localPath, containerName, containerPath) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      logger.warn("Docker", "서버를 찾을 수 없음", { serverId });
      return {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    logger.info("Docker", "컨테이너 파일 전송 시작", {
      host: server.host,
      containerName,
      localPath,
      containerPath,
    });

    const result = await dockerClient.sendFile(
      server,
      localPath,
      containerName,
      containerPath
    );

    if (result.success) {
      logger.info("Docker", "컨테이너 파일 전송 성공", {
        containerName,
        containerPath,
      });
    } else {
      logger.error("Docker", "컨테이너 파일 전송 실패", {
        containerName,
        error: result.error,
      });
    }

    return result;
  }
);

// ========================================
// 터미널 IPC 핸들러
// ========================================

// 터미널 세션 열기
ipcMain.on(
  "terminal:open",
  async (event, { serverId, type, containerName }) => {
    const server = serverRepository.findById(serverId);

    if (!server) {
      logger.warn("Terminal", "서버를 찾을 수 없음", { serverId });
      event.reply("terminal:opened", {
        success: false,
        error: "서버를 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      });
      return;
    }

    const targetName = type === "host" ? "호스트" : containerName;
    logger.info("Terminal", `터미널 세션 열기: ${targetName}`, {
      serverId,
      type,
    });

    // 데이터 수신 콜백
    const onData = (data) => {
      event.reply("terminal:data", { sessionId: result.sessionId, data });
    };

    // 세션 종료 콜백
    const onClose = (reason) => {
      event.reply("terminal:closed", { sessionId: result.sessionId, reason });
    };

    let result;
    if (type === "host") {
      result = await terminalSession.createHostSession(server, onData, onClose);
    } else {
      result = await terminalSession.createContainerSession(
        server,
        containerName,
        onData,
        onClose
      );
    }

    if (result.success) {
      logger.info("Terminal", `터미널 세션 생성 완료`, {
        sessionId: result.sessionId,
      });
    } else {
      logger.error("Terminal", `터미널 세션 생성 실패`, {
        error: result.error,
      });
    }

    event.reply("terminal:opened", result);
  }
);

// 터미널 데이터 쓰기 (키 입력)
ipcMain.on("terminal:write", (event, { sessionId, data }) => {
  const result = terminalSession.write(sessionId, data);

  if (!result.success) {
    logger.warn("Terminal", `데이터 쓰기 실패`, {
      sessionId,
      error: result.error,
    });
  }
});

// 터미널 크기 변경
ipcMain.on("terminal:resize", (event, { sessionId, cols, rows }) => {
  const result = terminalSession.resize(sessionId, cols, rows);

  if (!result.success) {
    logger.warn("Terminal", `크기 변경 실패`, {
      sessionId,
      error: result.error,
    });
  }
});

// 터미널 세션 닫기
ipcMain.on("terminal:close", (event, { sessionId }) => {
  logger.info("Terminal", `터미널 세션 닫기 요청`, { sessionId });
  const result = terminalSession.close(sessionId);

  if (!result.success) {
    logger.warn("Terminal", `세션 닫기 실패`, {
      sessionId,
      error: result.error,
    });
  }
});

// 활성 터미널 세션 목록 조회
ipcMain.handle("terminal:list", () => {
  return terminalSession.listSessions();
});
