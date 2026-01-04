// ========================================
// renderer/fileTransferView.js - 파일 전송 UI
// ========================================

import { getSelectedServer } from "./index.js";

// DOM 요소들
const remotePath = document.getElementById("remote-path");
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

// 전송 대기 목록
let fileQueue = [];

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

  // 전송 시작
  btnStartTransfer.addEventListener("click", async () => {
    await startTransfer();
  });
}

// 대기 목록에 추가
function addToQueue(path, name, isFolder = false) {
  fileQueue.push({ path, name, isFolder });
  renderQueue();
}

// 대기 목록 비우기
function clearQueue() {
  fileQueue = [];
  renderQueue();
}

// 대기 목록 렌더링
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

// 전송 시작
async function startTransfer() {
  const server = getSelectedServer();
  if (!server) {
    alert("서버를 선택해주세요.");
    return;
  }

  const remoteBasePath =
    remotePath.value.trim() || server.remotePath || "/home";

  if (fileQueue.length === 0) {
    alert("전송할 파일을 선택해주세요.");
    return;
  }

  // 전송 상태 UI 표시
  transferStatus.classList.remove("hidden");
  transferResult.textContent = "";
  transferResult.className = "transfer-result";
  btnStartTransfer.disabled = true;

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < fileQueue.length; i++) {
    const item = fileQueue[i];
    const remoteFilePath = `${remoteBasePath}/${item.name}`;

    // 진행률 표시
    transferFilename.textContent = item.name;
    const percent = Math.round((i / fileQueue.length) * 100);
    transferPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;

    try {
      const result = await window.api.ssh.sendFile(
        server.id,
        item.path,
        remoteFilePath
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`전송 실패: ${item.name} - ${result.error}`);
      }
    } catch (err) {
      failCount++;
      console.error(`전송 에러: ${item.name} - ${err.message}`);
    }
  }

  // 완료
  transferPercent.textContent = "100%";
  progressFill.style.width = "100%";
  transferFilename.textContent = "완료";

  if (failCount === 0) {
    transferResult.textContent = `✅ ${successCount}개 파일 전송 성공!`;
    transferResult.className = "transfer-result success";
  } else {
    transferResult.textContent = `⚠️ 성공: ${successCount}, 실패: ${failCount}`;
    transferResult.className = "transfer-result error";
  }

  btnStartTransfer.disabled = false;
  clearQueue();
}

// 전송 상태 초기화
export function resetTransferStatus() {
  transferStatus.classList.add("hidden");
  progressFill.style.width = "0%";
  transferPercent.textContent = "0%";
  transferFilename.textContent = "";
  transferResult.textContent = "";
}
