// ========================================
// shared/pathUtils.js - 크로스 플랫폼 경로 유틸리티
// ========================================

const path = require("path");

/**
 * 경로에서 파일/폴더 이름 추출 (크로스 플랫폼)
 * @param {string} filePath - 파일 경로
 * @returns {string} 파일/폴더 이름
 */
function getBasename(filePath) {
  return path.basename(filePath);
}

/**
 * 경로에서 디렉토리 부분 추출 (크로스 플랫폼)
 * @param {string} filePath - 파일 경로
 * @returns {string} 디렉토리 경로
 */
function getDirname(filePath) {
  return path.dirname(filePath);
}

/**
 * 경로 합치기 (크로스 플랫폼)
 * @param {...string} paths - 경로 조각들
 * @returns {string} 합쳐진 경로
 */
function joinPath(...paths) {
  return path.join(...paths);
}

/**
 * POSIX 스타일 경로로 변환 (원격 서버용)
 * Windows 경로를 Linux 스타일로 변환
 * @param {string} filePath - 로컬 경로
 * @returns {string} POSIX 스타일 경로
 */
function toPosixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

/**
 * 원격 경로 합치기 (항상 POSIX 스타일)
 * @param {string} basePath - 기본 경로
 * @param {string} fileName - 파일 이름
 * @returns {string} 합쳐진 원격 경로
 */
function joinRemotePath(basePath, fileName) {
  // 원격 서버는 항상 Linux이므로 / 사용
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return `${base}/${fileName}`;
}

module.exports = {
  getBasename,
  getDirname,
  joinPath,
  toPosixPath,
  joinRemotePath,
};
