import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { WebSocketServer } from "ws";
import Database from "better-sqlite3";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.APP_TOKEN;
if (!TOKEN || TOKEN.length < 24) {
  throw new Error("Set APP_TOKEN in .env to a random secret of at least 24 characters.");
}
const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/app.sqlite");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS qr_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    expires_at TEXT,
    source TEXT DEFAULT 'phone-camera',
    UNIQUE(payload, first_seen_at)
  );
  CREATE INDEX IF NOT EXISTS idx_qr_events_seen ON qr_events(first_seen_at DESC);
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  );
`);

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(express.json({ limit: "32kb" }));

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function authorized(req) {
  return safeEqual(req.headers.authorization?.replace(/^Bearer\s+/i, ""), TOKEN);
}
function requireAuth(req, res, next) {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
}
function log(kind, detail = "") {
  db.prepare("INSERT INTO activity_log(kind, detail, created_at) VALUES (?, ?, ?)")
    .run(kind, String(detail).slice(0, 500), new Date().toISOString());
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.get("/api/events", requireAuth, (_req, res) => {
  const rows = db.prepare("SELECT * FROM qr_events ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});
app.get("/api/stats", requireAuth, (_req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS n FROM qr_events").get().n;
  const today = db.prepare("SELECT COUNT(*) AS n FROM qr_events WHERE date(first_seen_at)=date('now')").get().n;
  res.json({ total, today });
});
app.post("/api/qr", requireAuth, (req, res) => {
  const payload = String(req.body?.payload || "").trim();
  if (!payload || payload.length > 4096) return res.status(400).json({ error: "Invalid QR payload" });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30_000).toISOString();
  const existing = db.prepare(`
    SELECT id FROM qr_events
    WHERE payload = ? AND first_seen_at >= ?
    ORDER BY id DESC LIMIT 1
  `).get(payload, new Date(now.getTime() - 30_000).toISOString());
  if (existing) return res.json({ accepted: false, duplicate: true, id: existing.id });

  const result = db.prepare(
    "INSERT INTO qr_events(payload, first_seen_at, expires_at) VALUES (?, ?, ?)"
  ).run(payload, now.toISOString(), expiresAt);
  log("qr_detected", `QR event ${result.lastInsertRowid}`);
  res.status(201).json({ accepted: true, id: result.lastInsertRowid, first_seen_at: now.toISOString(), expires_at: expiresAt });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws") return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});
wss.on("connection", ws => {
  let authenticated = false;
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return ws.close(1003, "Invalid JSON"); }
    if (!authenticated) {
      authenticated = msg.type === "auth" && safeEqual(msg.token, TOKEN);
      if (!authenticated) return ws.close(1008, "Unauthorized");
      ws.send(JSON.stringify({ type: "ready" }));
      return;
    }
    if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`QR Score Manager listening on :${PORT}`);
});
