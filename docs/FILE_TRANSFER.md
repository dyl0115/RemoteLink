# 파일 전송 모듈 구조

## 개요

`fileTransferView.js`의 파일 전송 로직을 단일 함수로 통합하여 중복을 제거했다.

## 핵심 함수

### startTransfer(targetType, containerName?)

파일 전송을 실행하는 통합 함수.

```javascript
/**
 * @param {'host' | 'container'} targetType - 전송 대상 타입
 * @param {string} [containerName] - 컨테이너명 (container일 때만)
 */
async function startTransfer(targetType, containerName = null) {
  // ...
  
  // 전송 대상에 따라 API 분기
  const result = targetType === "host"
    ? await window.api.ssh.sendFile(server.id, item.path, remoteFilePath)
    : await window.api.docker.sendFile(server.id, item.path, containerName, remoteFilePath);
}
```

### 호출 예시

```javascript
// 호스트로 전송
await startTransfer("host");

// 컨테이너로 전송
await startTransfer("container", "nginx-container");
```

## 헬퍼 함수

| 함수 | 역할 |
|------|------|
| `showTransferProgress()` | 전송 진행 UI 초기화 |
| `updateProgress(fileName, current, total)` | 진행률 업데이트 |
| `completeTransfer(success, fail, label)` | 전송 완료 처리 |
| `updateContainerStatus(type, message)` | 컨테이너 상태 표시 |
| `updateTransferResult(type, message)` | 전송 결과 표시 |

## 새 전송 대상 추가 시

1. `startTransfer()` 함수에 분기 추가:

```javascript
const result = targetType === "host"
  ? await window.api.ssh.sendFile(...)
  : targetType === "container"
    ? await window.api.docker.sendFile(...)
    : await window.api.newTarget.sendFile(...);  // 새 대상
```

2. 호출부에서 새 타입으로 호출:

```javascript
await startTransfer("newTarget", targetId);
```
