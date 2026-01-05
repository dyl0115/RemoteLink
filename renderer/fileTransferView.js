// ========================================
// renderer/fileTransferView.js - 파일 전송 UI
// ========================================

import { getSelectedServer } from "./index.js";
import { getSelectedTarget } from "./serverDetailView.js";

// DOM 요소들
const remotePath = document.getElementById("remote-path");
const remotePathList = document.getElementById("remote-path-list");
const btnSavePath = document.getElementById("btn-save-path");
const btnManagePaths = document.getElementById("btn-manage-paths");
const dropZone = document.getElementById("drop-zone");
const btnSelectFile = document.getElementById("btn-select-file");
const btnSelectFolder = document.getElementById("btn-select-folder");
const transferQueue = document.getElementById("transfer-queue");
const queueList = document.getElementById("queue-list");
const btnClearQueue = document.getElementById("btn-clear-queue");
const btnStartTransfer = document.getElementById("btn-start-transfer");
const transferStatus = document.getElementById("transfer-status");
const transferFilename = document.getElementById("transfer-filename");
const transferPercent = document.getElementById("transfer-percent");
const progressFill = document.getElementById("progress-fill");
const transferResult = document.getElementById("transfer-result");

// 경로 관리 모달
const pathsModal = document.getElementById("paths-modal");
const btnClosePathsModal = document.getElementById("btn-close-paths-modal");
const savedPathsList = document.getElementById("saved-paths-list");
const noPathsMessage = document.getElementById("no-paths-message");

// 전송 대기 목록
// { absolutePath, relativePath, displayName, isFolder }
let fileQueue = [];

// ========================================
// 헬퍼 함수들
// ========================================

/**
 * 경로에서 파일명 추출 (크로스 플랫폼, 비동기)
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function getFileName(filePath) {
  return await window.api.path.basename(filePath);
}

/**
 * 전송 결과 업데이트
 * @param {'success' | 'error'} type
 * @param {string} message
 */
function updateTransferResult(type, message) {
  transferResult.textContent = message;
  transferResult.className = `transfer-result ${type}`;
}

/**
 * 전송 진행 UI 초기화
 */
function showTransferProgress() {
  transferStatus.classList.remove("hidden");
  transferResult.textContent = "";
  transferResult.className = "transfer-result";
  btnStartTransfer.disabled = true;
}

/**
 * 진행률 업데이트
 * @param {string} fileName - 현재 파일명
 * @param {number} current - 현재 인덱스
 * @param {number} total - 전체 개수
 */
function updateProgress(fileName, current, total) {
  transferFilename.textContent = fileName;
  const percent = Math.round((current / total) * 100);
  transferPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
}

/**
 * 전송 완료 처리
 * @param {number} successCount
 * @param {number} failCount
 * @param {string} targetLabel - 추가 라벨 (예: ' 컨테이너로')
 */
function completeTransfer(successCount, failCount, targetLabel = "") {
  transferPercent.textContent = "100%";
  progressFill.style.width = "100%";
  transferFilename.textContent = "완료";

  if (failCount === 0) {
    updateTransferResult(
      "success",
      `✅ ${successCount}개 파일${targetLabel} 전송 성공!`
    );
  } else {
    updateTransferResult(
      "error",
      `⚠️ 성공: ${successCount}, 실패: ${failCount}`
    );
  }

  btnStartTransfer.disabled = false;
  clearQueue();
}

// ========================================
// 원격 경로 관리
// ========================================

/**
 * 저장된 원격 경로 목록 로드
 */
function loadRemotePaths() {
  const server = getSelectedServer();
  if (!server) return;

  // datalist 업데이트
  remotePathList.innerHTML = "";

  const paths = server.remotePaths || [];
  paths.forEach((path) => {
    const option = document.createElement("option");
    option.value = path;
    remotePathList.appendChild(option);
  });

  // 기본 경로 설정
  if (server.remotePath) {
    remotePath.value = server.remotePath;
  }
}

/**
 * 현재 경로 저장
 */
async function saveCurrentPath() {
  const server = getSelectedServer();
  if (!server) return;

  const path = remotePath.value.trim();
  if (!path) {
    alert("저장할 경로를 입력해주세요.");
    return;
  }

  const result = await window.api.server.saveRemotePath(server.id, path);

  if (result.success) {
    // 서버 객체 업데이트
    server.remotePaths = result.data;
    loadRemotePaths();
    alert("경로가 저장되었습니다.");
  } else {
    alert("저장 실패: " + result.error);
  }
}

