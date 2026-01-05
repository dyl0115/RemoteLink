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
const btnRefreshContainers = document.getElementById("btn-refresh-containers");
const connectionTarget = document.getElementById("connection-target");
const connectionStatus = document.getElementById("connection-status");

/**
 * 상태 업데이트 헬퍼 함수
 * @param {'loading' | 'success' | 'error' | ''} type
 * @param {string} message
 */
function updateConnectionStatus(type, message) {
  connectionStatus.textContent = message;
  connectionStatus.className = type
    ? `connection-status ${type}`
    : "connection-status";
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

  // 컨테이너 목록 새로고침 버튼
  btnRefreshContainers.addEventListener("click", refreshContainerList);

  // 연결 테스트 버튼
  btnTestConnection.addEventListener("click", async () => {
    const server = getSelectedServer();
    if (!server) return;

    const target = connectionTarget.value;

    updateConnectionStatus("loading", "연결 중...");

    let result;
    if (target === "host") {
      // 호스트 연결 테스트
      result = await window.api.ssh.testConnection(server.id);
    } else {
      // 컨테이너 연결 테스트
      result = await window.api.docker.testContainer(server.id, target);
    }

    if (result.success) {
      const targetName = target === "host" ? "호스트" : `컨테이너 (${target})`;
      updateConnectionStatus("success", `✅ ${targetName} 연결 성공!`);
    } else {
      updateConnectionStatus("error", `❌ 연결 실패: ${result.error}`);
      console.error(`[${result.code}]`, result.error);
    }
  });
}

/**
 * 컨테이너 목록 새로고침
 */
async function refreshContainerList() {
  const server = getSelectedServer();
  if (!server) return;

  // 기존 옵션 초기화 (호스트만 남김)
  connectionTarget.innerHTML = '<option value="host">🖥️ 호스트</option>';

  updateConnectionStatus("loading", "컨테이너 조회 중...");

  const result = await window.api.docker.listContainer(server.id);

  if (!result.success) {
    updateConnectionStatus("error", `❌ ${result.error}`);
    console.error(`[${result.code}]`, result.error);
    return;
  }

  // 컨테이너 옵션 추가
  result.containers.forEach((container) => {
    const option = document.createElement("option");
    option.value = container.name;
    option.textContent = `🐳 ${container.name} (${container.image})`;
    connectionTarget.appendChild(option);
  });

  updateConnectionStatus(
    "success",
    `✅ ${result.containers.length}개 컨테이너 발견`
  );

  // 2초 후 상태 메시지 제거
  setTimeout(() => {
    updateConnectionStatus("", "");
  }, 2000);
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

  // 연결 대상 초기화
  connectionTarget.innerHTML = '<option value="host">🖥️ 호스트</option>';

  // 연결 상태 초기화
  updateConnectionStatus("", "");

  welcomeSection.classList.add("hidden");
  detailSection.classList.remove("hidden");
}

// 상세 정보 숨기기
export function hideDetail() {
  welcomeSection.classList.remove("hidden");
  detailSection.classList.add("hidden");
}

// 현재 선택된 연결 대상 가져오기 (외부에서 사용)
export function getSelectedTarget() {
  return connectionTarget.value;
}
