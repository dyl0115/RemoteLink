/**
 * 폴더 압축 Worker Thread
 * 메인 스레드를 블로킹하지 않고 백그라운드에서 압축 수행
 */

const { parentPort, workerData } = require("worker_threads");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

/**
 * 폴더를 zip으로 압축
 * @param {string} folderPath - 압축할 폴더 경로
 * @param {string} outputPath - 출력 zip 파일 경로
 * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
 */
async function compressFolder(folderPath, outputPath) {
  return new Promise((resolve) => {
    // 출력 스트림 생성
    const output = fs.createWriteStream(outputPath);

    // archiver 인스턴스 생성 (zip 포맷, 압축 레벨 6)
    const archive = archiver("zip", {
      zlib: { level: 6 },
    });

    // 완료 이벤트
    output.on("close", () => {
      resolve({
        success: true,
        outputPath,
        size: archive.pointer(), // 압축된 파일 크기
      });
    });

    // 에러 이벤트
    archive.on("error", (err) => {
      resolve({
        success: false,
        error: err.message,
      });
    });

    // 진행 상황 전송 (선택적)
    archive.on("progress", (progress) => {
      if (parentPort) {
        parentPort.postMessage({
          type: "progress",
          entries: progress.entries.processed,
          totalBytes: progress.fs.processedBytes,
        });
      }
    });

    // 경고 이벤트 (치명적이지 않은 에러)
    archive.on("warning", (err) => {
      if (err.code !== "ENOENT") {
        console.warn("Archive warning:", err.message);
      }
    });

    // 스트림 연결
    archive.pipe(output);

    // 폴더 추가 (폴더명을 루트로)
    const folderName = path.basename(folderPath);
    archive.directory(folderPath, folderName);

    // 압축 시작
    archive.finalize();
  });
}

/**
 * Worker 메인 실행
 */
async function main() {
  const { folderPath, outputPath } = workerData;

  try {
    // 입력 검증
    if (!folderPath || !outputPath) {
      throw new Error("folderPath와 outputPath가 필요합니다");
    }

    // 폴더 존재 확인
    if (!fs.existsSync(folderPath)) {
      throw new Error(`폴더를 찾을 수 없습니다: ${folderPath}`);
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      throw new Error(`폴더가 아닙니다: ${folderPath}`);
    }

    // 압축 실행
    const result = await compressFolder(folderPath, outputPath);

    // 결과 전송
    parentPort.postMessage({
      type: "complete",
      ...result,
    });
  } catch (err) {
    // 에러 전송
    parentPort.postMessage({
      type: "error",
      success: false,
      error: err.message || String(err),
    });
  }
}

// Worker 실행
main();
