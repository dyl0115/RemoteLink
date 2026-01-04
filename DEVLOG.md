# RemoteLink 개발 일지

## 프로젝트 소개

원격 서버 관리 및 파일 전송 도구 (Electron + 바닐라 JS)

---

## 1단계: 프로젝트 초기 세팅

### Electron 기본 구조 이해

```
┌─────────────────────────────────────────────────────────┐
│ renderer (브라우저 환경)                                 │
│ → 웹페이지, DOM 조작                                    │
└─────────────────────┬───────────────────────────────────┘
                      │ window.api.함수() 호출
                      ▼
┌─────────────────────────────────────────────────────────┐
│ preload.js (다리 역할)                                   │
│ → renderer가 쓸 수 있는 함수 목록 정의 (보안 레이어)      │
└─────────────────────┬───────────────────────────────────┘
                      │ ipcRenderer.invoke()
                      ▼
┌─────────────────────────────────────────────────────────┐
│ main.js (Node.js 환경)                                   │
│ → 파일, SSH, 시스템 접근 가능                            │
└─────────────────────────────────────────────────────────┘
```

### 앱 실행 순서 (초기화)

```
1. main.js 실행 (Electron 앱 시작)
2. createWindow()에서 BrowserWindow 생성
3. preload.js 실행 (window.api 준비)
4. index.html 로드
5. renderer/index.js 실행
```

### 이벤트 발생 시 흐름 (버튼 클릭 등)

```
renderer/ → preload.js → main.js → repository/client
    ↑                                      │
    └──────────── 결과 반환 ◄──────────────┘
```

---

## 2단계: 프로젝트 구조

```
remoteLink/
├── main.js                   # IPC 핸들러 (라우터 역할)
├── preload.js                # API 브릿지 (보안 레이어)
├── index.html                # 메인 UI
├── styles.css
├── package.json
│
├── renderer/
│   ├── index.js              # 진입점 + 상태 관리
│   ├── serverListView.js     # 서버 목록 UI
│   ├── serverFormView.js     # 추가/수정 모달
│   ├── serverDetailView.js   # 상세 정보 + 연결 테스트
│   └── fileTransferView.js   # 파일 전송 UI
│
├── repository/
│   └── serverRepository.js   # 서버 CRUD (JSON 파일)
│
└── client/
    └── sshClient.js          # SSH 연결 + 파일 전송
```

### Spring 비유

| Electron    | Spring                             |
| ----------- | ---------------------------------- |
| renderer/   | Controller (요청 보내는 쪽)        |
| preload.js  | API 인터페이스 정의                |
| main.js     | Controller (요청 받는 쪽) + 라우터 |
| repository/ | Repository                         |
| client/     | 외부 연동 (RestTemplate 등)        |

---

## 3단계: 서버 CRUD 구현

### 3-1. Repository (serverRepository.js)

- `findAll()` - 전체 서버 목록 조회
- `findById(id)` - ID로 서버 조회
- `save(server)` - 서버 저장 (추가/수정)
- `delete(id)` - 서버 삭제
- 데이터 저장 위치: `AppData/Roaming/remote-link/data/servers.json`

### 3-2. IPC 핸들러 등록 (main.js)

```javascript
ipcMain.handle("server:findAll", async () => {
  return serverRepository.findAll();
});

ipcMain.handle("server:save", async (event, server) => {
  return serverRepository.save(server);
});
```

### 3-3. API 노출 (preload.js)

```javascript
contextBridge.exposeInMainWorld("api", {
  server: {
    findAll: () => ipcRenderer.invoke("server:findAll"),
    save: (server) => ipcRenderer.invoke("server:save", server),
  },
});
```

### 3-4. UI에서 호출 (renderer/)

```javascript
const servers = await window.api.server.findAll();
await window.api.server.save(serverData);
```

---

## 4단계: SSH 연결 테스트 구현

### 4-1. sshClient.js

```javascript
const { Client } = require("ssh2");

async function testConnection(server) {
  return new Promise((resolve) => {
    const conn = new Client();

    conn.on("ready", () => {
      conn.end();
      resolve({ success: true });
    });

    conn.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    conn.connect({
      host: server.host,
      port: server.port,
      username: server.username,
      privateKey: fs.readFileSync(server.keyFile),
    });
  });
}
```

### 4-2. IPC 핸들러 (main.js)

```javascript
ipcMain.handle("ssh:testConnection", async (event, serverId) => {
  const server = serverRepository.findById(serverId);
  return sshClient.testConnection(server);
});
```

### 4-3. preload.js

