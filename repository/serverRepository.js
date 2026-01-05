const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { ERROR_CODES } = require("../shared/errorCodes");

// 데이터 저장 경로: C:\Users\{사용자}\AppData\Roaming\remote-link\servers.json
const DATA_DIR = path.join(app.getPath("userData"), "data");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");

class ServerRepository {
  constructor() {
    this._ensureDataDir();
  }

  // 데이터 폴더 없으면 생성
  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SERVERS_FILE)) {
      fs.writeFileSync(SERVERS_FILE, "[]", "utf-8");
    }
  }

  // 전체 서버 목록 조회
  findAll() {
    try {
      const data = fs.readFileSync(SERVERS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      console.error("[ServerRepository] findAll 실패:", err);
      return [];
    }
  }

  // ID로 서버 조회
  findById(id) {
    try {
      const servers = this.findAll();
      return servers.find((s) => s.id === id) || null;
    } catch (err) {
      console.error("[ServerRepository] findById 실패:", err);
      return null;
    }
  }

  // 서버 저장 (추가 or 수정)
  save(server) {
    try {
      const servers = this.findAll();

      if (server.id) {
        // 수정
        const index = servers.findIndex((s) => s.id === server.id);
        if (index !== -1) {
          servers[index] = { ...servers[index], ...server };
        }
      } else {
        // 추가
        server.id = this._generateId();
        server.createdAt = new Date().toISOString();
        servers.push(server);
      }

      this._writeFile(servers);
      return { success: true, data: server };
    } catch (err) {
      console.error("[ServerRepository] save 실패:", err);
      return {
        success: false,
        error: "서버 정보 저장에 실패했습니다",
        code: ERROR_CODES.FILE_WRITE_ERROR,
      };
    }
  }

  // 서버 삭제
  delete(id) {
    try {
      const servers = this.findAll();
      const filtered = servers.filter((s) => s.id !== id);
      this._writeFile(filtered);
      return { success: true };
    } catch (err) {
      console.error("[ServerRepository] delete 실패:", err);
      return {
        success: false,
        error: "서버 삭제에 실패했습니다",
        code: ERROR_CODES.FILE_WRITE_ERROR,
      };
    }
  }

  // 파일에 쓰기
  _writeFile(data) {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2), "utf-8");
  }

  // ID 생성
  _generateId() {
    return "srv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = new ServerRepository();
