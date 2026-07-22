const http = require("http");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { promisify } = require("util");
const { neon } = require("@neondatabase/serverless");

const scrypt = promisify(crypto.scrypt);

// ------------------------- الإعدادات والتحقق من البيئة -------------------------
const projectRoot = process.env.MR3_PROJECT_ROOT
  ? path.resolve(process.env.MR3_PROJECT_ROOT)
  : path.resolve(__dirname, "..");

const frontendRoot = process.env.MR3_FRONTEND_PATH
  ? path.resolve(process.env.MR3_FRONTEND_PATH)
  : path.join(projectRoot, "frontend");

const port = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const FINAL_JWT_SECRET = JWT_SECRET || "dev-insecure-secret-do-not-use-in-production";
const TOKEN_TTL_SECONDS = Number(process.env.MR3_TOKEN_TTL || 60 * 60 * 8);
const MAX_BODY_SIZE = Number(process.env.MAX_BODY_SIZE) || 2_000_000;

const GENERAL_RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW) || 60 * 1000;
const GENERAL_MAX_REQUESTS = Number(process.env.MAX_REQUESTS_PER_MINUTE) || 300;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const allowedOrigins = (process.env.MR3_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
const PROTECTED_FIELDS = ["createdAt", "updatedAt", "id"];

// ------------------------- الاتصال بـ Neon PostgreSQL -------------------------
const DATABASE_URL = process.env.DATABASE_URL;
let sql = null;
if (DATABASE_URL) {
  sql = neon(DATABASE_URL);
} else {
  console.warn("⚠️ تحذير: لم يتم العثور على DATABASE_URL الخاص بـ Neon في متغيرات البيئة.");
}

async function initNeonDb() {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_data (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("✅ تم الاتصال والتحقق من جداول Neon بنجاح.");
  } catch (err) {
    console.error("❌ خطأ أثناء التهيئة مع Neon DB:", err);
  }
}

// ------------------------- Security & CORS Headers -------------------------
function baseSecurityHeaders() {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  };
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  };
  if (allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  } else {
    headers["access-control-allow-origin"] = "*";
  }
  return headers;
}

function apiHeaders(req) {
  return {
    ...baseSecurityHeaders(),
    ...corsHeaders(req),
    "cache-control": "no-store, no-cache, must-revalidate, private"
  };
}

// ------------------------- Response Helpers -------------------------
async function sendJson(req, res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body, null, 2);
  const headers = { "content-type": "application/json; charset=utf-8", ...extraHeaders };
  res.writeHead(status, headers);
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error(`Request body exceeds limit.`));
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

// ------------------------- التشفير والتوكن -------------------------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return { passwordHash: derived.toString("hex"), passwordSalt: salt };
}

