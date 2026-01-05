// ========================================
// shared/logger.js - 로깅 시스템
// ========================================

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// 로그 레벨 정의
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// 현재 로그 레벨 (DEBUG면 모든 로그 출력)
let currentLogLevel = LOG_LEVELS.DEBUG;

// 로그 파일 경로
let logFilePath = null;
let logStream = null;

/**
 * 로거 초기화
 * @param {Object} options
 * @param {'DEBUG' | 'INFO' | 'WARN' | 'ERROR'} options.level - 로그 레벨
 * @param {boolean} options.file - 파일 로깅 활성화 여부
 */
function init(options = {}) {
  if (options.level && LOG_LEVELS[options.level] !== undefined) {
    currentLogLevel = LOG_LEVELS[options.level];
  }

  if (options.file) {
    try {
      const logDir = path.join(app.getPath("userData"), "logs");
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const date = new Date().toISOString().split("T")[0];
      logFilePath = path.join(logDir, `remotelink-${date}.log`);
      logStream = fs.createWriteStream(logFilePath, { flags: "a" });

      info("Logger", `로그 파일 초기화: ${logFilePath}`);
    } catch (err) {
      console.error("[Logger] 로그 파일 초기화 실패:", err);
    }
  }
}

/**
 * 로그 출력 포맷
 * @param {'DEBUG' | 'INFO' | 'WARN' | 'ERROR'} level
 * @param {string} category
 * @param {string} message
 * @param {Object} [data]
 */
function formatLog(level, category, message, data) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  return `[${timestamp}] [${level}] [${category}] ${message}${dataStr}`;
}

/**
 * 로그 기록
 * @param {'DEBUG' | 'INFO' | 'WARN' | 'ERROR'} level
 * @param {string} category
 * @param {string} message
 * @param {Object} [data]
 */
function log(level, category, message, data) {
  if (LOG_LEVELS[level] < currentLogLevel) {
    return;
  }

  const formatted = formatLog(level, category, message, data);

  // 콘솔 출력
  switch (level) {
    case "DEBUG":
      console.debug(formatted);
      break;
    case "INFO":
      console.info(formatted);
      break;
    case "WARN":
      console.warn(formatted);
      break;
    case "ERROR":
      console.error(formatted);
      break;
    default:
      console.log(formatted);
  }

  // 파일 출력
  if (logStream) {
    logStream.write(formatted + "\n");
  }
}

/**
 * DEBUG 레벨 로그
 * @param {string} category - 카테고리 (예: 'SSH', 'Docker', 'FileTransfer')
 * @param {string} message - 로그 메시지
 * @param {Object} [data] - 추가 데이터
 */
function debug(category, message, data) {
  log("DEBUG", category, message, data);
}

/**
 * INFO 레벨 로그
 * @param {string} category
 * @param {string} message
 * @param {Object} [data]
 */
function info(category, message, data) {
  log("INFO", category, message, data);
}

/**
 * WARN 레벨 로그
 * @param {string} category
 * @param {string} message
 * @param {Object} [data]
 */
function warn(category, message, data) {
  log("WARN", category, message, data);
}

/**
 * ERROR 레벨 로그
 * @param {string} category
 * @param {string} message
 * @param {Object} [data]
 */
function error(category, message, data) {
  log("ERROR", category, message, data);
}

/**
 * 로거 종료 (앱 종료 시 호출)
 */
function close() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

module.exports = {
  init,
  debug,
  info,
  warn,
  error,
  close,
  LOG_LEVELS,
};
