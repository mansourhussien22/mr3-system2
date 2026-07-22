const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { neon } = require("@neondatabase/serverless");

const scrypt = promisify(crypto.scrypt);

const projectRoot = process.env.MR3_PROJECT_ROOT ? path.resolve(process.env.MR3_PROJECT_ROOT) : path.resolve(__dirname, "..");
const frontendRoot = process.env.MR3_FRONTEND_PATH ? path.resolve(process.env.MR3_FRONTEND_PATH) : path.join(projectRoot, "frontend");
const port = Number(process.env.PORT || 3000);
const FINAL_JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-do-not-use-in-production";
const TOKEN_TTL_SECONDS = Number(process.env.MR3_TOKEN_TTL || 60 * 60 * 8);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const DATABASE_URL = process.env.DATABASE_URL;
let sql = DATABASE_URL ? neon(DATABASE_URL) : null;

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
    console.log("✅ Neon DB Ready");
  } catch (err) {
    console.error("❌ Neon DB Error:", err);
  }
}

function baseHeaders() {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  };
}

async function sendJson(req, res, status, body) {
  res.writeHead(status, { ...baseHeaders(), "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } 
      catch { resolve({}); }
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password || "12345678", salt, 64);
  return { passwordHash: derived.toString("hex"), passwordSalt: salt };
}

async function verifyPassword(password, salt, expectedHashHex) {
  try {
    const derived = await scrypt(password, salt, 64);
    const expected = Buffer.from(expectedHashHex, "hex");
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch { return false; }
}

function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ 
    id: user.id, username: user.username, role: user.role, permissions: user.permissions || [], iat: now, exp: now + TOKEN_TTL_SECONDS 
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", FINAL_JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safeUser } = user;
  safeUser.permissions = Array.isArray(safeUser.permissions) ? safeUser.permissions : [];
  return safeUser;
}

async function getDb() {
  if (!sql) return { users: [] };
  try {
    const result = await sql`SELECT data FROM app_data WHERE key = 'main_db'`;
    if (result.length > 0) return result[0].data;

    const { passwordHash, passwordSalt } = await hashPassword("admin123456");
    const initialDb = {
      users: [{
        id: "u_admin", name: "System Administrator", username: "admin", email: "admin@mr3.local",
        passwordHash, passwordSalt, role: "admin", permissions: ["all"], active: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }]
    };
    await writeDbRaw(initialDb);
    return initialDb;
  } catch (err) {
    return { users: [] };
  }
}

async function writeDbRaw(data) {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO app_data (key, data, updated_at)
      VALUES ('main_db', ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;
  } catch (err) {
    console.error("❌ Write Error:", err);
  }
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, baseHeaders());
    return res.end();
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const collection = parts[1];
  const id = parts[2];

  // Login Endpoint
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const { username, password } = await readBody(req);
    const db = await getDb();
    const user = db.users.find((u) => u.username === username || u.email === username);

    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      return sendJson(req, res, 401, { error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    const token = generateToken(user);
    return sendJson(req, res, 200, { token, user: sanitizeUser(user) });
  }

  const db = await getDb();
  if (!(collection in db)) db[collection] = [];

  // GET Users / Items
  if (req.method === "GET") {
    if (id) {
      const item = db[collection].find((x) => x.id === id);
      if (!item) return sendJson(req, res, 404, { error: "غير موجود" });
      return sendJson(req, res, 200, collection === "users" ? sanitizeUser(item) : item);
    }
    const list = db[collection] || [];
    return sendJson(req, res, 200, collection === "users" ? list.map(sanitizeUser) : list);
  }

  // CREATE (POST)
  if (req.method === "POST") {
    const body = await readBody(req);
    if (collection === "users") {
      const username = body.username || body.email?.split("@")[0] || `user_${Date.now()}`;
      const email = body.email || `${username}@mr3.local`;
      const pwd = body.password || "12345678";

      const { passwordHash, passwordSalt } = await hashPassword(pwd);
      const newUser = {
        id: `u_${Date.now()}`,
        username,
        email,
        name: body.name || username,
        role: body.role || "user",
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        active: body.active !== undefined ? body.active : true,
        passwordHash,
        passwordSalt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.users.push(newUser);
      await writeDbRaw(db);
      return sendJson(req, res, 201, sanitizeUser(newUser));
    }

    const newItem = { id: `item_${Date.now()}`, ...body, createdAt: new Date().toISOString() };
    db[collection].push(newItem);
    await writeDbRaw(db);
    return sendJson(req, res, 201, newItem);
  }

  // UPDATE (PUT/PATCH)
  if (req.method === "PUT" || req.method === "PATCH") {
    const body = await readBody(req);
    if (collection === "users") {
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) return sendJson(req, res, 404, { error: "المستخدم غير موجود" });

      const target = db.users[idx];
      if (body.password) {
        const { passwordHash, passwordSalt } = await hashPassword(body.password);
        target.passwordHash = passwordHash;
        target.passwordSalt = passwordSalt;
      }

      target.name = body.name !== undefined ? body.name : target.name;
      target.email = body.email !== undefined ? body.email : target.email;
      target.role = body.role !== undefined ? body.role : target.role;
      target.permissions = Array.isArray(body.permissions) ? body.permissions : target.permissions;
      target.active = body.active !== undefined ? body.active : target.active;
      target.updatedAt = new Date().toISOString();

      db.users[idx] = target;
      await writeDbRaw(db);
      return sendJson(req, res, 200, sanitizeUser(target));
    }

    const idx = db[collection].findIndex((x) => x.id === id);
    if (idx !== -1) {
      db[collection][idx] = { ...db[collection][idx], ...body, updatedAt: new Date().toISOString() };
      await writeDbRaw(db);
      return sendJson(req, res, 200, db[collection][idx]);
    }
  }

  // DELETE
  if (req.method === "DELETE" && id) {
    db[collection] = db[collection].filter((x) => x.id !== id);
    await writeDbRaw(db);
    return sendJson(req, res, 200, { ok: true });
  }

  return sendJson(req, res, 405, { error: "Method not allowed" });
}

const fs = require("fs").promises;
async function handleStatic(req, res) {
  const clean = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "login.html";
  const full = path.resolve(frontendRoot, clean);
  try {
    let target = full;
    const stat = await fs.stat(target).catch(() => null);
    if (stat && stat.isDirectory()) target = path.join(target, "index.html");
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, { ...baseHeaders(), "content-type": mime[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, baseHeaders());
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api")) return await handleApi(req, res, url);
    return await handleStatic(req, res);
  } catch {
    sendJson(req, res, 500, { error: "Internal Server Error" });
  }
});

initNeonDb().then(() => {
  server.listen(port, () => console.log(`🚀 Server ready on port ${port}`));
});
