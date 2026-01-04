const { Client } = require("ssh2");
const fs = require("fs");
const { resolve } = require("path");

/**
 * SSH 연결 테스트
 * @param {Object} server - 서버 정보
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function testConnection(server) {
  return new Promise((resolve) => {
    const conn = new Client();

    // 타임아웃 설정 (10초)
    const timeout = setTimeout(() => {
      conn.end();
      resolve({ success: false, error: "연결 시간 초과 (10초)" });
    }, 10000);

    // 연결 성공
    conn.on("ready", () => {
      clearTimeout(timeout);
      conn.end();
      resolve({ success: true });
    });

    // 연결 실패
    conn.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });

    // 연결 시도
    try {
      const config = {
        host: server.host,
        port: server.port,
        username: server.username,
      };

      // 키 파일이 있으면 사용
      if (server.keyFile) {
        config.privateKey = fs.readFileSync(server.keyFile);
      }

      conn.connect(config);
    } catch (err) {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * SSH 파일 전송
 * @param {Object} server - 서버 정보
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendFile(server, localPath, remotePath) {
  return new Promise((resolve) => {
    const conn = new Client();

    // 타임 아웃 (10초)
    const timeout = setTimeout(() => {
      conn.end();
      resolve({ success: false, error: "연결 시간 초과 (10초)" });
    }, 10000);

    // 연결 성공
    conn.on("ready", () => {
      clearTimeout(timeout);

      // 파일 전송
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          resolve({ success: false, error: err.message });
        }

        sftp.fastPut(localPath, remotePath, (err) => {
          conn.end();
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    });

    // 연결 실패
    conn.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });

    // 연결 시도
    try {
      const config = {
        host: server.host,
        port: server.port,
        username: server.username,
      };

      // 키 파일이 있으면 사용
      if (server.keyFile) {
        config.privateKey = fs.readFileSync(server.keyFile);
      }

      conn.connect(config);
    } catch (err) {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    }
  });
}

module.exports = {
  testConnection,
  sendFile,
};
