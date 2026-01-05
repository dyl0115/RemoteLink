// ========================================
// renderer/serverFormView.js - 서버 추가/수정 모달
// ========================================

import { refreshServerList } from "./serverListView.js";
import { state } from "./index.js";

// DOM 요소들
const modal = document.getElementById("server-modal");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("server-form");
const btnAddServer = document.getElementById("btn-add-server");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancel = document.getElementById("btn-cancel");
const btnSelectKeyfile = document.getElementById("btn-select-keyfile");

// Form 필드들
const formId = document.getElementById("form-id");
const formName = document.getElementById("form-name");
const formHost = document.getElementById("form-host");
const formPort = document.getElementById("form-port");
const formUsername = document.getElementById("form-username");
const formKeyfile = document.getElementById("form-keyfile");
const formRemotePath = document.getElementById("form-remote-path");

export function initServerForm() {
  // 서버 추가 버튼
  btnAddServer.addEventListener("click", () => openModal());

  // 모달 닫기
  btnCloseModal.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);

  // 모달 바깥 클릭 시 닫기
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // 키 파일 선택
  btnSelectKeyfile.addEventListener("click", async () => {
    const filePath = await window.api.dialog.selectKeyFile();
    if (filePath) {
      formKeyfile.value = filePath;
    }
  });

  // 폼 제출
  form.addEventListener("submit", handleSubmit);
}

// 모달 열기 (추가 모드)
export function openModal(server = null) {
  if (server) {
    // 수정 모드
    modalTitle.textContent = "서버 수정";
    formId.value = server.id;
    formName.value = server.name;
    formHost.value = server.host;
    formPort.value = server.port;
    formUsername.value = server.username;
    formKeyfile.value = server.keyFile || "";
    formRemotePath.value = server.remotePath || "";
  } else {
    // 추가 모드
    modalTitle.textContent = "서버 추가";
    form.reset();
    formId.value = "";
    formPort.value = "22";
  }

  modal.classList.remove("hidden");
  formName.focus();
}

// 모달 닫기
export function closeModal() {
  modal.classList.add("hidden");
  form.reset();
}

// 폼 제출 처리
async function handleSubmit(e) {
  e.preventDefault();

  const serverData = {
    id: formId.value || undefined,
    name: formName.value.trim(),
    host: formHost.value.trim(),
    port: parseInt(formPort.value, 10),
    username: formUsername.value.trim(),
    keyFile: formKeyfile.value.trim() || null,
    remotePath: formRemotePath.value.trim() || null,
  };

  const result = await window.api.server.save(serverData);

  if (result.success) {
    closeModal();
    await refreshServerList();
  } else {
    alert("저장 실패: " + result.error);
    console.error(`[${result.code}]`, result.error);
  }
}
