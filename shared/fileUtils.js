// ========================================
// shared/fileUtils.js - 파일 유틸리티
// ========================================

const fs = require("fs");
const path = require("path");

/**
 * 폴더 내 모든 파일을 재귀적으로 수집
 * @param {string} dirPath - 폴더 경로
 * @param {string} [basePath] - 상대 경로 계산용 기준 경로
 * @returns {Array<{absolutePath: string, relativePath: string}>}
 */
function collectFilesRecursively(dirPath, basePath = null) {
  if (!basePath) {
    basePath = dirPath;
  }

  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, absolutePath);

    if (entry.isDirectory()) {
      // 재귀적으로 하위 폴더 탐색
      const subFiles = collectFilesRecursively(absolutePath, basePath);
      results.push(...subFiles);
    } else if (entry.isFile()) {
      results.push({ absolutePath, relativePath });
    }
  }

  return results;
}

/**
 * 경로가 폴더인지 확인
 * @param {string} filePath
 * @returns {boolean}
 */
function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 폴더 내 파일 정보 수집 (IPC용)
 * @param {string} folderPath - 폴더 경로
 * @returns {{success: boolean, files?: Array, folderName?: string, error?: string}}
 */
function getFolderContents(folderPath) {
  try {
    if (!isDirectory(folderPath)) {
      return { success: false, error: "폴더가 아닙니다" };
    }

    const folderName = path.basename(folderPath);
    const files = collectFilesRecursively(folderPath);

    return {
      success: true,
      folderName,
      files: files.map((f) => ({
        absolutePath: f.absolutePath,
        relativePath: f.relativePath,
        // 원격 경로용 (항상 / 사용)
        posixRelativePath: f.relativePath.replace(/\\/g, "/"),
      })),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  collectFilesRecursively,
  isDirectory,
  getFolderContents,
};
