// ========================================
// renderer/index.js - 메인 진입점
// ========================================

import { initServerList } from "./serverListView.js";
import { initServerForm } from "./serverFormView.js";
import { initServerDetail } from "./serverDetailView.js";
import { initFileTransfer } from "./fileTransferView.js";
import { initTerminalView } from "./terminalView.js";

// 앱 상태
export const state = {
  servers: [],
  selectedServerId: null,
  activeTab: "file-transfer", // 'file-transfer' | 'terminal'
};

// 초기화
async function init() {
  await loadServers();
  initServerList();
  initServerForm();
  initServerDetail();
  initFileTransfer();
  initTerminalView();
  initMainTabs();
}

// 메인 탭 초기화
function initMainTabs() {
  const tabFileTransfer = document.getElementById("tab-file-transfer");
  const tabTerminal = document.getElementById("tab-terminal");
  const sectionFileTransfer = document.getElementById("file-transfer-section");
  const sectionTerminal = document.getElementById("terminal-section");

  tabFileTransfer.addEventListener("click", () => {
    state.activeTab = "file-transfer";
    tabFileTransfer.classList.add("active");
    tabTerminal.classList.remove("active");
    sectionFileTransfer.classList.remove("hidden");
    sectionTerminal.classList.add("hidden");
  });

  tabTerminal.addEventListener("click", () => {
    state.activeTab = "terminal";
    tabTerminal.classList.add("active");
    tabFileTransfer.classList.remove("active");
    sectionTerminal.classList.remove("hidden");
    sectionFileTransfer.classList.add("hidden");
  });
}

// 서버 목록 로드
export async function loadServers() {
  state.servers = await window.api.server.findAll();
  return state.servers;
}

// 선택된 서버 가져오기
export function getSelectedServer() {
  return state.servers.find((s) => s.id === state.selectedServerId) || null;
}

// 시작
init();
