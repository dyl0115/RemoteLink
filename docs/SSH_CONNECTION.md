# SSH 연결 모듈 구조

## 개요

SSH 연결 로직의 중복을 제거하기 위해 `shared/sshConnection.js` 공통 모듈을 사용한다.

## 파일 구조

```
shared/
  └── sshConnection.js   # SSH 연결 공통 모듈
client/
  ├── sshClient.js       # SSH 작업 (연결 테스트, 파일 전송)
  └── dockerClient.js    # Docker 작업 (컨테이너 조회, 파일 복사)
```

## 핵심 함수

### withConnection(server, onReady)

SSH 연결을 생성하고 작업을 수행하는 래퍼 함수.

```javascript
const { withConnection } = require("../shared/sshConnection");

// 사용 예시
async function testConnection(server) {
  return withConnection(server, () => {
    return { success: true };
  });
}
```

**특징:**
- 타임아웃 자동 처리 (10초)
- 에러 핸들링 자동 처리
- 연결 종료 자동 처리 (`conn.end()`)
- 에러 코드 자동 부여

### getSftp(conn)

SFTP 세션을 생성하는 헬퍼.

```javascript
const { withConnection, getSftp } = require("../shared/sshConnection");

async function sendFile(server, localPath, remotePath) {
  return withConnection(server, async (conn) => {
    const sftpResult = await getSftp(conn);
    if (!sftpResult.success) return sftpResult;

    return new Promise((resolve) => {
      sftpResult.sftp.fastPut(localPath, remotePath, (err) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    });
  });
}
```

### execCommand(conn, command)

SSH 명령어를 실행하는 헬퍼.

```javascript
const { withConnection, execCommand } = require("../shared/sshConnection");

async function getContainers(server) {
  return withConnection(server, async (conn) => {
    const result = await execCommand(conn, 'docker ps --format "{{.ID}}"');
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    return { success: true, data: result.stdout };
  });
}
```

**반환값:**
- `success`: 성공 여부 (exitCode === 0)
- `stdout`: 표준 출력
- `stderr`: 표준 에러
- `exitCode`: 종료 코드

## 규칙

1. **직접 SSH 연결 금지**: `new Client()` 직접 사용하지 않고 `withConnection` 사용
2. **콜백 내 return 필수**: 에러 처리 후 반드시 return
3. **결과 형식 통일**: 항상 `{ success, error?, code? }` 형태로 반환

## 타임아웃 설정

`shared/sshConnection.js`의 `CONNECTION_TIMEOUT_MS` 상수로 관리 (기본 10초).

```javascript
const CONNECTION_TIMEOUT_MS = 10000;
```
