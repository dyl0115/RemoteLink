// ========================================
// renderer/serverListView.js - 서버 목록 UI
// ========================================

import { state, loadServers } from "./index.js";
import { showDetail, hideDetail } from "./serverDetailView.js";
import { onServerSelected } from "./fileTransferView.js";

const serverListEl = document.getElementById("server-list");

export function initServerList() {
  renderServerList();
}

// 서버 목록 렌더링
export function renderServerList() {
  serverListEl.innerHTML = "";

  if (state.servers.length === 0) {
    serverListEl.innerHTML =
      '<li style="color:#666; text-align:center;">서버가 없습니다</li>';
    return;
  }

  state.servers.forEach((server) => {
    const li = document.createElement("li");
    li.dataset.id = server.id;

    if (server.id === state.selectedServerId) {
      li.classList.add("active");
    }

    li.innerHTML = `
      <div class="server-name">${server.name}</div>
      <div class="server-host">${server.username}@${server.host}</div>
    `;

    li.addEventListener("click", () => selectServer(server.id));
    serverListEl.appendChild(li);
  });
}

// 서버 선택
function selectServer(id) {
  state.selectedServerId = id;
  renderServerList();
  showDetail();
  onServerSelected(); // 파일 전송 뷰에 알림 (원격 경로 로드)
}

// 선택 해제
export function deselectServer() {
  state.selectedServerId = null;
  renderServerList();
  hideDetail();
}

// 외부에서 목록 새로고침할 때
export async function refreshServerList() {
  await loadServers();
  renderServerList();
}
