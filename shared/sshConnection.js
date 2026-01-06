// ========================================
// shared/sshConnection.js - SSH 연결 공통 모듈
// ========================================

const { Client } = require("ssh2");
const fs = require("fs");
const { ERROR_CODES, ERROR_MESSAGES } = require("./errorCodes");
const logger = require("./logger");

const CONNECTION_TIMEOUT_MS = 10000;

/**
 * SSH 설정 객체 생성
 * @param {Object} server - 서버 정보
 * @returns {Object} SSH 연결 설정
 */
function buildConfig(server) {
  const config = {
    host: server.host,
    port: server.port,
    username: server.username,
  };

  if (server.keyFile) {
    config.privateKey = fs.readFileSync(server.keyFile);
  }

  return config;
}

/**
 * SSH 연결을 생성하고 작업을 수행하는 헬퍼
 *
 * @param {Object} server - 서버 정보 { host, port, username, keyFile? }
 * @param {Function} onReady - 연결 성공 시 콜백 (conn) => Promise<Result>
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
async function withConnection(server, onReady) {
  return new Promise((resolve) => {
    const conn = new Client();
    const serverInfo = `${server.username}@${server.host}:${server.port}`;

    logger.debug("SSHConnection", `연결 시도: ${serverInfo}`);

    const timeout = setTimeout(() => {
      logger.warn("SSHConnection", `연결 타임아웃: ${serverInfo}`);
      conn.end();
      resolve({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.CONNECTION_TIMEOUT],
        code: ERROR_CODES.CONNECTION_TIMEOUT,
      });
    }, CONNECTION_TIMEOUT_MS);

    conn.on("ready", async () => {
      clearTimeout(timeout);
      logger.debug("SSHConnection", `연결 성공: ${serverInfo}`);

      try {
        const result = await onReady(conn);
        conn.end();
        resolve(result);
      } catch (err) {
        logger.error("SSHConnection", `작업 중 에러: ${serverInfo}`, {
          error: err.message,
        });
        conn.end();
        resolve({
          success: false,
          error: err.message,
          code: ERROR_CODES.UNKNOWN_ERROR,
        });
      }
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      logger.error("SSHConnection", `연결 에러: ${serverInfo}`, {
        error: err.message,
      });
      conn.end();
      resolve({
        success: false,
        error: err.message,
        code: ERROR_CODES.CONNECTION_REFUSED,
      });
    });

    try {
      conn.connect(buildConfig(server));
    } catch (err) {
      clearTimeout(timeout);
      logger.error("SSHConnection", `연결 설정 에러: ${serverInfo}`, {
        error: err.message,
      });
      resolve({
        success: false,
        error: err.message,
        code: ERROR_CODES.UNKNOWN_ERROR,
      });
    }
  });
}

/**
 * SFTP 세션을 생성하는 헬퍼
 *
 * @param {Object} conn - SSH 연결 객체
 * @returns {Promise<{success: boolean, sftp?: Object, error?: string}>}
 */
function getSftp(conn) {
  return new Promise((resolve) => {
    logger.debug("SSHConnection", "SFTP 세션 생성 시도");

    conn.sftp((err, sftp) => {
      if (err) {
        logger.error("SSHConnection", "SFTP 세션 생성 실패", {
          error: err.message,
        });
        resolve({
          success: false,
          error: err.message,
          code: ERROR_CODES.SSH_AUTH_FAILED,
        });
        return;
      }

      logger.debug("SSHConnection", "SFTP 세션 생성 성공");
      resolve({ success: true, sftp });
    });
  });
}

/**
 * SSH 명령어 실행 헬퍼
 *
 * @param {Object} conn - SSH 연결 객체
 * @param {string} command - 실행할 명령어
 * @returns {Promise<{success: boolean, stdout?: string, stderr?: string, code?: number}>}
 */
