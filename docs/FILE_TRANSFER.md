# 파일 전송 모듈 구조

## 개요

`fileTransferView.js`의 파일 전송 로직을 단일 함수로 통합하여 중복을 제거했다.
폴더 전송도 지원한다.

## 핵심 함수

### startTransfer(targetType, containerName?)

파일 전송을 실행하는 통합 함수.

```javascript
/**
 * @param {'host' | 'container'} targetType - 전송 대상 타입
 * @param {string} [containerName] - 컨테이너명 (container일 때만)
 */
async function startTransfer(targetType, containerName = null) {
  // 1단계: 필요한 디렉토리 생성
  // 2단계: 파일 전송
}
```

### 호출 예시

```javascript
// 호스트로 전송
await startTransfer("host");

// 컨테이너로 전송
await startTransfer("container", "nginx-container");
```

## 폴더 전송 흐름

```
1. 폴더 선택
   └── window.api.file.getFolderContents(folderPath)
       └── 내부 파일 목록 재귀 수집

2. 큐에 파일들 추가
   └── 각 파일의 상대 경로 포함 (폴더구조 유지)

3. 전송 시작
   ├── 필요한 디렉토리 먼저 생성 (mkdir -p)
   └── 파일 개별 전송
```

## 큐 항목 구조

```javascript
{
  absolutePath: "C:\\Users\\...\\project\\src\\index.js",  // 로컬 전체 경로
  relativePath: "project/src/index.js",                    // 원격 상대 경로 (폴더명 포함)
  displayName: "project/src/index.js",                     // UI 표시용
  isFolder: false
}
```

## 디렉토리 생성

### SSH (호스트)
```javascript
await window.api.ssh.makeDirectory(serverId, "/home/ubuntu/project/src");
// → ssh: mkdir -p "/home/ubuntu/project/src"
```

### Docker (컨테이너)
```javascript
await window.api.docker.makeDirectory(serverId, "nginx", "/app/src");
// → ssh: docker exec nginx mkdir -p "/app/src"
```

## 헬퍼 함수

| 함수 | 역할 |
|------|------|
| `addItemToQueue(path)` | 파일/폴더를 큐에 추가 (폴더면 내부 파일 수집) |
| `extractDirectories(basePath)` | 큐에서 생성 필요한 디렉토리 추출 |
| `showTransferProgress()` | 전송 진행 UI 초기화 |
| `updateProgress(fileName, current, total)` | 진행률 업데이트 |
| `completeTransfer(success, fail, label)` | 전송 완료 처리 |

## 새 전송 대상 추가 시

1. `startTransfer()` 함수에 분기 추가
2. `makeDirectory` API 추가
3. `sendFile` API 추가