/**
 * 경로 관리 모달 열기
 */
function openPathsModal() {
  const server = getSelectedServer();
  if (!server) return;

  renderSavedPaths();
  pathsModal.classList.remove("hidden");
}

/**
 * 경로 관리 모달 닫기
 */
function closePathsModal() {
  pathsModal.classList.add("hidden");
}

/**
 * 저장된 경로 목록 렌더링
 */
function renderSavedPaths() {
  const server = getSelectedServer();
  if (!server) return;

  const paths = server.remotePaths || [];

  if (paths.length === 0) {
    savedPathsList.classList.add("hidden");
    noPathsMessage.classList.remove("hidden");
    return;
  }

  savedPathsList.classList.remove("hidden");
  noPathsMessage.classList.add("hidden");

  savedPathsList.innerHTML = "";
  paths.forEach((path) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${path}</span>
      <button class="btn-remove" data-path="${path}">&times;</button>
    `;
    savedPathsList.appendChild(li);
  });

  // 삭제 버튼 이벤트
  savedPathsList.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const pathToDelete = e.target.dataset.path;
      const result = await window.api.server.deleteRemotePath(
        server.id,
        pathToDelete
      );

      if (result.success) {
        server.remotePaths = result.data;
        renderSavedPaths();
        loadRemotePaths();
      } else {
        alert("삭제 실패: " + result.error);
      }
    });
  });
}

// ========================================
// 초기화
// ========================================

export function initFileTransfer() {
  // 드래그 오버
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  // 드래그 떠남
  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });

  // 드롭
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const files = [...e.dataTransfer.files];
    for (const file of files) {
      // 폴더인지 확인하고 처리
      await addItemToQueue(file.path);
    }
  });

  // 파일 선택 버튼 (다중 선택 가능)
  btnSelectFile.addEventListener("click", async () => {
    const filePaths = await window.api.dialog.selectFile();
    if (filePaths && filePaths.length > 0) {
      for (const filePath of filePaths) {
        const fileName = await getFileName(filePath);
        addToQueue({
          absolutePath: filePath,
          relativePath: fileName,
          displayName: fileName,
          isFolder: false,
        });
      }
    }
  });

  // 폴더 선택 버튼
  btnSelectFolder.addEventListener("click", async () => {
    const folderPath = await window.api.dialog.selectFolder();
    if (folderPath) {
      await addItemToQueue(folderPath);
    }
  });

  // 목록 비우기
  btnClearQueue.addEventListener("click", () => {
    clearQueue();
  });

  // 경로 저장 버튼
  btnSavePath.addEventListener("click", saveCurrentPath);

  // 경로 관리 버튼
  btnManagePaths.addEventListener("click", openPathsModal);

  // 경로 관리 모달 닫기
  btnClosePathsModal.addEventListener("click", closePathsModal);
  pathsModal.addEventListener("click", (e) => {
    if (e.target === pathsModal) closePathsModal();
  });

  // 전송 시작
  btnStartTransfer.addEventListener("click", async () => {
    const target = getSelectedTarget(); // serverDetailView에서 가져옴
    if (target === "host") {
      await startTransfer("host");
    } else {
      await startTransfer("container", target);
    }
  });
}

// ========================================
// 대기 목록 관리
// ========================================

/**
 * 파일 또는 폴더를 큐에 추가
 * @param {string} itemPath - 파일 또는 폴더 경로
 */
async function addItemToQueue(itemPath) {
  // 폴더인지 확인
  const result = await window.api.file.getFolderContents(itemPath);

  if (result.success) {
    // 폴더인 경우: 내부 파일들을 모두 추가
    const folderName = result.folderName;

    if (result.files.length === 0) {
      alert(`폴더 "${folderName}"에 파일이 없습니다.`);
      return;
    }

    for (const file of result.files) {
      addToQueue({
        absolutePath: file.absolutePath,
        relativePath: `${folderName}/${file.posixRelativePath}`,
        displayName: `${folderName}/${file.posixRelativePath}`,
        isFolder: false,
      });
    }
  } else {
    // 파일인 경우
    const fileName = await getFileName(itemPath);
    addToQueue({
      absolutePath: itemPath,
      relativePath: fileName,
      displayName: fileName,
      isFolder: false,
    });
  }
}

/**
 * 큐에 항목 추가
 * @param {{absolutePath: string, relativePath: string, displayName: string, isFolder: boolean}} item
 */
function addToQueue(item) {
  fileQueue.push(item);
  renderQueue();
}

function clearQueue() {
  fileQueue = [];
  renderQueue();
}

function renderQueue() {
  if (fileQueue.length === 0) {
    transferQueue.classList.add("hidden");
    return;
  }

  transferQueue.classList.remove("hidden");
  queueList.innerHTML = "";

  fileQueue.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>📄 ${item.displayName}</span>
      <button class="btn-remove" data-index="${index}">&times;</button>
    `;
    queueList.appendChild(li);
  });

  // 개별 삭제 버튼
  queueList.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index);
      fileQueue.splice(index, 1);
      renderQueue();
    });
  });
}