```javascript
ssh: {
  testConnection: (serverId) => ipcRenderer.invoke("ssh:testConnection", serverId),
},
```

### 4-4. UI (serverDetailView.js)

```javascript
btnTestConnection.addEventListener("click", async () => {
  connectionStatus.textContent = "연결 중...";
  connectionStatus.className = "connection-status loading";

  const result = await window.api.ssh.testConnection(server.id);

  if (result.success) {
    connectionStatus.textContent = "✅ 연결 성공!";
    connectionStatus.className = "connection-status success";
  } else {
    connectionStatus.textContent = "❌ 연결 실패: " + result.error;
    connectionStatus.className = "connection-status error";
  }
});
```

---

## 5단계: 파일 전송 구현

### 5-1. sshClient.js - sendFile 추가

```javascript
async function sendFile(server, localPath, remotePath) {
  return new Promise((resolve) => {
    const conn = new Client();

    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          resolve({ success: false, error: err.message });
          return;
        }

        sftp.fastPut(localPath, remotePath, (err) => {
          conn.end();
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    });

    conn.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    conn.connect({
      host: server.host,
      port: server.port,
      username: server.username,
      privateKey: fs.readFileSync(server.keyFile),
    });
  });
}
```

### 5-2. IPC 핸들러 (main.js)

```javascript
// 파일 선택 다이얼로그 (다중 선택)
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

// 파일 전송
ipcMain.handle(
  "ssh:sendFile",
  async (event, serverId, localPath, remotePath) => {
    const server = serverRepository.findById(serverId);
    return sshClient.sendFile(server, localPath, remotePath);
  }
);
```

### 5-3. preload.js

```javascript
dialog: {
  selectKeyFile: () => ipcRenderer.invoke("dialog:selectKeyFile"),
  selectFile: () => ipcRenderer.invoke("dialog:selectFile"),
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
},

ssh: {
  testConnection: (serverId) => ipcRenderer.invoke("ssh:testConnection", serverId),
  sendFile: (serverId, localPath, remotePath) =>
    ipcRenderer.invoke("ssh:sendFile", serverId, localPath, remotePath),
},
```

### 5-4. fileTransferView.js 주요 기능

- **드래그앤드롭**: 파일을 드롭존에 드래그해서 대기 목록에 추가
- **파일 선택 버튼**: 다중 파일 선택 가능
- **폴더 선택 버튼**: 폴더 선택
- **대기 목록**: 전송할 파일 목록 표시 + 개별 삭제
- **전송 시작**: 순차적으로 파일 전송 + 진행률 표시

---

## 핵심 개념 정리

### IPC (Inter-Process Communication)

- renderer와 main은 **서로 다른 프로세스**
- 직접 함수 호출 불가 → **메시지로 통신**
- `ipcRenderer.invoke('채널명')` → `ipcMain.handle('채널명')`
- 채널명은 그냥 문자열 (서로 맞추기만 하면 됨)

### preload.js가 필요한 이유

- 보안상 renderer에서 Node.js 직접 접근 차단
- preload.js에서 **허용된 API만** 노출
- 우리 앱은 로컬 전용이라 사실 위험 없지만, Electron 권장사항

### Promise와 async/await

```javascript
// ssh2는 콜백 기반이라 Promise로 감싸서 사용
async function testConnection(server) {
  return new Promise((resolve) => {
    // 성공 시
    resolve({ success: true });
    // 실패 시
    resolve({ success: false, error: "..." });
  });
}

// 호출하는 쪽
const result = await testConnection(server);
```

### SFTP 파일 전송 흐름

```
1. conn.connect()  → SSH 연결
2. conn.sftp()     → SFTP 세션 열기
3. sftp.fastPut()  → 파일 전송
4. conn.end()      → 연결 종료
```

---

## 트러블슈팅

### Permission Denied 에러

- **원인**: 원격 경로에 쓰기 권한 없음
- **해결**:
  - 원격 경로가 존재하는지 확인 (`mkdir -p /home/ubuntu/app`)
  - 해당 폴더 소유자가 로그인 유저인지 확인
  - 테스트 시 `/tmp` 같은 경로로 먼저 시도

---

## 완료된 기능

- ✅ 서버 CRUD (추가/수정/삭제)
- ✅ SSH 연결 테스트
- ✅ 파일 전송 (드래그앤드롭 + 다중 선택)
- ✅ 전송 진행률 표시

## 남은 기능

- ⬜ 폴더 전송 (재귀적 업로드)
- ⬜ 도커 컨테이너 관리 + 전송
- ⬜ 실시간 터미널
