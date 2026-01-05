// ========================================
// renderer/serverDetailView.js - 서버 상세 정보
// ========================================

import { state, getSelectedServer } from "./index.js";
import { openModal } from "./serverFormView.js";
import { deselectServer, refreshServerList } from "./serverListView.js";

// DOM 요소들
const welcomeSection = document.getElementById("welcome-section");
const detailSection = document.getElementById("server-detail");
const detailName = document.getElementById("detail-name");
const detailHost = document.getElementById("detail-host");
const detailPort = document.getElementById("detail-port");
const detailUsername = document.getElementById("detail-username");
const detailKeyfile = document.getElementById("detail-keyfile");
const btnEditServer = document.getElementById("btn-edit-server");
const btnDeleteServer = document.getElementById("btn-delete-server");
const btnTestConnection = document.getElementById("btn-test-connection");
const connectionStatus = document.getElementById("connection-status");

/**
 * 상태 업데이트 헬퍼 함수
 * @param {'loading' | 'success' | 'error'} type
 * @param {string} message
 */
function updateConnectionStatus(type, message) {
  connectionStatus.textContent = message;
  connectionStatus.className = `connection-status ${type}`;
}

export function initServerDetail() {
  // 수정 버튼
  btnEditServer.addEventListener("click", () => {
    const server = getSelectedServer();
    if (server) {
      openModal(server);
    }
  });

  // 삭제 버튼
  btnDeleteServer.addEventListener("click", async () => {
    const server = getSelectedServer();
    if (!server) return;

    const confirmed = confirm(`"${server.name}" 서버를 삭제하시겠습니까?`);
    if (!confirmed) return;

    const result = await window.api.server.delete(server.id);

    if (result.success) {
      deselectServer();
      await refreshServerList();
    } else {
      alert("삭제 실패: " + result.error);
      console.error(`[${result.code}]`, result.error);
    }
  });

  // 서버 연결 테스트 버튼
  btnTestConnection.addEventListener("click", async () => {
    const server = getSelectedServer();
    if (!server) return;

    updateConnectionStatus("loading", "연결 중...");

    const result = await window.api.ssh.testConnection(server.id);

    if (result.success) {
      updateConnectionStatus("success", "✅ 연결 성공!");
    } else {
      updateConnectionStatus("error", `❌ 연결 실패: ${result.error}`);
      console.error(`[${result.code}]`, result.error);
    }
  });
}

// 상세 정보 표시
export function showDetail() {
  const server = getSelectedServer();
  if (!server) return;

  detailName.textContent = server.name;
  detailHost.textContent = server.host;
  detailPort.textContent = server.port;
  detailUsername.textContent = server.username;
  detailKeyfile.textContent = server.keyFile || "(없음)";

  // 연결 상태 초기화
  connectionStatus.textContent = "";
  connectionStatus.className = "connection-status";

  welcomeSection.classList.add("hidden");
  detailSection.classList.remove("hidden");
}

// 상세 정보 숨기기
export function hideDetail() {
  welcomeSection.classList.remove("hidden");
  detailSection.classList.add("hidden");
}
