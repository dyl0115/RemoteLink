# Docker 컨테이너 연결 테스트 기능

## 개요

호스트뿐만 아니라 Docker 컨테이너에 대해서도 연결 테스트를 수행할 수 있다.

## 백엔드

### dockerClient.testContainer(server, containerName)

컨테이너가 실행 중인지 확인한다.

```javascript
// client/dockerClient.js
async function testContainer(server, containerName) {
  return withConnection(server, async (conn) => {
    const command = `docker inspect ${containerName} --format '{{.State.Running}}'`;
    const result = await execCommand(conn, command);
    
    if (!result.success) {
      return { success: false, error: "컨테이너를 찾을 수 없습니다" };
    }
    
    const isRunning = result.stdout.trim() === "true";
    return isRunning 
      ? { success: true, running: true }
      : { success: false, error: "컨테이너가 실행 중이 아닙니다" };
  });
}
```

### IPC 핸들러

```javascript
// main.js
ipcMain.handle("docker:testContainer", async (event, serverId, containerName) => {
  const server = serverRepository.findById(serverId);
  if (!server) return { success: false, error: "서버를 찾을 수 없습니다" };
  return dockerClient.testContainer(server, containerName);
});
```

### Preload API

```javascript
// preload.js
docker: {
  testContainer: (serverId, containerName) =>
    ipcRenderer.invoke("docker:testContainer", serverId, containerName),
}
```

## UI 변경

### 연결 대상 선택

- `connection-target` 셀렉트박스로 호스트/컨테이너 선택
- 🔄 버튼으로 컨테이너 목록 새로고침
- 🪢 연결 테스트 버튼 클릭 시 선택된 대상에 연결 테스트

### 파일 전송 대상

- 연결 대상 셀렉트박스와 파일 전송 대상이 연동됨
- `getSelectedTarget()` 함수로 현재 선택된 대상 가져옴

## 원격 경로 저장 기능

### 데이터 구조

```javascript
// servers.json
{
  "id": "srv_xxx",
  "name": "서버명",
  "remotePaths": ["/home/ubuntu/app", "/var/www/html"]  // 저장된 경로 배열
}
```

### Repository 메서드

```javascript
// serverRepository.js
addRemotePath(serverId, remotePath)    // 경로 추가
removeRemotePath(serverId, remotePath) // 경로 삭제
```

### UI

- 💾 버튼: 현재 입력된 경로 저장
- ⚙️ 버튼: 저장된 경로 관리 모달 열기
- `<datalist>`로 저장된 경로 자동완성 제공
