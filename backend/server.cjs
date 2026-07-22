const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

// =======================================================================
// ملحوظة تصميم: متعمدين إننا منستخدمش bcrypt ولا jsonwebtoken كمكتبات
// خارجية. bcrypt مكتبة native محتاجة أدوات بناء (build tools) وقت
// التثبيت وممكن تفشل على بعض السيرفرات. بدالها بنستخدم scrypt المدمجة
// جوه Node نفسه (نفس الغرض: تشفير باسورد بطيء ومقاوم للـ brute-force)،
// وتوكن موقّع يدويًا بـ HMAC-SHA256 (نفس فكرة JWT) من غير أي dependency.
// =======================================================================

// ------------------------- الإعدادات والتحقق من البيئة -------------------------
// ملحوظة: مسار الملفات الثابتة (frontend) ومسار قاعدة البيانات (database)
// بقوا مستقلين تمامًا عن مكان server.js نفسه. يعني تقدر تحط server.js في
// أي فولدر (database/, backend/, أو حتى في جذر المشروع) وهيشتغل، طالما
// حددت المسارات دي عن طريق متغيرات البيئة، أو سبتها على القيم الافتراضية
// اللي بتدور على فولدرات "frontend" و"database" جنب بعض في نفس المستوى
// (مش بالنسبة لمكان server.js).
function resolveDefaultProjectRoot() {
  // لو مش متحدد MR3_PROJECT_ROOT، بندور على فولدر فيه "frontend" و"database"
  // سوا، بادئين من مكان server.js وطالعين لحد ما نلاقيه أو نوصل لأعلى حد.
  let dir = __dirname;
  for (let i = 0; i < 4; i++) {
    const hasFrontend = existsSyncSafe(path.join(dir, "frontend"));
    const hasDatabase = existsSyncSafe(path.join(dir, "database"));
    if (hasFrontend || hasDatabase) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, ".."); // نفس السلوك القديم كـ fallback أخير
}

function existsSyncSafe(p) {
  try {
    require("fs").accessSync(p);
    return true;
  } catch {
    return false;
  }
}

const projectRoot = process.env.MR3_PROJECT_ROOT
  ? path.resolve(process.env.MR3_PROJECT_ROOT)
  : resolveDefaultProjectRoot();

const frontendRoot = process.env.MR3_FRONTEND_PATH
  ? path.resolve(process.env.MR3_FRONTEND_PATH)
  : path.join(projectRoot, "frontend");

const databasePath = process.env.MR3_DB_PATH
  ? path.resolve(process.env.MR3_DB_PATH)
  : path.join(projectRoot, "database", "db.json");

const port = Number(process.env.PORT || 3000);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("❌ خطأ فادح: متغير البيئة JWT_SECRET لازم يتحدد في بيئة الإنتاج.");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.warn("⚠️  تحذير: JWT_SECRET مش متحدد. هيتستخدم مفتاح تطوير غير آمن (development only).");
}
const FINAL_JWT_SECRET = JWT_SECRET || "dev-insecure-secret-do-not-use-in-production";
const TOKEN_TTL_SECONDS = Number(process.env.MR3_TOKEN_TTL || 60 * 60 * 8); // 8 ساعات

const MAX_BODY_SIZE = Number(process.env.MAX_BODY_SIZE) || 2_000_000;

// حدود معدل الطلبات: حد عام لطيف على كل الـ API، وحد صارم منفصل خاص
// بمحاولات تسجيل الدخول (عشان نمنع هجوم تخمين الباسورد بالتحديد، بدل
// ما يتشارك مع الحد العام اللي بيسمح بمحاولات كتير قبل ما يوقف).
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
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg"]);

const PROTECTED_FIELDS = ["createdAt", "updatedAt", "id"]; // حقول محسوبة من السيرفر بس، ممنوع العميل يبعتها

// ------------------------- Rate Limiting (طبقتين) -------------------------
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

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of generalLimits) if (now > entry.resetTime) generalLimits.delete(ip);
  for (const [ip, entry] of loginAttempts) if (now - entry.windowStart > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
}, 10 * 60 * 1000).unref();

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

