// ========================================
// renderer/index.js - 메인 진입점
// ========================================

import { initServerList } from "./serverListView.js";
import { initServerForm } from "./serverFormView.js";
import { initServerDetail } from "./serverDetailView.js";
import { initFileTransfer } from "./fileTransferView.js";

// 앱 상태
export const state = {
  servers: [],
  selectedServerId: null,
};

// 초기화
async function init() {
  await loadServers();
  initServerList();
  initServerForm();
  initServerDetail();
  initFileTransfer();
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
