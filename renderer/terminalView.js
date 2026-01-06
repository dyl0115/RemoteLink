// ========================================
// renderer/terminalView.js - 터미널 UI 관리
// ========================================

import { getSelectedServer } from "./index.js";
import { getSelectedTarget } from "./serverDetailView.js";

// xterm은 전역 객체로 로드됨 (index.html의 script 태그)
const Terminal = window.Terminal;
const FitAddon = window.FitAddon.FitAddon;

// 터미널 탭 데이터
// { sessionId, type, name, terminal, fitAddon, element }
const terminals = new Map();
let activeSessionId = null;

// DOM 요소
let terminalTabs;
let terminalContainer;
let terminalContent;
let resizeHandle;
let btnNewTerminal;
let newTerminalDropdown;

// 리사이즈 상태
let isResizing = false;
let startY = 0;
let startHeight = 0;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 300;

/**
 * 터미널 뷰 초기화
 */
export function initTerminalView() {
  terminalTabs = document.getElementById("terminal-tabs");
  terminalContainer = document.getElementById("terminal-container");
  terminalContent = document.getElementById("terminal-content");
  resizeHandle = document.getElementById("terminal-resize-handle");
  btnNewTerminal = document.getElementById("btn-new-terminal");
  newTerminalDropdown = document.getElementById("new-terminal-dropdown");

  // 새 터미널 버튼 이벤트
  btnNewTerminal.addEventListener("click", toggleDropdown);

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (
      !btnNewTerminal.contains(e.target) &&
      !newTerminalDropdown.contains(e.target)
    ) {
      newTerminalDropdown.classList.add("hidden");
    }
  });

  // 리사이즈 핸들 이벤트
  resizeHandle.addEventListener("mousedown", startResize);
  document.addEventListener("mousemove", doResize);
  document.addEventListener("mouseup", stopResize);

  // IPC 이벤트 리스너 등록
  window.api.terminal.onOpened(handleTerminalOpened);
  window.api.terminal.onData(handleTerminalData);
  window.api.terminal.onClosed(handleTerminalClosed);

  // 초기 높이 설정
  terminalContent.style.height = `${DEFAULT_HEIGHT}px`;
}

/**
 * 드롭다운 토글
 */
function toggleDropdown() {
  updateDropdownOptions();
  newTerminalDropdown.classList.toggle("hidden");
}

/**
 * 드롭다운 옵션 업데이트 (호스트 + 컨테이너 목록)
 */
async function updateDropdownOptions() {
  const server = getSelectedServer();
  if (!server) return;

  newTerminalDropdown.innerHTML = "";

  // 호스트 옵션
  const hostOption = document.createElement("div");
  hostOption.className = "dropdown-item";
  hostOption.textContent = "🖥️ 호스트 SSH";
  hostOption.addEventListener("click", () => {
    openTerminal("host");
    newTerminalDropdown.classList.add("hidden");
  });
  newTerminalDropdown.appendChild(hostOption);

  // 컨테이너 목록 가져오기
  const result = await window.api.docker.listContainer(server.id);

  if (result.success && result.containers.length > 0) {
    const divider = document.createElement("div");
    divider.className = "dropdown-divider";
    newTerminalDropdown.appendChild(divider);

    result.containers.forEach((container) => {
      const option = document.createElement("div");
      option.className = "dropdown-item";
      option.textContent = `🐳 ${container.name}`;
      option.addEventListener("click", () => {
        openTerminal("container", container.name);
        newTerminalDropdown.classList.add("hidden");
      });
      newTerminalDropdown.appendChild(option);
    });
  }
}

/**
 * 터미널 열기
 * @param {'host' | 'container'} type
 * @param {string} containerName
 */
export function openTerminal(type = "host", containerName = null) {
  const server = getSelectedServer();
  console.log("openTerminal 호출:", { server, type, containerName });

  if (!server) {
    console.error("서버가 선택되지 않았습니다");
    return;
  }

  // 연결 요청
  window.api.terminal.open({
    serverId: server.id,
    type,
    containerName,
  });
}

/**
 * 터미널 세션 열림 핸들러
 */
function handleTerminalOpened(result) {
  console.log("handleTerminalOpened:", result);

  if (!result.success) {
    console.error("터미널 열기 실패:", result.error);
    alert(`터미널 열기 실패: ${result.error}`);
    return;
  }

  const { sessionId } = result;
  const server = getSelectedServer();

  // 임시로 타입 추정 (실제로는 open 시 저장해둬야 함)
  const type = result.type || "host";
  const name = type === "host" ? "호스트" : result.containerName || "컨테이너";

  createTerminalTab(sessionId, type, name);
}

/**
 * 터미널 탭 생성
 */