// ------------------------- Security Headers (منفصلة حسب النوع) -------------------------
// ملحوظة: الكاش ده كان بيتطبق بنفس القيمة (no-store) على كل حاجة في
// النسخة اللي قبل كده، حتى ملفات الـ CSS/JS/الصور الثابتة، وده كان بيبطّئ
// الموقع لأن المتصفح كان مضطر يعيد تحميل كل حاجة من الصفر كل مرة.
// دلوقتي بقى فيه فرق: ردود الـ API لسه no-store (لأنها بيانات حساسة
// ديناميكية)، لكن الملفات الثابتة بتاخد كاش حقيقي لسرعة أعلى.
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

// ------------------------- أدوات الرد (مع ضغط gzip) -------------------------
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

// ------------------------- تشفير كلمات المرور (scrypt) -------------------------
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
  return Array.from(crypto.randomBytes(length)).map((byte) => chars[byte % chars.length]).join("");
}

function stripPassword(user) {
  if (!user) return user;
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}

// ------------------------- توكن موقّع (بديل JWT بدون مكتبة خارجية) -------------------------
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

// ------------------------- قاعدة البيانات: كاش في الذاكرة + قفل للكتابة فقط -------------------------
// القراءات (GET) بترجع من الكاش على طول من غير ما تستنى أي قفل، وده
// اللي بيدي السرعة. التعديلات (POST/PATCH/DELETE) بس هي اللي بتتسلسل
// عن طريق القفل، عشان نضمن عدم ضياع أي تحديث (lost update) لو جالك
// طلبين في نفس اللحظة.
let dbCache = null;
let dbLock = Promise.resolve();

function withDbLock(fn) {
  const run = dbLock.then(() => fn());
  dbLock = run.catch(() => {});
  return run;
}

