// ========================================
// client/sshClient.js - SSH 클라이언트
// ========================================

const { withConnection, getSftp } = require("../shared/sshConnection");
const { ERROR_CODES } = require("../shared/errorCodes");

/**
 * SSH 연결 테스트
 * @param {Object} server - 서버 정보
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
async function testConnection(server) {
  return withConnection(server, () => {
    return { success: true };
  });
}

/**
 * SSH 파일 전송
 * @param {Object} server - 서버 정보
 * @param {string} localPath - 로컬 파일 경로
 * @param {string} remotePath - 원격 파일 경로
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
async function sendFile(server, localPath, remotePath) {
  return withConnection(server, async (conn) => {
    const sftpResult = await getSftp(conn);
    if (!sftpResult.success) {
      return sftpResult;
    }

    return new Promise((resolve) => {
      sftpResult.sftp.fastPut(localPath, remotePath, (err) => {
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
  });
}

module.exports = {
  testConnection,
  sendFile,
};
