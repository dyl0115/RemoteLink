// ========================================
// client/dockerClient.js - Docker 클라이언트
// ========================================

const path = require("path");
const {
  withConnection,
  getSftp,
  execCommand,
} = require("../shared/sshConnection");
const { ERROR_CODES } = require("../shared/errorCodes");

/**
 * 호스트의 Docker Container 리스트 조회
 * @param {Object} server - 서버 정보
 * @returns {Promise<{success: true, containers: Array} | {success: false, error: string, code: string}>}
 */
async function getContainers(server) {
  return withConnection(server, async (conn) => {
    const command =
      'docker ps --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}"';
    const result = await execCommand(conn, command);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        code: ERROR_CODES.DOCKER_COMMAND_FAILED,
      };
    }

    const containers = [];
    if (result.stdout.trim()) {
      result.stdout
        .trim()
        .split("\n")
        .forEach((line) => {
          const [id, name, image, status] = line.split("\t");
          containers.push({ id, name, image, status });
        });
    }

    return { success: true, containers };
  });
}

/**
 * Docker 컨테이너 연결 테스트
 * @param {Object} server - 서버 정보
 * @param {string} containerName - 컨테이너 이름
 * @returns {Promise<{success: boolean, running?: boolean, error?: string, code?: string}>}
 */
async function testContainer(server, containerName) {
  return withConnection(server, async (conn) => {
    // 컨테이너 실행 상태 확인
    const command = `docker inspect ${containerName} --format '{{.State.Running}}'`;
    const result = await execCommand(conn, command);

    if (!result.success) {
      return {
        success: false,
        error: `컨테이너를 찾을 수 없습니다: ${containerName}`,
        code: ERROR_CODES.CONTAINER_NOT_FOUND,
      };
    }

    const isRunning = result.stdout.trim() === "true";

    if (!isRunning) {
      return {
        success: false,
        running: false,
        error: `컨테이너가 실행 중이 아닙니다: ${containerName}`,
        code: ERROR_CODES.CONTAINER_NOT_FOUND,
      };
    }

    return { success: true, running: true };
  });
}

/**
 * 로컬 → 호스트 → 컨테이너로 파일 복사
 * @param {Object} server - 서버 정보
 * @param {string} localPath - 로컬 파일 경로
 * @param {string} containerName - 컨테이너 이름
 * @param {string} containerPath - 컨테이너 내 경로
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
async function sendFile(server, localPath, containerName, containerPath) {
  return withConnection(server, async (conn) => {
    const fileName = path.basename(localPath);
    const tempPath = `/tmp/${fileName}`;

    // 1단계: SFTP로 호스트에 업로드
    const sftpResult = await getSftp(conn);
    if (!sftpResult.success) {
      return sftpResult;
    }

    const uploadResult = await new Promise((resolve) => {
      sftpResult.sftp.fastPut(localPath, tempPath, (err) => {
        if (err) {
          resolve({
            success: false,
            error: err.message,
            code: ERROR_CODES.FILE_WRITE_ERROR,
          });
          return;
        }
        resolve({ success: true });
      });
    });

    if (!uploadResult.success) {
      return uploadResult;
    }

    // 2단계: docker cp 실행
    const dockerCmd = `docker cp ${tempPath} ${containerName}:${containerPath}`;
    const dockerResult = await execCommand(conn, dockerCmd);

    // 3단계: 임시 파일 삭제 (실패해도 무시)
    await execCommand(conn, `rm -f ${tempPath}`);

    if (!dockerResult.success) {
      return {
        success: false,
        error: dockerResult.error,
        code: ERROR_CODES.DOCKER_COMMAND_FAILED,
      };
    }

    return { success: true };
  });
}

module.exports = {
  getContainers,
  testContainer,
  sendFile,
};