// ========================================
// 파일 전송 (통합)
// ========================================

/**
 * 필요한 디렉토리 목록 추출 (중복 제거)
 * @param {string} remoteBasePath
 * @returns {string[]}
 */
function extractDirectories(remoteBasePath) {
  const dirs = new Set();

  for (const item of fileQueue) {
    // relativePath에서 디렉토리 부분 추출
    const parts = item.relativePath.split("/");
    if (parts.length > 1) {
      // 파일명 제외한 경로
      let currentPath = remoteBasePath;
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = `${currentPath}/${parts[i]}`;
        dirs.add(currentPath);
      }
    }
  }

  // 정렬 (상위 디렉토리부터 생성하도록)
  return Array.from(dirs).sort();
}

/**
 * 파일 전송 실행
 * @param {'host' | 'container'} targetType - 전송 대상 타입
 * @param {string} [containerName] - 컨테이너명 (targetType이 'container'일 때)
 */
async function startTransfer(targetType, containerName = null) {
  const server = getSelectedServer();
  if (!server) {
    alert("서버를 선택해주세요.");
    return;
  }

  if (fileQueue.length === 0) {
    alert("전송할 파일을 선택해주세요.");
    return;
  }

  const remoteBasePath =
    remotePath.value.trim() || server.remotePath || "/home";

  // UI 초기화
  showTransferProgress();

  // 1단계: 필요한 디렉토리 생성
  const dirsToCreate = extractDirectories(remoteBasePath);

  for (const dir of dirsToCreate) {
    updateProgress(`📁 ${dir} 생성 중...`, 0, fileQueue.length);

    const mkdirResult =
      targetType === "host"
        ? await window.api.ssh.makeDirectory(server.id, dir)
        : await window.api.docker.makeDirectory(server.id, containerName, dir);

    if (!mkdirResult.success) {
      console.error(`디렉토리 생성 실패: ${dir} - ${mkdirResult.error}`);
      // 계속 진행 (이미 존재할 수 있음)
    }
  }

  // 2단계: 파일 전송
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < fileQueue.length; i++) {
    const item = fileQueue[i];
    // 원격 경로는 항상 POSIX 스타일 (/)
    const remoteFilePath = `${remoteBasePath}/${item.relativePath}`;

    updateProgress(item.displayName, i, fileQueue.length);

    // 전송 대상에 따라 API 분기
    const result =
      targetType === "host"
        ? await window.api.ssh.sendFile(server.id, item.absolutePath, remoteFilePath)
        : await window.api.docker.sendFile(
            server.id,
            item.absolutePath,
            containerName,
            remoteFilePath
          );

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      console.error(
        `[${result.code}] 전송 실패: ${item.displayName} - ${result.error}`
      );
    }
  }

  // 완료 처리
  const targetLabel = targetType === "host" ? "" : " 컨테이너로";
  completeTransfer(successCount, failCount, targetLabel);
}

// ========================================
// 외부 노출
// ========================================

export function resetTransferStatus() {
  transferStatus.classList.add("hidden");
  progressFill.style.width = "0%";
  transferPercent.textContent = "0%";
  transferFilename.textContent = "";
  transferResult.textContent = "";
}

// 서버 선택 시 경로 목록 로드
export function onServerSelected() {
  loadRemotePaths();
}
