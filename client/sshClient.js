// ========================================
// client/sshClient.js - SSH 클라이언트
// ========================================

const {
  withConnection,
  getSftp,
  execCommand,
} = require("../shared/sshConnection");
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
 * 원격 디렉토리 생성 (mkdir -p)
 * @param {Object} server - 서버 정보
 * @param {string} remoteDirPath - 원격 디렉토리 경로
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
async function makeDirectory(server, remoteDirPath) {
  return withConnection(server, async (conn) => {
    const result = await execCommand(conn, `mkdir -p "${remoteDirPath}"`);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        code: ERROR_CODES.FILE_WRITE_ERROR,
      };
    }

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

async function unzipFile(server, remotePath, targetDir) {
  return withConnection(server, async (conn) => {
    return new Promise((resolve) => {
      const command = `unzip -o "${remotePath}" -d "${targetDir}" && rm "${remotePath}"`;

      console.log("unzip 명령 실행:", command);

      conn.exec(command, (err, stream) => {
        if (err) {
          console.log("exec 에러:", err.message);
          resolve({ success: false, error: err.message });
          return;
        }

        let output = "";
        let errorOutput = "";

        stream.on("data", (data) => {
          output += data.toString();
          console.log("stdout:", data.toString());
        });

        stream.stderr.on("data", (data) => {
          errorOutput += data.toString();
          console.log("stderr:", data.toString());
        });

        stream.on("close", (code) => {
          console.log("close 코드:", code);
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: errorOutput || `Exit code: ${code}`,
            });
          }
        });

        stream.on("error", (err) => {
          console.log("stream 에러:", err.message);
          resolve({ success: false, error: err.message });
        });
      });
    });
  });
}

module.exports = {
  testConnection,
  makeDirectory,
  sendFile,
  unzipFile,
};
