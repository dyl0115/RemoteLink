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
let fileQueue = [];

// ========================================
// 헬퍼 함수들
// ========================================

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
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const files = [...e.dataTransfer.files];
    files.forEach((file) => {
      addToQueue(file.path, file.name);
    });
  });

  // 파일 선택 버튼 (다중 선택 가능)
  btnSelectFile.addEventListener("click", async () => {
    const filePaths = await window.api.dialog.selectFile();
    if (filePaths && filePaths.length > 0) {
      filePaths.forEach((filePath) => {
        const fileName = filePath.split("\\").pop();
        addToQueue(filePath, fileName);
      });
    }
  });

  // 폴더 선택 버튼
  btnSelectFolder.addEventListener("click", async () => {
    const folderPath = await window.api.dialog.selectFolder();
    if (folderPath) {
      const folderName = folderPath.split("\\").pop();
      addToQueue(folderPath, folderName, true);
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

function addToQueue(path, name, isFolder = false) {
  fileQueue.push({ path, name, isFolder });
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
      <span>${item.isFolder ? "📁" : "📄"} ${item.name}</span>
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

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < fileQueue.length; i++) {
    const item = fileQueue[i];
    const remoteFilePath = `${remoteBasePath}/${item.name}`;

    updateProgress(item.name, i, fileQueue.length);

    // 전송 대상에 따라 API 분기
    const result =
      targetType === "host"
        ? await window.api.ssh.sendFile(server.id, item.path, remoteFilePath)
        : await window.api.docker.sendFile(
            server.id,
            item.path,
            containerName,
            remoteFilePath
          );

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      console.error(
        `[${result.code}] 전송 실패: ${item.name} - ${result.error}`
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