async function writeDbRaw(data) {
  const tmpPath = `${databasePath}.tmp-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, databasePath); // كتابة atomic تحمي من فساد الملف لو حصل crash نص الكتابة
  dbCache = data;
}

const BCRYPT_LIKE_LEGACY_FIELD = "password"; // أي حقل قديم بالاسم ده معناه غالبًا نص صريح أو hash بمكتبة تانية

// ترقية أي مستخدم لسه شايل باسورد بصيغة قديمة (نص صريح) لصيغة scrypt الآمنة،
// وتوحيد الدور لحروف صغيرة، وتسجيل الأمر في سجل التدقيق.
async function upgradeLegacyUsers(db) {
  let modified = false;
  if (!Array.isArray(db.users)) {
    db.users = [];
    return modified;
  }
  for (const user of db.users) {
    if (typeof user[BCRYPT_LIKE_LEGACY_FIELD] === "string") {
      const { passwordHash, passwordSalt } = await hashPassword(user[BCRYPT_LIKE_LEGACY_FIELD]);
      user.passwordHash = passwordHash;
      user.passwordSalt = passwordSalt;
      user.mustChangePassword = true;
      delete user[BCRYPT_LIKE_LEGACY_FIELD];
      modified = true;
      console.log(`🔐 تم تشفير باسورد نص صريح كان مخزن للمستخدم: ${user.username || user.email}`);
    }
    if (typeof user.role === "string" && user.role !== user.role.toLowerCase()) {
      user.role = user.role.toLowerCase();
      modified = true;
    }
  }
  if (modified) {
    if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
    db.auditLogs.push({
      id: `audit_${crypto.randomUUID()}`,
      action: "SECURITY_MIGRATION",
      details: "تشفير باسوردات نص صريح موروثة وتوحيد صيغة الأدوار.",
      performedBy: "system",
      createdAt: new Date().toISOString()
    });
  }
  return modified;
}

async function bootstrapAdminIfNeeded(db) {
  if (Array.isArray(db.users) && db.users.length > 0) return false;
  const defaultPassword = generateSecurePassword(16);
  const { passwordHash, passwordSalt } = await hashPassword(defaultPassword);
  db.users = [
    {
      id: "u_admin",
      name: "System Administrator",
      username: "admin",
      email: "admin@mr3.local",
      passwordHash,
      passwordSalt,
      role: "admin",
      active: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  console.log("\n" + "=".repeat(60));
  console.log("🔐 تم إنشاء حساب Admin افتراضي (أول تشغيل)");
  console.log(`   Username: admin`);
  console.log(`   Password: ${defaultPassword}`);
  console.log("   👉 سجل دخول وغيّر الباسورد ده فورًا، معادش هيتطبع تاني.");
  console.log("=".repeat(60) + "\n");
  return true;
}

async function loadDbFromDisk() {
  let raw;
  try {
    raw = await fs.readFile(databasePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(path.dirname(databasePath), { recursive: true });
      const initial = { users: [], auditLogs: [] };
      await bootstrapAdminIfNeeded(initial);
      await writeDbRaw(initial);
      return initial;
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Database file is corrupted or contains invalid JSON.");
  }
  if (!Array.isArray(parsed.auditLogs)) parsed.auditLogs = [];
  const createdAdmin = await bootstrapAdminIfNeeded(parsed);
  const upgraded = await upgradeLegacyUsers(parsed);
  if (createdAdmin || upgraded) await writeDbRaw(parsed);
  return parsed;
}

async function initDb() {
  dbCache = await loadDbFromDisk();
}

function getDb() {
  return dbCache; // قراءة فورية من الذاكرة، من غير أي انتظار على القفل
}

function makeId(prefix = "item") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

// سجل تدقيق دائم: بيتسجل جوه قاعدة البيانات نفسها (مش بس console) عشان
// ميضيعش لو السيرفر اترستارت. بيتسجل فقط للعمليات اللي بتغيّر بيانات
// (إنشاء/تعديل/حذف/تغيير باسورد)، مش لكل محاولة تسجيل دخول فاشلة، عشان
// منعملش ضغط كتابة على الديسك (write amplification) لو حد بيهاجم
// اللوجين بمحاولات كتير.
function recordAudit(db, action, user, details) {
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  const entry = {
    id: `audit_${crypto.randomUUID()}`,
    action,
    performedBy: user ? `${user.username || user.email} (${user.id})` : "SYSTEM",
    details,
    createdAt: new Date().toISOString()
  };
  db.auditLogs.push(entry);
  console.log(`[AUDIT] ${entry.createdAt} | ${entry.performedBy} | ${action} | ${JSON.stringify(details)}`);
}

// ------------------------- التحقق من المدخلات -------------------------
function validateUserBody(body, isCreation = true) {
  const errors = [];
  if (isCreation) {
    if (!body.username || body.username.length < 3) errors.push("Username must be at least 3 characters.");
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push("Invalid email format.");
    if (!body.password || body.password.length < 8) errors.push("Password must be at least 8 characters.");
  } else {
    if (body.username !== undefined && body.username.length < 3) errors.push("Username must be at least 3 characters.");
    if (body.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push("Invalid email format.");
    if (body.password !== undefined && body.password.length < 8) errors.push("Password must be at least 8 characters.");
  }
  if (body.role && !["user", "admin"].includes(String(body.role).toLowerCase())) {
    errors.push("Role must be either user or admin.");
  }
  return errors;
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

// ------------------------- المصادقة والصلاحيات -------------------------
function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function authenticate(req) {
  const token = getBearerToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return null;
  const db = getDb();
  const user = db.users.find((u) => u.id === payload.id);
  if (user && user.active !== false) return user;
  return null;
}

async function requireAuth(req, res, extraHeaders) {
  const user = authenticate(req);
  if (!user) {
    await sendJson(req, res, 401, { error: "Unauthorized. Please login." }, extraHeaders);
    return null;
  }
  return user;
}

function isAdmin(user) {
  return user && user.role === "admin";
}

// ------------------------- مسارات الـ API -------------------------
async function handleApi(req, res, url, extraHeaders) {
  if (req.method === "OPTIONS") return sendJson(req, res, 204, {}, extraHeaders);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/health") {
    return sendJson(req, res, 200, { ok: true, service: "MR3 backend" }, extraHeaders);
  }

  // ---------- تسجيل الدخول (بحد صارم لمحاولات التخمين) ----------
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const ip = clientIp(req);
    if (isLoginRateLimited(ip)) {
      return sendJson(req, res, 429, { error: "محاولات كتير جدًا. حاول تاني بعد شوية." }, extraHeaders);
    }
    const body = await readBody(req);
    const { username, password } = body;
    if (!username || !password) {
      return sendJson(req, res, 400, { error: "Username and password are required." }, extraHeaders);
    }
    const db = getDb();
    const user = db.users.find((u) => u.username === username || u.email === username);
    // بنتحقق حتى لو المستخدم مش موجود عشان نتجنب فروق التوقيت اللي ممكن
    // تكشف وجود اليوزرنيم من عدمه (timing side-channel)
    const dummySalt = "0".repeat(32);
    const dummyHash = "0".repeat(128);
    const valid = user
      ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
      : await verifyPassword(password, dummySalt, dummyHash);

    if (!user || !valid) {
      console.log(`[AUDIT] ${new Date().toISOString()} | LOGIN_FAILED | username=${username} ip=${ip}`);
      return sendJson(req, res, 401, { error: "Invalid credentials." }, extraHeaders);
    }
    if (user.active === false) {
      console.log(`[AUDIT] ${new Date().toISOString()} | LOGIN_FAILED | reason=inactive user=${user.id}`);
      return sendJson(req, res, 403, { error: "Account is deactivated. Contact admin." }, extraHeaders);
    }

    const token = generateToken(user);
    console.log(`[AUDIT] ${new Date().toISOString()} | LOGIN_SUCCESS | user=${user.id}`);
    return sendJson(req, res, 200, { token, user: stripPassword(user) }, extraHeaders);
  }

  // ---------- المستخدم الحالي ----------
  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const user = await requireAuth(req, res, extraHeaders);
    if (!user) return;
    return sendJson(req, res, 200, stripPassword(user), extraHeaders);
  }

  // ---------- تغيير الباسورد (لازم تعرف الباسورد الحالي حتى لو mustChangePassword) ----------
  if (url.pathname === "/api/auth/change-password" && req.method === "POST") {
    const user = await requireAuth(req, res, extraHeaders);
    if (!user) return;
    const body = await readBody(req);
    const { currentPassword, newPassword } = body;
    if (!newPassword || newPassword.length < 8) {
      return sendJson(req, res, 400, { error: "New password must be at least 8 characters." }, extraHeaders);
    }
    const validCurrent = await verifyPassword(currentPassword || "", user.passwordSalt, user.passwordHash);
    if (!validCurrent) {
      return sendJson(req, res, 401, { error: "Current password is incorrect." }, extraHeaders);
    }
    return withDbLock(async () => {
      const db = getDb();
      const index = db.users.findIndex((u) => u.id === user.id);
      const { passwordHash, passwordSalt } = await hashPassword(newPassword);
      db.users[index] = {
        ...db.users[index],
        passwordHash,
        passwordSalt,
        mustChangePassword: false,
        updatedAt: new Date().toISOString()
      };
      recordAudit(db, "PASSWORD_CHANGED", user, { targetId: user.id });
      await writeDbRaw(db);
      return sendJson(req, res, 200, { ok: true }, extraHeaders);
    });
  }

  // ---------- كل حاجة تحت كده لازم تسجيل دخول ----------
  const collection = parts[1];
  const id = parts[2];
  if (!collection) return sendJson(req, res, 400, { error: "Collection is required." }, extraHeaders);

  const currentUser = await requireAuth(req, res, extraHeaders);
  if (!currentUser) return;

  const db = getDb();
  if (!(collection in db)) {
    if (req.method === "GET") return sendJson(req, res, 200, [], extraHeaders);
  }

  // 1) GET قائمة
  if (req.method === "GET" && !id) {
    const rows = Array.isArray(db[collection]) ? db[collection] : [];
    const safeRows = collection === "users" ? rows.map(stripPassword) : rows;
    return sendJson(req, res, 200, safeRows, extraHeaders);
  }

  // 2) GET عنصر واحد
  if (req.method === "GET" && id) {
    const item = Array.isArray(db[collection]) ? db[collection].find((x) => x.id === id) : null;
    if (!item) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);
    return sendJson(req, res, 200, collection === "users" ? stripPassword(item) : item, extraHeaders);
  }

  // 3) POST إنشاء
  if (req.method === "POST" && !id) {
    const rawBody = await readBody(req);

    if (collection === "users") {
      if (!isAdmin(currentUser)) {
        return sendJson(req, res, 403, { error: "Forbidden. Admin rights required." }, extraHeaders);
      }
      const body = filterBody(rawBody, ["username", "email", "password", "name", "role", "active"]);
      const errors = validateUserBody(body, true);
      if (errors.length) return sendJson(req, res, 400, { error: "Validation failed", details: errors }, extraHeaders);

      return withDbLock(async () => {
        const freshDb = getDb();
        if (freshDb.users.some((u) => u.username === body.username || u.email === body.email)) {
          return sendJson(req, res, 409, { error: "Username or email already exists." }, extraHeaders);
        }
        const { passwordHash, passwordSalt } = await hashPassword(body.password);
        const newUser = {
          id: makeId("u"),
          username: body.username,
          email: body.email,
          name: body.name,
          passwordHash,
          passwordSalt,
          role: (body.role || "user").toLowerCase(),
          active: body.active !== undefined ? body.active : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const newDb = { ...freshDb, users: [...freshDb.users, newUser] };
        recordAudit(newDb, "USER_CREATED", currentUser, { targetId: newUser.id, username: newUser.username });
        await writeDbRaw(newDb);
        return sendJson(req, res, 201, stripPassword(newUser), extraHeaders);
      });
    }

    return withDbLock(async () => {
      const freshDb = getDb();
      const cleanData = filterBody(rawBody);
      const newItem = {
        id: cleanData.id || makeId(collection.slice(0, 3)),
        ...cleanData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const existingCollection = Array.isArray(freshDb[collection]) ? freshDb[collection] : [];
      const newDb = { ...freshDb, [collection]: [...existingCollection, newItem] };
      recordAudit(newDb, `${collection.toUpperCase()}_CREATED`, currentUser, { id: newItem.id });
      await writeDbRaw(newDb);
      return sendJson(req, res, 201, newItem, extraHeaders);
    });
  }

  // 4) PATCH تعديل
  if (req.method === "PATCH" && id) {
    const rawBody = await readBody(req);

    if (collection === "users") {
      if (!isAdmin(currentUser)) {
        return sendJson(req, res, 403, { error: "Forbidden. Admin rights required." }, extraHeaders);
      }
      const body = filterBody(rawBody, ["username", "email", "password", "name", "role", "active"]);
      const errors = validateUserBody(body, false);
      if (errors.length) return sendJson(req, res, 400, { error: "Validation failed", details: errors }, extraHeaders);

      return withDbLock(async () => {
        const freshDb = getDb();
        const index = freshDb.users.findIndex((u) => u.id === id);
        if (index === -1) return sendJson(req, res, 404, { error: "User not found." }, extraHeaders);

        if (id === currentUser.id && body.role && body.role.toLowerCase() !== currentUser.role) {
          return sendJson(req, res, 403, { error: "You cannot change your own role." }, extraHeaders);
        }
        if (id === currentUser.id && body.active === false) {
          return sendJson(req, res, 403, { error: "You cannot deactivate your own account." }, extraHeaders);
        }

        const updated = { ...freshDb.users[index], ...body, updatedAt: new Date().toISOString() };
        if (body.password) {
          const { passwordHash, passwordSalt } = await hashPassword(body.password);
          updated.passwordHash = passwordHash;
          updated.passwordSalt = passwordSalt;
          updated.mustChangePassword = false;
        }
        delete updated.password;
        if (updated.role) updated.role = updated.role.toLowerCase();

        const newUsers = [...freshDb.users];
        newUsers[index] = updated;
        const newDb = { ...freshDb, users: newUsers };
        recordAudit(newDb, "USER_UPDATED", currentUser, { targetId: id });
        await writeDbRaw(newDb);
        return sendJson(req, res, 200, stripPassword(updated), extraHeaders);
      });
    }

    return withDbLock(async () => {
      const freshDb = getDb();
      const items = Array.isArray(freshDb[collection]) ? freshDb[collection] : [];
      const index = items.findIndex((x) => x.id === id);
      if (index === -1) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);

      const cleanData = filterBody(rawBody);
      const updated = { ...items[index], ...cleanData, updatedAt: new Date().toISOString() };
      const newCollection = [...items];
      newCollection[index] = updated;
      const newDb = { ...freshDb, [collection]: newCollection };
      recordAudit(newDb, `${collection.toUpperCase()}_UPDATED`, currentUser, { id });
      await writeDbRaw(newDb);
      return sendJson(req, res, 200, updated, extraHeaders);
    });
  }

  // 5) DELETE حذف
  if (req.method === "DELETE" && id) {
    if (collection === "users") {
      if (!isAdmin(currentUser)) {
        return sendJson(req, res, 403, { error: "Forbidden. Admin rights required." }, extraHeaders);
      }
      if (id === currentUser.id) {
        return sendJson(req, res, 403, { error: "You cannot delete your own account." }, extraHeaders);
      }
      return withDbLock(async () => {
        const freshDb = getDb();
        const before = freshDb.users.length;
        const filtered = freshDb.users.filter((u) => u.id !== id);
        if (before === filtered.length) return sendJson(req, res, 404, { error: "User not found." }, extraHeaders);
        const newDb = { ...freshDb, users: filtered };
        recordAudit(newDb, "USER_DELETED", currentUser, { targetId: id });
        await writeDbRaw(newDb);
        return sendJson(req, res, 200, { ok: true, message: "User deleted successfully." }, extraHeaders);
      });
    }

    return withDbLock(async () => {
      const freshDb = getDb();
      const items = Array.isArray(freshDb[collection]) ? freshDb[collection] : [];
      const before = items.length;
      const filtered = items.filter((x) => x.id !== id);
      if (before === filtered.length) return sendJson(req, res, 404, { error: "Item not found." }, extraHeaders);
      const newDb = { ...freshDb, [collection]: filtered };
      recordAudit(newDb, `${collection.toUpperCase()}_DELETED`, currentUser, { id });
      await writeDbRaw(newDb);
      return sendJson(req, res, 200, { ok: true, message: "Item deleted successfully." }, extraHeaders);
    });
  }

  return sendJson(req, res, 405, { error: "Method not allowed." }, extraHeaders);
}

// ------------------------- الملفات الثابتة (كاش حقيقي + gzip) -------------------------
function safeStaticPath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "") || "login.html";
  if (clean.includes("..") || clean.includes("\0")) return null; // دفاع إضافي احترازي
  const full = path.resolve(frontendRoot, clean);
  const rootWithSep = frontendRoot.endsWith(path.sep) ? frontendRoot : frontendRoot + path.sep;
  // المقارنة بالفاصل (path.sep) بتمنع مشكلة "frontendRoot-evil" اللي كانت
  // بتعدي من غير الفاصل ده
  if (full !== frontendRoot && !full.startsWith(rootWithSep)) return null;
  return full;
}

async function handleStatic(req, res, corsAndSecurityHeaders) {
  const file = safeStaticPath(req.url || "/");
  if (!file) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8", ...corsAndSecurityHeaders });
    res.end("Forbidden");
    return;
  }

  try {
    let target = file;
    const stat = await fs.stat(target).catch(() => null);
    if (stat && stat.isDirectory()) target = path.join(target, "index.html");

    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const headers = {
      "content-type": mime[ext] || "application/octet-stream",
      // الـ HTML بيتراجع كل مرة (no-cache يسمح بالكاش لكن بيتحقق أولًا)،
      // بينما باقي الأصول الثابتة (CSS/JS/صور) بتاخد كاش فعلي لمدة ساعة
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      ...corsAndSecurityHeaders
    };

    const acceptEncoding = req.headers["accept-encoding"] || "";
    if (COMPRESSIBLE.has(ext) && acceptEncoding.includes("gzip") && data.length > 1024) {
      const compressed = await new Promise((resolve, reject) =>
        zlib.gzip(data, (err, out) => (err ? reject(err) : resolve(out)))
      );
      headers["content-encoding"] = "gzip";
      res.writeHead(200, headers);
      res.end(compressed);
    } else {
      res.writeHead(200, headers);
      res.end(data);
    }
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...corsAndSecurityHeaders });
    res.end("Not found");
  }
}

function handleRedirect(res, headers) {
  res.writeHead(302, { Location: "/login.html", ...headers });
  res.end();
}

// ------------------------- تشغيل السيرفر -------------------------
const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  const security = baseSecurityHeaders();
  const cors = corsHeaders(req);

  if (isGeneralRateLimited(ip)) {
    return sendJson(req, res, 429, { error: "Too many requests. Please try again later." }, { ...security, ...cors });
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

    if (url.pathname === "/") return handleRedirect(res, { ...security, ...cors });
    if (url.pathname.startsWith("/api")) return await handleApi(req, res, url, apiHeaders(req));
    return await handleStatic(req, res, { ...security, ...cors });
  } catch (error) {
    console.error(`[Error] Unhandled server error for IP ${ip}:`, error);
    return sendJson(req, res, 500, { error: "Internal server error." }, { ...security, ...cors });
  }
});

async function printStartupDiagnostics() {
  console.log("=".repeat(60));
  console.log("📂 المسارات اللي السيرفر شغال بيها:");
  console.log(`   مكان ملف server.js نفسه : ${__dirname}`);
  console.log(`   جذر المشروع (project root): ${projectRoot}`);
  console.log(`   فولدر الواجهة (frontend)  : ${frontendRoot}`);
  console.log(`   ملف قاعدة البيانات (db)   : ${databasePath}`);

  const frontendExists = existsSyncSafe(frontendRoot);
  if (!frontendExists) {
    console.warn(
      "⚠️  تحذير: فولدر الـ frontend مش موجود في المسار ده!\n" +
      "   الموقع (login.html وغيره) مش هيشتغل لحد ما تتأكد من المسار،\n" +
      "   لكن الـ API هيفضل شغال عادي.\n" +
      "   لو الفولدر في مكان تاني، حدده يدويًا بمتغير البيئة:\n" +
      '   MR3_FRONTEND_PATH="/المسار/الكامل/لفولدر/frontend"'
    );
  } else {
    const loginExists = existsSyncSafe(path.join(frontendRoot, "login.html"));
    if (!loginExists) {
      console.warn(`⚠️  تحذير: فولدر الـ frontend موجود بس مفيش جواه login.html.`);
    }
  }
  console.log("=".repeat(60));
}

printStartupDiagnostics()
  .then(() => initDb())
  .then(() => {
    server.listen(port, () => {
      console.log(`🚀 MR3 Backend running at http://localhost:${port}/login.html`);
      console.log(`🔒 JWT Secret: ${JWT_SECRET ? "✅ Set from env" : "⚠️  Using insecure default (development only)"}`);
      console.log(`📦 Max body size: ${MAX_BODY_SIZE} bytes`);
      console.log(`⏱️  Rate limit: ${GENERAL_MAX_REQUESTS} req/min (general), ${LOGIN_MAX_ATTEMPTS} attempts/15min (login)`);
    });
  })
  .catch((error) => {
    console.error("فشل تحميل قاعدة البيانات عند بدء التشغيل:", error);
    process.exit(1);
  });