import "dotenv/config";
import express from "express";
import mysql from "mysql2/promise";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT) || 3000;
const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(directory, "public");
const mysqlPort = Number(process.env.MYSQL_PORT || 3306);
const databaseConfigured = Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE)
  && Number.isInteger(mysqlPort)
  && mysqlPort > 0
  && mysqlPort <= 65535;
const production = process.env.NODE_ENV === "production";
const pool = databaseConfigured ? mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: mysqlPort,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
  supportBigNumbers: true,
  bigNumberStrings: true
}) : null;
pool?.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) console.error("Falha ao definir o fuso UTC no MySQL:", error.message);
  });
});
const sessions = new Map();
const sessionDuration = 8 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET || (production ? "" : randomBytes(32).toString("hex"));
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin";
const isPlaceholder = (value) => /^(REPLACE_|CHANGE_ME|YOUR_)/i.test(value);

if (production) {
  const configurationErrors = [];
  if (!databaseConfigured || !process.env.MYSQL_PASSWORD || isPlaceholder(process.env.MYSQL_PASSWORD)) configurationErrors.push("configure MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD e MYSQL_DATABASE com credenciais reais");
  if (!process.env.ADMIN_USERNAME || isPlaceholder(adminUsername) || !process.env.ADMIN_PASSWORD || isPlaceholder(adminPassword) || adminPassword === "admin" || adminPassword.length < 12) {
    configurationErrors.push("configure ADMIN_USERNAME e uma ADMIN_PASSWORD exclusiva com pelo menos 12 caracteres");
  }
  if (!process.env.SESSION_SECRET || isPlaceholder(sessionSecret) || sessionSecret.length < 32) configurationErrors.push("configure SESSION_SECRET com pelo menos 32 caracteres aleatórios");
  if (configurationErrors.length) {
    throw new Error(`Configuração de produção inválida: ${configurationErrors.join("; ")}.`);
  }
} else if (adminPassword === "admin") {
  console.warn("AVISO: acesso de demonstração ativo (admin/admin); altere ADMIN_USERNAME e ADMIN_PASSWORD antes de publicar.");
}

app.use(express.json({ limit: "32kb" }));
app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

function matchesSecret(value, expected) {
  if (typeof value !== "string") return false;
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function getSessionId(request) {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("vr_session="));
  if (!cookie) return null;
  const [sessionId, signature] = cookie.slice("vr_session=".length).split(".");
  if (!sessionId || !signature) return null;
  const expectedSignature = createHmac("sha256", sessionSecret).update(sessionId).digest("base64url");
  if (!matchesSecret(signature, expectedSignature)) return null;
  const expiresAt = sessions.get(sessionId);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return sessionId;
}

function requireLogin(request, response, next) {
  request.sessionId = getSessionId(request);
  if (!request.sessionId) return response.status(401).json({ error: "Sessão inválida ou expirada." });
  next();
}