function createTerminalTab(sessionId, type, name) {
  console.log("createTerminalTab 호출:", { sessionId, type, name });

  // placeholder 숨기기
  const placeholder = terminalContent.querySelector(".terminal-placeholder");
  if (placeholder) {
    placeholder.style.display = "none";
  }

  // xterm 인스턴스 생성
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "'Consolas', 'Monaco', monospace",
    theme: {
      background: "#1a1a2e",
      foreground: "#eee",
      cursor: "#e94560",
      selection: "rgba(233, 69, 96, 0.3)",
    },
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  // 터미널 DOM 요소 생성
  const terminalElement = document.createElement("div");
  terminalElement.className = "terminal-instance";
  terminalElement.id = `terminal-${sessionId}`;
  terminalContent.appendChild(terminalElement);

  // xterm 마운트
  terminal.open(terminalElement);
  fitAddon.fit();

  // 키 입력 이벤트
  terminal.onData((data) => {
    window.api.terminal.write(sessionId, data);
  });

  // 크기 변경 시 서버에 알림
  const resizeObserver = new ResizeObserver(() => {
    if (activeSessionId === sessionId) {
      fitAddon.fit();
      window.api.terminal.resize(sessionId, terminal.cols, terminal.rows);
    }
  });
  resizeObserver.observe(terminalElement);

  // 탭 생성
  const tab = document.createElement("div");
  tab.className = "terminal-tab";
  tab.dataset.sessionId = sessionId;

  const icon = type === "host" ? "🖥️" : "🐳";
  tab.innerHTML = `
    <span class="tab-icon">${icon}</span>
    <span class="tab-name">${name}</span>
    <button class="tab-close" title="닫기">×</button>
  `;

  // 탭 클릭 이벤트
  tab.addEventListener("click", (e) => {
    if (!e.target.classList.contains("tab-close")) {
      activateTab(sessionId);
    }
  });

  // 탭 닫기 버튼
  tab.querySelector(".tab-close").addEventListener("click", (e) => {
    e.stopPropagation();
    closeTerminal(sessionId);
  });

  terminalTabs.insertBefore(tab, btnNewTerminal);

  // 저장
  terminals.set(sessionId, {
    sessionId,
    type,
    name,
    terminal,
    fitAddon,
    element: terminalElement,
    tab,
    resizeObserver,
  });

  // 활성화
  activateTab(sessionId);

  // 초기 크기 전송
  setTimeout(() => {
    fitAddon.fit();
    window.api.terminal.resize(sessionId, terminal.cols, terminal.rows);
  }, 100);
}

/**
 * 탭 활성화
 */
function activateTab(sessionId) {
  // 기존 활성 탭 비활성화
  if (activeSessionId && terminals.has(activeSessionId)) {
    const prevTerminal = terminals.get(activeSessionId);
    prevTerminal.tab.classList.remove("active");
    prevTerminal.element.classList.remove("active");
  }

  // 새 탭 활성화
  const terminalData = terminals.get(sessionId);
  if (terminalData) {
    terminalData.tab.classList.add("active");
    terminalData.element.classList.add("active");
    terminalData.fitAddon.fit();
    terminalData.terminal.focus();
    activeSessionId = sessionId;
  }
}

/**
 * 터미널 닫기
 */
function closeTerminal(sessionId) {
  const terminalData = terminals.get(sessionId);
  if (!terminalData) return;

  // 서버에 세션 종료 요청
  window.api.terminal.close(sessionId);

  // 정리
  terminalData.resizeObserver.disconnect();
  terminalData.terminal.dispose();
  terminalData.element.remove();
  terminalData.tab.remove();
  terminals.delete(sessionId);

  // 다른 탭 활성화
  if (activeSessionId === sessionId) {
    activeSessionId = null;
    const remaining = Array.from(terminals.keys());
    if (remaining.length > 0) {
      activateTab(remaining[remaining.length - 1]);
    }
  }
}

/**
 * 터미널 데이터 수신 핸들러
 */
function handleTerminalData({ sessionId, data }) {
  const terminalData = terminals.get(sessionId);
  if (terminalData) {
    terminalData.terminal.write(data);
  }
}

/**
 * 터미널 세션 닫힘 핸들러 (서버에서 닫힌 경우)
 */
function handleTerminalClosed({ sessionId, reason }) {
  const terminalData = terminals.get(sessionId);
  if (terminalData) {
    terminalData.terminal.write(
      `\r\n\x1b[31m[연결 종료: ${reason || "세션 종료"}]\x1b[0m\r\n`
    );

    // 3초 후 탭 제거
    setTimeout(() => {
      if (terminals.has(sessionId)) {
        terminalData.resizeObserver.disconnect();
        terminalData.terminal.dispose();
        terminalData.element.remove();
        terminalData.tab.remove();
        terminals.delete(sessionId);

        if (activeSessionId === sessionId) {
          activeSessionId = null;
          const remaining = Array.from(terminals.keys());
          if (remaining.length > 0) {
            activateTab(remaining[remaining.length - 1]);
          }
        }
      }
    }, 3000);
  }
}

/**
 * 리사이즈 시작
 */
function startResize(e) {
  isResizing = true;
  startY = e.clientY;
  startHeight = terminalContent.offsetHeight;
  document.body.style.cursor = "ns-resize";
  document.body.style.userSelect = "none";
}

/**
 * 리사이즈 중
 */
function doResize(e) {
  if (!isResizing) return;

  const deltaY = startY - e.clientY;
  let newHeight = startHeight + deltaY;

  // 범위 제한
  newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
  terminalContent.style.height = `${newHeight}px`;

  // 활성 터미널 크기 조정
  if (activeSessionId && terminals.has(activeSessionId)) {
    const terminalData = terminals.get(activeSessionId);
    terminalData.fitAddon.fit();
  }
}

/**
 * 리사이즈 종료
 */
function stopResize() {
  if (!isResizing) return;

  isResizing = false;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";

  // 최종 크기 서버에 알림
  if (activeSessionId && terminals.has(activeSessionId)) {
    const terminalData = terminals.get(activeSessionId);
    terminalData.fitAddon.fit();
    window.api.terminal.resize(
      activeSessionId,
      terminalData.terminal.cols,
      terminalData.terminal.rows
    );
  }
}

/**
 * 모든 터미널 정리 (서버 변경 시 등)
 */
export function cleanupTerminals() {
  for (const [sessionId] of terminals) {
    closeTerminal(sessionId);
  }
}

/**
 * 현재 선택된 연결 대상으로 터미널 열기 (외부 호출용)
 */
export function openTerminalForCurrentTarget() {
  const target = getSelectedTarget();
  if (target === "host") {
    openTerminal("host");
  } else {
    openTerminal("container", target);
  }
}
