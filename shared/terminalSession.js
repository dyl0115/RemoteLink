// ========================================
// shared/terminalSession.js - 터미널 세션 관리
// ========================================

const { createConnection, getShell, execWithPty } = require("./sshConnection");
const { ERROR_CODES } = require("./errorCodes");
const logger = require("./logger");

/**
 * 터미널 세션 관리자
 * - SSH/Docker 터미널 세션을 Map으로 관리
 * - 세션 생성, 데이터 전송, 리사이즈, 종료 담당
 */
class TerminalSessionManager {
  constructor() {
    // sessionId -> { conn, stream, type, serverId, containerName?, serverInfo }
    this.sessions = new Map();
    this.sessionCounter = 0;
  }

  /**
   * 새 세션 ID 생성
   * @returns {string}
   */
  _generateSessionId() {
    return `term_${++this.sessionCounter}_${Date.now()}`;
  }

  /**
   * 호스트 SSH 터미널 세션 생성
   * @param {Object} server - 서버 정보
   * @param {Function} onData - 데이터 수신 콜백 (data) => void
   * @param {Function} onClose - 세션 종료 콜백 (reason?) => void
   * @returns {Promise<{success: boolean, sessionId?: string, error?: string, code?: string}>}
   */
  async createHostSession(server, onData, onClose) {
    const sessionId = this._generateSessionId();
    const serverInfo = `${server.username}@${server.host}:${server.port}`;

    logger.info("TerminalSession", `호스트 세션 생성 시도: ${serverInfo}`, {
      sessionId,
    });

    // 1. SSH 연결 생성
    const connResult = await createConnection(server);
    if (!connResult.success) {
      return connResult;
    }

    const conn = connResult.conn;

    // 2. Shell 생성
    const shellResult = await getShell(conn);
    if (!shellResult.success) {
      conn.end();
      return shellResult;
    }

    const stream = shellResult.stream;

    // 3. 세션 저장
    this.sessions.set(sessionId, {
      conn,
      stream,
      type: "host",
      serverId: server.id,
      serverInfo,
    });

    // 4. 이벤트 바인딩
    stream.on("data", (data) => {
      onData(data.toString());
    });

    stream.on("close", () => {
      logger.info("TerminalSession", `세션 종료: ${serverInfo}`, { sessionId });
      this._cleanup(sessionId);
      onClose();
    });

    conn.on("close", () => {
      if (this.sessions.has(sessionId)) {
        logger.info("TerminalSession", `연결 닫힘: ${serverInfo}`, {
          sessionId,
        });
        this._cleanup(sessionId);
        onClose("connection closed");
      }
    });

    logger.info("TerminalSession", `호스트 세션 생성 완료: ${serverInfo}`, {
      sessionId,
    });
    return { success: true, sessionId };
  }

  /**
   * Docker 컨테이너 터미널 세션 생성
   * @param {Object} server - 서버 정보
   * @param {string} containerName - 컨테이너 이름
   * @param {Function} onData - 데이터 수신 콜백
   * @param {Function} onClose - 세션 종료 콜백
   * @returns {Promise<{success: boolean, sessionId?: string, error?: string, code?: string}>}
   */
  async createContainerSession(server, containerName, onData, onClose) {
    const sessionId = this._generateSessionId();
    const serverInfo = `${server.username}@${server.host}:${server.port}`;

    logger.info(
      "TerminalSession",
      `컨테이너 세션 생성 시도: ${containerName}@${serverInfo}`,
      { sessionId }
    );

    // 1. SSH 연결 생성
    const connResult = await createConnection(server);
    if (!connResult.success) {
      return connResult;
    }

    const conn = connResult.conn;

    // 2. docker exec -it 실행 (PTY 사용)
    const dockerCmd = `docker exec -it ${containerName} /bin/sh -c "if command -v bash > /dev/null; then bash; else sh; fi"`;
    const execResult = await execWithPty(conn, dockerCmd);

    if (!execResult.success) {
      conn.end();
      return {
        success: false,
        error: execResult.error,
        code: ERROR_CODES.DOCKER_COMMAND_FAILED,
      };
    }

    const stream = execResult.stream;

    // 3. 세션 저장
    this.sessions.set(sessionId, {
      conn,
      stream,
      type: "container",
      serverId: server.id,
      containerName,
      serverInfo,
    });

    // 4. 이벤트 바인딩
    stream.on("data", (data) => {
      onData(data.toString());
    });

    stream.on("close", () => {
      logger.info("TerminalSession", `컨테이너 세션 종료: ${containerName}`, {
        sessionId,
      });
      this._cleanup(sessionId);
      onClose();
    });

    conn.on("close", () => {
      if (this.sessions.has(sessionId)) {
        logger.info("TerminalSession", `연결 닫힘: ${serverInfo}`, {
          sessionId,
        });
        this._cleanup(sessionId);
        onClose("connection closed");
      }
    });

    logger.info(
      "TerminalSession",
      `컨테이너 세션 생성 완료: ${containerName}@${serverInfo}`,
      { sessionId }
    );
    return { success: true, sessionId };
  }