function setSessionCookie(response, sessionId) {
  const signature = createHmac("sha256", sessionSecret).update(sessionId).digest("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `vr_session=${sessionId}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDuration / 1000}${secure}`);
}

function sendLoginPage(request, response) {
  if (getSessionId(request)) return response.redirect("/");
  response.setHeader("Cache-Control", "no-store");
  response.sendFile(path.join(directory, "login.html"));
}

app.post("/api/login", (request, response) => {
  const { username, password } = request.body || {};
  if (!matchesSecret(username, adminUsername) || !matchesSecret(password, adminPassword)) {
    return response.status(401).json({ error: "Usuário ou senha inválidos." });
  }
  const sessionId = randomBytes(32).toString("base64url");
  const now = Date.now();
  for (const [id, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(id);
  }
  sessions.set(sessionId, now + sessionDuration);
  setSessionCookie(response, sessionId);
  response.json({ username: adminUsername });
});

app.post("/api/logout", (request, response) => {
  const sessionId = getSessionId(request);
  if (sessionId) sessions.delete(sessionId);
  response.setHeader("Set-Cookie", "vr_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  response.status(204).end();
});

app.get("/api/health", async (_request, response) => {
  if (!pool) return response.status(503).json({ status: "degraded", database: "not_configured" });
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Falha na verificação de saúde do MySQL:", error.message);
    response.status(503).json({ status: "degraded", database: "disconnected" });
  }
});

app.get("/login", sendLoginPage);
app.get("/login.html", sendLoginPage);
app.get("/", (request, response) => {
  if (!getSessionId(request)) return response.redirect("/login");
  response.setHeader("Cache-Control", "no-store");
  response.sendFile(path.join(directory, "index.html"));
});
app.get("/index.html", (request, response) => {
  if (!getSessionId(request)) return response.redirect("/login");
  response.setHeader("Cache-Control", "no-store");
  response.sendFile(path.join(directory, "index.html"));
});
app.use(express.static(publicDirectory, {
  setHeaders(response, filePath) {
    if (path.basename(filePath) === "service-worker.js") response.setHeader("Cache-Control", "no-cache");
  }
}));
app.get("/app.js", requireLogin, (_request, response) => response.sendFile(path.join(directory, "app.js")));
app.use("/api", requireLogin, (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

function mapOrder(row) {
  return {
    id: row.id,
    resident: row.resident,
    building: row.building,
    apartment: row.apartment,
    carrier: row.carrier,
    porter: row.porter,
    notes: row.notes,
    receivedAt: row.received_at,
    status: row.status,
    pickedUpAt: row.picked_up_at
  };
}

app.get("/api/orders", async (request, response) => {
  try {
    const [rows] = await pool.query("SELECT * FROM parcels ORDER BY received_at DESC");
    response.json(rows.map(mapOrder));
  } catch (error) {
    console.error("Falha ao consultar encomendas:", error.message);
    response.status(503).json({ error: "Banco indisponível. Configure o MySQL e execute db/schema.sql no MySQL Workbench." });
  }
});

app.post("/api/orders", async (request, response) => {
  const { resident, building, apartment, carrier, porter, notes } = request.body || {};
  const requiredFields = [
    ["resident", resident, 140],
    ["building", building, 1],
    ["apartment", apartment, 12],
    ["porter", porter, 140]
  ];
  if (requiredFields.some(([, value]) => typeof value !== "string" || !value.trim())) {
    return response.status(400).json({ error: "Morador, bloco, apartamento e porteiro são obrigatórios." });
  }
  const oversizedField = requiredFields.find(([, value, maxLength]) => Array.from(value.trim()).length > maxLength);
  if (oversizedField) return response.status(400).json({ error: `${oversizedField[0]} excede o limite de caracteres permitido.` });
  if (!/^[A-C]$/.test(building.trim())) return response.status(400).json({ error: "Bloco inválido." });
  if (carrier !== undefined && carrier !== null && typeof carrier !== "string") return response.status(400).json({ error: "Transportadora inválida." });
  if (notes !== undefined && notes !== null && typeof notes !== "string") return response.status(400).json({ error: "Observações inválidas." });
  const cleanCarrier = carrier?.trim() || "Não informado";
  const cleanNotes = notes?.trim() || null;
  if (Array.from(cleanCarrier).length > 100) return response.status(400).json({ error: "Transportadora deve ter no máximo 100 caracteres." });
  if (cleanNotes && Array.from(cleanNotes).length > 16000) return response.status(400).json({ error: "Observações devem ter no máximo 16000 caracteres." });
  try {
    const [result] = await pool.execute(
      "INSERT INTO parcels (resident, building, apartment, carrier, porter, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [resident.trim(), building.trim(), apartment.trim(), cleanCarrier, porter.trim(), cleanNotes]
    );
    const [rows] = await pool.execute("SELECT * FROM parcels WHERE id = ?", [result.insertId]);
    if (!rows.length) throw new Error("A encomenda foi inserida, mas não pôde ser lida de volta.");
    response.status(201).json(mapOrder(rows[0]));
  } catch (error) {
    console.error("Falha ao registrar encomenda:", error.message);
    response.status(503).json({ error: "Não foi possível salvar a encomenda no MySQL." });
  }
});

app.patch("/api/orders/:id/pickup", async (request, response) => {
  const id = request.params.id;
  if (!/^[1-9]\d*$/.test(id)) return response.status(400).json({ error: "Identificador inválido." });
  try {
    const [result] = await pool.execute(
      "UPDATE parcels SET status = 'picked_up', picked_up_at = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'pending'",
      [id]
    );
    if (!result.affectedRows) return response.status(404).json({ error: "Encomenda pendente não encontrada." });
    const [rows] = await pool.execute("SELECT * FROM parcels WHERE id = ?", [id]);
    response.json(mapOrder(rows[0]));
  } catch (error) {
    console.error("Falha ao confirmar retirada:", error.message);
    response.status(503).json({ error: "Não foi possível confirmar a retirada no MySQL." });
  }
});

const server = app.listen(port, () => console.log(`Vitória Régia disponível em http://localhost:${port}`));
server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`A porta ${port} já está em uso. A aplicação pode já estar rodando; feche a outra instância ou configure outra porta pela variável PORT.`);
  } else {
    console.error(`Não foi possível iniciar o servidor na porta ${port}:`, error.message);
  }
  if (pool) await pool.end();
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (pool) await pool.end();
    process.exit(0);
  });
}
