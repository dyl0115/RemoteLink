const path = require("path");
const os = require("os");
const { Worker } = require("worker_threads");

function compressFolder(folderPath) {
  return new Promise((resolve) => {
    const outputPath = path.join(os.tmpdir(), `remotelink-${Date.now()}.zip`);

    const worker = new Worker(path.join(__dirname, "compress-worker.js"), {
      workerData: { folderPath, outputPath },
    });

    worker.on("message", (msg) => {
      if (msg.type === "progress") {
        // 진행 상황을 보내고 싶으면 여기서 처리
        console.log(`압축 중... ${msg.entries}개 파일`);
      } else if (msg.type === "complete") {
        resolve(msg);
      } else if (msg.type === "error") {
        resolve({ success: false, error: msg.error });
      }
    });

    worker.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

module.exports = {
  compressFolder,
};