  /**
   * 세션에 데이터 쓰기 (키 입력 전송)
   * @param {string} sessionId
   * @param {string} data
   * @returns {{success: boolean, error?: string, code?: string}}
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("TerminalSession", `세션을 찾을 수 없음`, { sessionId });
      return {
        success: false,
        error: "세션을 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    try {
      session.stream.write(data);
      return { success: true };
    } catch (err) {
      logger.error("TerminalSession", `데이터 쓰기 실패`, {
        sessionId,
        error: err.message,
      });
      return {
        success: false,
        error: err.message,
        code: ERROR_CODES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * 터미널 크기 변경
   * @param {string} sessionId
   * @param {number} cols - 열 수
   * @param {number} rows - 행 수
   * @returns {{success: boolean, error?: string, code?: string}}
   */
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("TerminalSession", `세션을 찾을 수 없음`, { sessionId });
      return {
        success: false,
        error: "세션을 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    try {
      session.stream.setWindow(rows, cols, 0, 0);
      logger.debug("TerminalSession", `터미널 크기 변경`, {
        sessionId,
        cols,
        rows,
      });
      return { success: true };
    } catch (err) {
      logger.error("TerminalSession", `크기 변경 실패`, {
        sessionId,
        error: err.message,
      });
      return {
        success: false,
        error: err.message,
        code: ERROR_CODES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * 세션 종료
   * @param {string} sessionId
   * @returns {{success: boolean, error?: string, code?: string}}
   */
  close(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn("TerminalSession", `세션을 찾을 수 없음`, { sessionId });
      return {
        success: false,
        error: "세션을 찾을 수 없습니다",
        code: ERROR_CODES.NOT_FOUND,
      };
    }

    logger.info("TerminalSession", `세션 종료 요청`, {
      sessionId,
      type: session.type,
    });

    try {
      session.stream.end();
      session.conn.end();
      this._cleanup(sessionId);
      return { success: true };
    } catch (err) {
      logger.error("TerminalSession", `세션 종료 실패`, {
        sessionId,
        error: err.message,
      });
      this._cleanup(sessionId);
      return {
        success: false,
        error: err.message,
        code: ERROR_CODES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * 세션 정리 (내부용)
   * @param {string} sessionId
   */
  _cleanup(sessionId) {
    this.sessions.delete(sessionId);
    logger.debug("TerminalSession", `세션 정리 완료`, {
      sessionId,
      remainingSessions: this.sessions.size,
    });
  }

  /**
   * 모든 세션 종료 (앱 종료 시)
   */
  closeAll() {
    logger.info("TerminalSession", `모든 세션 종료`, {
      count: this.sessions.size,
    });

    for (const [sessionId, session] of this.sessions) {
      try {
        session.stream.end();
        session.conn.end();
      } catch (err) {
        logger.error("TerminalSession", `세션 종료 실패`, {
          sessionId,
          error: err.message,
        });
      }
    }

    this.sessions.clear();
  }

  /**
   * 세션 정보 조회
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      type: session.type,
      serverId: session.serverId,
      containerName: session.containerName,
      serverInfo: session.serverInfo,
    };
  }

  /**
   * 활성 세션 목록 조회
   * @returns {Array}
   */
  listSessions() {
    const list = [];
    for (const [sessionId, session] of this.sessions) {
      list.push({
        sessionId,
        type: session.type,
        serverId: session.serverId,
        containerName: session.containerName,
        serverInfo: session.serverInfo,
      });
    }
    return list;
  }
}

// 싱글톤 인스턴스
const terminalSessionManager = new TerminalSessionManager();

module.exports = terminalSessionManager;