function execCommand(conn, command) {
  return new Promise((resolve) => {
    logger.debug("SSHConnection", `명령어 실행: ${command}`);

    conn.exec(command, (err, stream) => {
      if (err) {
        logger.error("SSHConnection", "명령어 실행 실패", {
          command,
          error: err.message,
        });
        resolve({
          success: false,
          error: err.message,
          code: ERROR_CODES.UNKNOWN_ERROR,
        });
        return;
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (data) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      stream.on("close", (exitCode) => {
        if (exitCode === 0) {
          logger.debug("SSHConnection", `명령어 성공: ${command}`, {
            exitCode,
          });
          resolve({ success: true, stdout, stderr, exitCode });
        } else {
          logger.warn("SSHConnection", `명령어 실패: ${command}`, {
            exitCode,
            stderr,
          });
          resolve({
            success: false,
            error: stderr || `Exit code: ${exitCode}`,
            stdout,
            stderr,
            exitCode,
          });
        }
      });
    });
  });
}

/**
 * SSH 연결 생성 (연결 유지용 - 터미널 등)
 * - withConnection과 달리 conn.end()를 호출하지 않음
 * - 호출자가 직접 conn.end() 해야 함
 *
 * @param {Object} server - 서버 정보
 * @returns {Promise<{success: boolean, conn?: Client, error?: string, code?: string}>}
 */
function createConnection(server) {
  return new Promise((resolve) => {
    const conn = new Client();
    const serverInfo = `${server.username}@${server.host}:${server.port}`;

    logger.debug("SSHConnection", `연결 생성 시도: ${serverInfo}`);

    const timeout = setTimeout(() => {
      logger.warn("SSHConnection", `연결 타임아웃: ${serverInfo}`);
      conn.end();
      resolve({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.CONNECTION_TIMEOUT],
        code: ERROR_CODES.CONNECTION_TIMEOUT,
      });
    }, CONNECTION_TIMEOUT_MS);

    conn.on("ready", () => {
      clearTimeout(timeout);
      logger.debug("SSHConnection", `연결 생성 성공: ${serverInfo}`);
      resolve({ success: true, conn });
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      logger.error("SSHConnection", `연결 에러: ${serverInfo}`, {
        error: err.message,
      });
      resolve({
        success: false,
        error: err.message,
        code: ERROR_CODES.CONNECTION_REFUSED,
      });
    });

    try {
      conn.connect(buildConfig(server));
    } catch (err) {
      clearTimeout(timeout);
      logger.error("SSHConnection", `연결 설정 에러: ${serverInfo}`, {
        error: err.message,
      });
      resolve({
        success: false,
        error: err.message,
        code: ERROR_CODES.UNKNOWN_ERROR,
      });
    }
  });
}

/**
 * Interactive Shell 생성
 * @param {Object} conn - SSH 연결 객체
 * @returns {Promise<{success: boolean, stream?: Object, error?: string, code?: string}>}
 */
function getShell(conn) {
  return new Promise((resolve) => {
    logger.debug("SSHConnection", "Shell 세션 생성 시도");

    conn.shell({ term: "xterm-256color" }, (err, stream) => {
      if (err) {
        logger.error("SSHConnection", "Shell 세션 생성 실패", {
          error: err.message,
        });
        resolve({
          success: false,
          error: err.message,
          code: ERROR_CODES.UNKNOWN_ERROR,
        });
        return;
      }

      logger.debug("SSHConnection", "Shell 세션 생성 성공");
      resolve({ success: true, stream });
    });
  });
}

/**
 * PTY를 사용하는 명령어 실행 (docker exec -it 등)
 * @param {Object} conn - SSH 연결 객체
 * @param {string} command - 실행할 명령어
 * @returns {Promise<{success: boolean, stream?: Object, error?: string, code?: string}>}
 */
function execWithPty(conn, command) {
  return new Promise((resolve) => {
    logger.debug("SSHConnection", `PTY 명령어 실행: ${command}`);

    conn.exec(command, { pty: { term: "xterm-256color" } }, (err, stream) => {
      if (err) {
        logger.error("SSHConnection", "PTY 명령어 실행 실패", {
          command,
          error: err.message,
        });
        resolve({
          success: false,
          error: err.message,
          code: ERROR_CODES.UNKNOWN_ERROR,
        });
        return;
      }

      logger.debug("SSHConnection", `PTY 명령어 실행 성공: ${command}`);
      resolve({ success: true, stream });
    });
  });
}

module.exports = {
  withConnection,
  createConnection,
  getSftp,
  getShell,
  execCommand,
  execWithPty,
  CONNECTION_TIMEOUT_MS,
};
