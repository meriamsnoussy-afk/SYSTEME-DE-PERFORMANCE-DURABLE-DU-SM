const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = __dirname;
const dataDir = path.join(root, "data");
const stateFile = path.join(dataDir, "server-state.json");
const seedFile = path.join(root, "assets", "seed-data.json");
const port = Number(process.env.PORT || 8770);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function ensureState() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(stateFile)) {
    const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
    fs.writeFileSync(stateFile, JSON.stringify({ data: seed, responses: [], limitAnswers: {} }, null, 2), "utf8");
  }
}

function readState() {
  ensureState();
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

function sendJson(res, payload) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
      res.end();
      return;
    }
    if (req.url === "/api/state" && req.method === "GET") return sendJson(res, readState());
    if (req.url === "/api/responses" && req.method === "POST") {
      const incoming = await readBody(req);
      const state = readState();
      state.responses = state.responses || [];
      if (!state.responses.some((item) => item.id === incoming.id)) state.responses.push(incoming);
      writeState(state);
      return sendJson(res, { ok: true, responses: state.responses });
    }
    if (req.url === "/api/limits" && req.method === "POST") {
      const incoming = await readBody(req);
      const state = readState();
      state.limitAnswers = incoming || {};
      writeState(state);
      return sendJson(res, { ok: true, limitAnswers: state.limitAnswers });
    }
    if (req.url === "/api/data" && req.method === "POST") {
      const incoming = await readBody(req);
      const state = readState();
      state.data = incoming;
      writeState(state);
      return sendJson(res, { ok: true, data: state.data });
    }
    serveFile(req, res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
});

server.listen(port, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
  console.log(`Serveur actif sur http://localhost:${port}/`);
  ips.forEach((ip) => console.log(`Acces reseau: http://${ip}:${port}/`));
});
