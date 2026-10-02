import "dotenv/config";
import express from "express";
import pg from "pg";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT) || 3000;
const directory = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sessions = new Map();
const sessionDuration = 8 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin";

app.use(express.json({ limit: "32kb" }));

function matchesSecret(value, expected) {
  if (typeof value !== "string") return false;
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function getSessionId(request) {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("vr_session="));
  if (!cookie) return null;
  const [sessionId, signature] = decodeURIComponent(cookie.slice("vr_session=".length)).split(".");
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
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "degraded", database: "disconnected" });
  }
});

app.get("/login", sendLoginPage);
app.get("/login.html", sendLoginPage);
app.get("/", (request, response) => {
  if (!getSessionId(request)) return response.redirect("/login");
  response.sendFile(path.join(directory, "index.html"));
});
app.get("/index.html", (request, response) => {
  if (!getSessionId(request)) return response.redirect("/login");
  response.sendFile(path.join(directory, "index.html"));
});
app.get("/styles.css", (_request, response) => response.sendFile(path.join(directory, "styles.css")));
app.get("/brand-mark.svg", (_request, response) => response.sendFile(path.join(directory, "public", "brand-mark.svg")));
app.get("/manifest.webmanifest", (_request, response) => response.sendFile(path.join(directory, "manifest.webmanifest")));
app.get("/service-worker.js", (_request, response) => {
  response.setHeader("Cache-Control", "no-cache");
  response.sendFile(path.join(directory, "service-worker.js"));
});
app.get("/install.js", (_request, response) => response.sendFile(path.join(directory, "install.js")));
app.use("/icons", express.static(path.join(directory, "public", "icons"), { maxAge: "1d" }));
app.get("/login.js", (_request, response) => response.sendFile(path.join(directory, "login.js")));
app.get("/app.js", requireLogin, (_request, response) => response.sendFile(path.join(directory, "app.js")));
app.use("/api", requireLogin);

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
    const { rows } = await pool.query("SELECT * FROM parcels ORDER BY received_at DESC LIMIT 500");
    response.json(rows.map(mapOrder));
  } catch (error) {
    console.error("Falha ao consultar encomendas:", error.message);
    response.status(503).json({ error: "Banco indisponível. Configure o PostgreSQL e execute db/schema.sql." });
  }
});

app.post("/api/orders", async (request, response) => {
  const { resident, building, apartment, carrier, porter, notes } = request.body || {};
  if (![resident, building, apartment, porter].every((value) => typeof value === "string" && value.trim())) {
    return response.status(400).json({ error: "Morador, bloco, apartamento e porteiro são obrigatórios." });
  }
  if (!/^[A-C]$/.test(building)) return response.status(400).json({ error: "Bloco inválido." });
  try {
    const { rows } = await pool.query(
      "INSERT INTO parcels (resident, building, apartment, carrier, porter, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [resident.trim(), building, apartment.trim(), carrier?.trim() || "Não informado", porter.trim(), notes?.trim() || null]
    );
    response.status(201).json(mapOrder(rows[0]));
  } catch (error) {
    console.error("Falha ao registrar encomenda:", error.message);
    response.status(503).json({ error: "Não foi possível salvar a encomenda no PostgreSQL." });
  }
});

app.patch("/api/orders/:id/pickup", async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: "Identificador inválido." });
  try {
    const { rows } = await pool.query(
      "UPDATE parcels SET status = 'picked_up', picked_up_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *",
      [id]
    );
    if (!rows[0]) return response.status(404).json({ error: "Encomenda pendente não encontrada." });
    response.json(mapOrder(rows[0]));
  } catch (error) {
    console.error("Falha ao confirmar retirada:", error.message);
    response.status(503).json({ error: "Não foi possível confirmar a retirada no PostgreSQL." });
  }
});

app.listen(port, () => console.log(`Vitória Régia disponível em http://localhost:${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await pool.end();
    process.exit(0);
  });
}