async function verifyPassword(password, salt, expectedHashHex) {
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHashHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function stripPassword(user) {
  if (!user) return user;
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64").toString("utf8");
}
function generateToken(user) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ id: user.id, username: user.username, role: user.role, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const signature = crypto.createHmac("sha256", FINAL_JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
function verifyToken(token) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", FINAL_JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try {
    payload = JSON.parse(base64urlDecode(body));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ------------------------- DB Neon Operations -------------------------
async function getDb() {
  if (!sql) return { users: [], auditLogs: [] };
  try {
    const result = await sql`SELECT data FROM app_data WHERE key = 'main_db'`;
    if (result.length > 0) return result[0].data;

    const { passwordHash, passwordSalt } = await hashPassword("admin123456");
    const initialDb = {
      users: [
        {
          id: "u_admin",
          name: "System Administrator",
          username: "admin",
          email: "admin@mr3.local",
          passwordHash,
          passwordSalt,
          role: "admin",
          permissions: [],
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      auditLogs: []
    };
    await writeDbRaw(initialDb);
    return initialDb;
  } catch (err) {
    console.error("❌ خطأ قراءة من Neon:", err);
    return { users: [], auditLogs: [] };
  }
}

async function writeDbRaw(data) {
  if (!sql) return;
  try {
    const jsonString = JSON.stringify(data);
    await sql`
      INSERT INTO app_data (key, data, updated_at)
      VALUES ('main_db', ${jsonString}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW();
    `;
  } catch (err) {
    console.error("❌ خطأ كتابة في Neon:", err);
  }
}

function makeId(prefix = "item") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function filterBody(body, allowedKeys = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const clean = {};
  if (allowedKeys && Array.isArray(allowedKeys)) {
    for (const key of allowedKeys) if (body[key] !== undefined) clean[key] = body[key];
  } else {
    Object.assign(clean, body);
  }
  for (const field of PROTECTED_FIELDS) delete clean[field];
  delete clean.passwordHash;
  delete clean.passwordSalt;
  return clean;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function authenticate(req) {
  const token = getBearerToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return null;
  const db = await getDb();
  return db.users.find((u) => u.id === payload.id) || null;
}

// ------------------------- API Handler -------------------------
async function handleApi(req, res, url, extraHeaders) {
  if (req.method === "OPTIONS") return sendJson(req, res, 204, {}, extraHeaders);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/health") {
    return sendJson(req, res, 200, { ok: true, service: "MR3 backend" }, extraHeaders);
  }

  // تسجيل الدخول
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const { username, password } = body;
    const db = await getDb();
    const user = db.users.find((u) => u.username === username || u.email === username);
    
    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      return sendJson(req, res, 401, { error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, extraHeaders);
    }

    const token = generateToken(user);
    return sendJson(req, res, 200, { token, user: stripPassword(user) }, extraHeaders);
  }

  const currentUser = await authenticate(req);
  const collection = parts[1];
  const id = parts[2];

  if (!collection) return sendJson(req, res, 400, { error: "Collection required." }, extraHeaders);

  const db = await getDb();
  if (!(collection in db)) db[collection] = [];

  // 1) GET قائمة
  if (req.method === "GET" && !id) {
    const rows = Array.isArray(db[collection]) ? db[collection] : [];
    return sendJson(req, res, 200, collection === "users" ? rows.map(stripPassword) : rows, extraHeaders);
  }

  // 2) GET عنصر واحد
  if (req.method === "GET" && id) {
    const item = db[collection].find((x) => x.id === id);
    if (!item) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);
    return sendJson(req, res, 200, collection === "users" ? stripPassword(item) : item, extraHeaders);
  }

  // 3) POST إنشاء
  if (req.method === "POST" && !id) {
    const rawBody = await readBody(req);
    if (collection === "users") {
      const body = filterBody(rawBody, ["username", "email", "password", "name", "role", "active", "permissions"]);
      let passwordHash = "", passwordSalt = "";
      if (body.password) {
        const h = await hashPassword(body.password);
        passwordHash = h.passwordHash;
        passwordSalt = h.passwordSalt;
      }
      const newUser = {
        id: makeId("u"),
        username: body.username || `user_${Date.now()}`,
        email: body.email || "",
        name: body.name || body.username || "مستخدم",
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        passwordHash,
        passwordSalt,
        role: body.role || "user",
        active: body.active !== undefined ? body.active : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(newUser);
      await writeDbRaw(db);
      return sendJson(req, res, 201, stripPassword(newUser), extraHeaders);
    }

    const newItem = { id: makeId(collection.slice(0, 3)), ...filterBody(rawBody), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db[collection].push(newItem);
    await writeDbRaw(db);
    return sendJson(req, res, 201, newItem, extraHeaders);
  }

  // 4) PUT أو PATCH تعديل (يدعم الحفظ وتحديث الصلاحيات بمرونة)
  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    const rawBody = await readBody(req);
    if (collection === "users") {
      const index = db.users.findIndex((u) => u.id === id);
      if (index === -1) return sendJson(req, res, 404, { error: "User not found." }, extraHeaders);

      const body = filterBody(rawBody, ["username", "email", "password", "name", "role", "active", "permissions"]);
      const updated = { ...db.users[index], ...body, updatedAt: new Date().toISOString() };
      
      if (body.password) {
        const { passwordHash, passwordSalt } = await hashPassword(body.password);
        updated.passwordHash = passwordHash;
        updated.passwordSalt = passwordSalt;
      }
      delete updated.password;

      db.users[index] = updated;
      await writeDbRaw(db);
      return sendJson(req, res, 200, stripPassword(updated), extraHeaders);
    }

    const items = db[collection] || [];
    const index = items.findIndex((x) => x.id === id);
    if (index === -1) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);

    const updated = { ...items[index], ...filterBody(rawBody), updatedAt: new Date().toISOString() };
    db[collection][index] = updated;
    await writeDbRaw(db);
    return sendJson(req, res, 200, updated, extraHeaders);
  }

  // 5) DELETE حذف
  if (req.method === "DELETE" && id) {
    if (collection === "users") db.users = db.users.filter((u) => u.id !== id);
    else db[collection] = db[collection].filter((x) => x.id !== id);
    await writeDbRaw(db);
    return sendJson(req, res, 200, { ok: true, message: "Deleted successfully." }, extraHeaders);
  }

  return sendJson(req, res, 405, { error: "Method not allowed." }, extraHeaders);
}

// ------------------------- static files -------------------------
const fs = require("fs").promises;
async function handleStatic(req, res, corsAndSecurityHeaders) {
  const clean = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "login.html";
  const full = path.resolve(frontendRoot, clean);
  try {
    let target = full;
    const stat = await fs.stat(target).catch(() => null);
    if (stat && stat.isDirectory()) target = path.join(target, "index.html");

    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, { "content-type": mime[ext] || "application/octet-stream", ...corsAndSecurityHeaders });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...corsAndSecurityHeaders });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const security = baseSecurityHeaders();
  const cors = corsHeaders(req);
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/") {
      res.writeHead(302, { Location: "/login.html", ...security, ...cors });
      return res.end();
    }
    if (url.pathname.startsWith("/api")) return await handleApi(req, res, url, apiHeaders(req));
    return await handleStatic(req, res, { ...security, ...cors });
  } catch (error) {
    return sendJson(req, res, 500, { error: "Internal server error." }, { ...security, ...cors });
  }
});

initNeonDb().then(() => {
  server.listen(port, () => console.log(`🚀 Server running on port ${port}`));
});

module.exports = server;
