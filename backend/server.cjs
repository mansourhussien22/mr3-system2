const http = require("http");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const fs = require("fs").promises;
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

if (!JWT_SECRET) {
  console.warn(
    "⚠️ تحذير أمني: JWT_SECRET غير موجود في متغيرات البيئة. السيرفر يعمل بـ JWT_SECRET افتراضي غير آمن."
  );
}

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
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];

// ------------------------- الاتصال بـ Neon PostgreSQL -------------------------
const DATABASE_URL = process.env.DATABASE_URL;
let sql = null;
if (DATABASE_URL) {
  sql = neon(DATABASE_URL);
} else {
  console.warn("⚠️ تحذير: لم يتم العثور على DATABASE_URL الخاص بـ Neon.");
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

// ------------------------- Rate Limiting -------------------------
const generalLimits = new Map();
function isGeneralRateLimited(ip) {
  const now = Date.now();
  const entry = generalLimits.get(ip);
  if (!entry || now > entry.resetTime) {
    generalLimits.set(ip, { count: 1, resetTime: now + GENERAL_RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > GENERAL_MAX_REQUESTS;
}

const loginAttempts = new Map();
function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

// ------------------------- Security & CORS Headers -------------------------
function baseSecurityHeaders() {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self';",
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
  } else if (origin) {
    headers["access-control-allow-origin"] = origin;
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
  const acceptEncoding = req.headers["accept-encoding"] || "";

  if (acceptEncoding.includes("gzip") && payload.length > 1024) {
    const compressed = await new Promise((resolve, reject) =>
      zlib.gzip(payload, (err, out) => (err ? reject(err) : resolve(out)))
    );
    headers["content-encoding"] = "gzip";
    res.writeHead(status, headers);
    res.end(compressed);
  } else {
    res.writeHead(status, headers);
    res.end(payload);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error(`Request body exceeds limit of ${MAX_BODY_SIZE} bytes.`));
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
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

function generateSecurePassword(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
  return Array.from({ length }, () => chars[crypto.randomInt(chars.length)]).join("");
}

function stripPassword(user) {
  if (!user) return user;
  const { passwordHash, passwordSalt, ...rest } = user;
  rest.permissions = Array.isArray(rest.permissions) ? rest.permissions : [];
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
  const body = base64url(JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  }));
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

// ------------------------- التعامل مع قاعدة البيانات -------------------------
async function getDb() {
  if (!sql) return { users: [], auditLogs: [] };
  try {
    const result = await sql`SELECT data FROM app_data WHERE key = 'main_db'`;
    if (result.length > 0) {
      const dbData = result[0].data;
      if (!Array.isArray(dbData.users)) dbData.users = [];
      if (!Array.isArray(dbData.auditLogs)) dbData.auditLogs = [];
      return dbData;
    }

    const defaultPassword = generateSecurePassword(16);
    const { passwordHash, passwordSalt } = await hashPassword(defaultPassword);
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
          mustChangePassword: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      auditLogs: []
    };
    await writeDbRaw(initialDb);
    console.log(`🔐 تم إنشاء حساب admin افتراضي في Neon. Password: ${defaultPassword}`);
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

function recordAudit(db, action, user, details) {
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  db.auditLogs.push({
    id: `audit_${crypto.randomUUID()}`,
    action,
    performedBy: user ? `${user.username || user.email} (${user.id})` : "SYSTEM",
    details,
    createdAt: new Date().toISOString()
  });
}

function filterBody(body, allowedKeys = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const clean = Object.create(null);

  const sourceKeys = allowedKeys && Array.isArray(allowedKeys)
    ? allowedKeys
    : Object.keys(body);

  for (const key of sourceKeys) {
    if (DANGEROUS_KEYS.includes(key)) continue;
    if (body[key] !== undefined) clean[key] = body[key];
  }

  for (const field of PROTECTED_FIELDS) delete clean[field];
  delete clean.passwordHash;
  delete clean.passwordSalt;

  return { ...clean };
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (!header) return null;
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return header.trim();
}

async function authenticate(req) {
  const token = getBearerToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return { user: null, db: null };

  const db = await getDb();
  const user = db.users.find((u) => u.id === payload.id);
  if (user && user.active !== false) return { user, db };
  return { user: null, db };
}

async function requireAuth(req, res, extraHeaders) {
  const { user, db } = await authenticate(req);
  if (!user) {
    await sendJson(req, res, 401, { error: "Unauthorized. Please login." }, extraHeaders);
    return null;
  }
  return { user, db };
}

function isAdmin(user) {
  return user && user.role === "admin";
}

// ------------------------- مسارات الـ API -------------------------
async function handleApi(req, res, url, extraHeaders) {
  if (req.method === "OPTIONS") return sendJson(req, res, 204, {}, extraHeaders);

  const ip = clientIp(req);
  if (isGeneralRateLimited(ip)) {
    return sendJson(req, res, 429, { error: "طلبات كتير جدًا. حاول تاني بعد شوية." }, extraHeaders);
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/health") {
    return sendJson(req, res, 200, { ok: true, service: "MR3 backend connected to Neon DB" }, extraHeaders);
  }

  // Auth Login
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    if (isLoginRateLimited(ip)) {
      return sendJson(req, res, 429, { error: "محاولات كتير جدًا. حاول تاني بعد شوية." }, extraHeaders);
    }
    const body = await readBody(req);
    const { username, password } = body;
    if (!username || !password) {
      return sendJson(req, res, 400, { error: "Username and password are required." }, extraHeaders);
    }
    const db = await getDb();
    const user = db.users.find((u) => u.username === username || u.email === username);
    const dummySalt = "0".repeat(32);
    const dummyHash = "0".repeat(128);
    const valid = user
      ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
      : await verifyPassword(password, dummySalt, dummyHash);

    if (!user || !valid) {
      return sendJson(req, res, 401, { error: "Invalid credentials." }, extraHeaders);
    }
    if (user.active === false) {
      return sendJson(req, res, 403, { error: "Account is deactivated. Contact admin." }, extraHeaders);
    }

    const token = generateToken(user);
    return sendJson(req, res, 200, { token, user: stripPassword(user) }, extraHeaders);
  }

  // Auth Me
  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const auth = await requireAuth(req, res, extraHeaders);
    if (!auth) return;
    return sendJson(req, res, 200, stripPassword(auth.user), extraHeaders);
  }

  const collection = parts[1];
  const id = parts[2];
  if (!collection) return sendJson(req, res, 400, { error: "Collection is required." }, extraHeaders);

  const auth = await requireAuth(req, res, extraHeaders);
  if (!auth) return;
  const { user: currentUser, db } = auth;

  if (!(collection in db)) {
    if (req.method === "GET") return sendJson(req, res, 200, [], extraHeaders);
  }

  // 1) GET List
  if (req.method === "GET" && !id) {
    const rows = Array.isArray(db[collection]) ? db[collection] : [];
    const safeRows = collection === "users" ? rows.map(stripPassword) : rows;
    return sendJson(req, res, 200, safeRows, extraHeaders);
  }

  // 2) GET Single Item
  if (req.method === "GET" && id) {
    const item = Array.isArray(db[collection]) ? db[collection].find((x) => x.id === id) : null;
    if (!item) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);
    return sendJson(req, res, 200, collection === "users" ? stripPassword(item) : item, extraHeaders);
  }

  // 3) POST Create (معالجة مرنة مخصصة للمستخدمين)
  if (req.method === "POST" && !id) {
    const rawBody = await readBody(req);
    if (collection === "users") {
      if (!isAdmin(currentUser)) {
        return sendJson(req, res, 403, { error: "Forbidden. Admin rights required." }, extraHeaders);
      }

      const username = rawBody.username || rawBody.userName || (rawBody.email ? rawBody.email.split("@")[0] : `user_${Date.now()}`);
      const email = rawBody.email || rawBody.userEmail || `${username}@mr3.local`;
      const name = rawBody.name || rawBody.fullName || username;
      const role = (rawBody.role || "user").toLowerCase();
      const permissions = Array.isArray(rawBody.permissions) ? rawBody.permissions : [];

      const isDuplicate = db.users.some(
        (u) => u.username?.toLowerCase() === username.toLowerCase() || u.email?.toLowerCase() === email.toLowerCase()
      );

      if (isDuplicate) {
        return sendJson(req, res, 409, { error: "اسم المستخدم أو البريد الإلكتروني مسجل بالفعل." }, extraHeaders);
      }

      const passToHash = rawBody.password && String(rawBody.password).trim().length > 0 
        ? String(rawBody.password) 
        : "12345678";
        
      const { passwordHash, passwordSalt } = await hashPassword(passToHash);
      
      const newUser = {
        id: makeId("u"),
        username,
        email,
        name,
        role,
        permissions,
        passwordHash,
        passwordSalt,
        active: rawBody.active !== undefined ? Boolean(rawBody.active) : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.users.push(newUser);
      recordAudit(db, "USER_CREATED", currentUser, { targetId: newUser.id, username: newUser.username });
      await writeDbRaw(db);
      
      return sendJson(req, res, 201, stripPassword(newUser), extraHeaders);
    }

    const cleanData = filterBody(rawBody);
    const newItem = {
      id: cleanData.id || makeId(collection.slice(0, 3)),
      ...cleanData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!Array.isArray(db[collection])) db[collection] = [];
    db[collection].push(newItem);
    recordAudit(db, `${collection.toUpperCase()}_CREATED`, currentUser, { id: newItem.id });
    await writeDbRaw(db);
    return sendJson(req, res, 201, newItem, extraHeaders);
  }

  // 4) PATCH or PUT Update
  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    const rawBody = await readBody(req);
    if (collection === "users") {
      if (!isAdmin(currentUser)) {
        return sendJson(req, res, 403, { error: "Forbidden. Admin rights required." }, extraHeaders);
      }
      const index = db.users.findIndex((u) => u.id === id);
      if (index === -1) return sendJson(req, res, 404, { error: "User not found." }, extraHeaders);

      const username = rawBody.username || rawBody.userName || db.users[index].username;
      const email = rawBody.email || rawBody.userEmail || db.users[index].email;
      const name = rawBody.name || rawBody.fullName || db.users[index].name;
      const role = rawBody.role ? String(rawBody.role).toLowerCase() : db.users[index].role;
      const permissions = Array.isArray(rawBody.permissions) ? rawBody.permissions : db.users[index].permissions;

      const updated = {
        ...db.users[index],
        username,
        email,
        name,
        role,
        permissions,
        active: rawBody.active !== undefined ? Boolean(rawBody.active) : db.users[index].active,
        updatedAt: new Date().toISOString()
      };

      if (rawBody.password && String(rawBody.password).trim().length > 0) {
        const { passwordHash, passwordSalt } = await hashPassword(String(rawBody.password));
        updated.passwordHash = passwordHash;
        updated.passwordSalt = passwordSalt;
      }

      db.users[index] = updated;
      recordAudit(db, "USER_UPDATED", currentUser, { targetId: id });
      await writeDbRaw(db);
      return sendJson(req, res, 200, stripPassword(updated), extraHeaders);
    }

    const items = Array.isArray(db[collection]) ? db[collection] : [];
    const index = items.findIndex((x) => x.id === id);
    if (index === -1) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);

    const cleanData = filterBody(rawBody);
    const updated = { ...items[index], ...cleanData, updatedAt: new Date().toISOString() };
    db[collection][index] = updated;
    recordAudit(db, `${collection.toUpperCase()}_UPDATED`, currentUser, { id });
    await writeDbRaw(db);
    return sendJson(req, res, 200, updated, extraHeaders);
  }

  // 5) DELETE
  if (req.method === "DELETE" && id) {
    if (collection === "users") {
      if (!isAdmin(currentUser)) {
        return sendJson(req, res, 403, { error: "Forbidden. Admin rights required." }, extraHeaders);
      }
      db.users = db.users.filter((u) => u.id !== id);
      recordAudit(db, "USER_DELETED", currentUser, { targetId: id });
      await writeDbRaw(db);
      return sendJson(req, res, 200, { ok: true, message: "User deleted successfully." }, extraHeaders);
    }

    if (Array.isArray(db[collection])) {
      db[collection] = db[collection].filter((x) => x.id !== id);
      recordAudit(db, `${collection.toUpperCase()}_DELETED`, currentUser, { id });
      await writeDbRaw(db);
      return sendJson(req, res, 200, { ok: true, message: "Item deleted successfully." }, extraHeaders);
    }
  }

  return sendJson(req, res, 405, { error: "Method not allowed." }, extraHeaders);
}

// ------------------------- Static Files Handling -------------------------
async function handleStatic(req, res, corsAndSecurityHeaders) {
  const clean = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "login.html";
  const full = path.resolve(frontendRoot, clean);

  const isInsideFrontend = full === frontendRoot || full.startsWith(frontendRoot + path.sep);

  if (!isInsideFrontend) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8", ...corsAndSecurityHeaders });
    return res.end("Forbidden");
  }

  try {
    let target = full;
    const stat = await fs.stat(target).catch(() => null);
    if (stat && stat.isDirectory()) target = path.join(target, "index.html");

    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const headers = {
      "content-type": mime[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      ...corsAndSecurityHeaders
    };
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...corsAndSecurityHeaders });
    res.end("Not found");
  }
}

// ------------------------- تشغيل السيرفر -------------------------
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
    console.error(`[Error] Unhandled server error:`, error);
    return sendJson(req, res, 500, { error: "Internal server error." }, { ...security, ...cors });
  }
});

initNeonDb().then(() => {
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port} connected to Neon DB`);
  });
});

module.exports = server;
