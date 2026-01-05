# 에러 처리 컨벤션

## 결과 객체 표준

모든 비동기 작업은 다음 형태로 반환한다.

```javascript
// 성공
{ success: true, data?: any }

// 실패
{ success: false, error: string, code?: string }
```

## 에러 코드

`shared/errorCodes.js`에 정의된 상수를 사용한다.

```javascript
const ERROR_CODES = {
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
  CONNECTION_REFUSED: "CONNECTION_REFUSED",
  SSH_AUTH_FAILED: "SSH_AUTH_FAILED",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  DOCKER_NOT_RUNNING: "DOCKER_NOT_RUNNING",
  CONTAINER_NOT_FOUND: "CONTAINER_NOT_FOUND",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  NOT_FOUND: "NOT_FOUND",
};
```

## 계층별 규칙

### 1. Client 계층 (sshClient.js, dockerClient.js)

- throw 하지 않고 `{ success, error }` 반환
- 콜백 내 에러 처리 후 **반드시 return**
- 타임아웃 필수 설정

```javascript
conn.sftp((err, sftp) => {
  if (err) {
    conn.end();
    resolve({ success: false, error: err.message });
    return; // ✅ 필수
  }
  // 성공 로직
});
```

### 2. IPC 핸들러 (main.js)

- client 결과를 그대로 전달
- 파라미터 검증 후 에러 반환

```javascript
ipcMain.handle("ssh:testConnection", async (event, serverId) => {
  const server = serverRepository.findById(serverId);
  if (!server) {
    return {
      success: false,
      error: "서버를 찾을 수 없습니다",
      code: "NOT_FOUND",
    };
  }
  return sshClient.testConnection(server);
});
```

### 3. Renderer 계층

- API 호출 후 **항상** `result.success` 체크
- alert 대신 UI 상태 업데이트
- 개발 로그는 console.error

```javascript
const result = await window.api.ssh.testConnection(server.id);

if (result.success) {
  updateStatus("success", "✅ 연결 성공!");
} else {
  updateStatus("error", `❌ ${result.error}`);
  console.error(`[${result.code}]`, result.error);
}
```

### 4. Repository 계층

- 조회 실패 시 `null` 반환
- 저장/삭제는 `{ success, error }` 형태

## 체크리스트

- [ ] 모든 콜백 에러 처리 후 `return` 있는가?
- [ ] `result.success` 체크하는가?
- [ ] 타임아웃 설정되어 있는가?
- [ ] `conn.end()` 모든 분기에서 호출되는가?
