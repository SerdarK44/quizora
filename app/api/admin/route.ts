/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRawDb } from "../../../db";

// PBKDF2-SHA256 (120,000 iterations, salt: 'quizora-admin-v1') hash of 'SerdarSerdar'
const PASSWORD_HASH =
  "6b23a2f8865da913bcda1ea242a5d2b3ef6db1ed051ac2c3e17aba7c84ee4a4f";
const SESSION =
  "7f5d4f2e8d27e2c41f7f9d99c99038eb510aa67c5acf62406d5c306b397da83b";

// Brute-force protection: max 5 failed attempts per IP, then 60s cooldown
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function isRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  const now = Date.now();
  if (entry.lockedUntil > now) return true;
  if (now > entry.lockedUntil && entry.count >= 5) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordLoginFailure(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = now + 60 * 1000;
  }
  loginAttempts.set(ip, entry);
}

function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, { status, headers });

const authed = (r: Request) =>
  (r.headers.get("cookie") || "")
    .split(";")
    .some((x) => x.trim() === `quizora_admin=${SESSION}`);

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function passwordHash(password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new TextEncoder().encode("quizora-admin-v1"),
        iterations: 120000,
      },
      key,
      256,
    ),
  );
}

async function payload(r: Request) {
  try {
    return (await r.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

async function generateUniqueRoomCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await db
      .prepare("SELECT 1 FROM rooms WHERE code=?")
      .bind(code)
      .first();
    if (!existing) return code;
  }
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

async function cleanupStaleRooms(db: D1Database) {
  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const oldRooms = await db
      .prepare("SELECT id FROM rooms WHERE created_at < ?")
      .bind(oneDayAgo)
      .all<{ id: string }>();
    if (oldRooms.results && oldRooms.results.length > 0) {
      for (const r of oldRooms.results) {
        await db.batch([
          db.prepare("DELETE FROM answers WHERE room_id=?").bind(r.id),
          db.prepare("DELETE FROM players WHERE room_id=?").bind(r.id),
          db.prepare("DELETE FROM rooms WHERE id=?").bind(r.id),
        ]);
      }
    }
  } catch (e) {
    console.error("Cleanup stale rooms error:", e);
  }
}

async function listQuizzes(db: D1Database) {
  const quizzes = (
    await db
      .prepare(
        "SELECT id,title,risk_enabled,created_at FROM quizzes ORDER BY created_at DESC",
      )
      .all<Record<string, any>>()
  ).results;
  const questions = (
    await db
      .prepare(
        "SELECT quiz_id,prompt,options_json,correct_index,seconds,max_points,image_url,position FROM questions ORDER BY position",
      )
      .all<Record<string, any>>()
  ).results;
  return quizzes.map((q) => ({
    ...q,
    riskEnabled: !!q.risk_enabled,
    questions: questions
      .filter((x) => x.quiz_id === q.id)
      .map((x) => {
        let options: string[] = [];
        try {
          const parsed = JSON.parse(x.options_json);
          options = Array.isArray(parsed) ? parsed : [];
        } catch {
          options = ["A", "B", "C", "D"];
        }
        return {
          prompt: String(x.prompt || ""),
          options,
          correctIndex: Math.max(0, Math.min(3, Number(x.correct_index) || 0)),
          seconds: Math.max(5, Math.min(180, Number(x.seconds) || 20)),
          points: Math.max(0, Math.min(10000, Number(x.max_points) || 1000)),
          imageUrl: String(x.image_url || ""),
        };
      }),
  }));
}

export async function GET(request: Request) {
  if (!authed(request)) return json({ authenticated: false }, 401);
  try {
    return json({
      authenticated: true,
      quizzes: await listQuizzes(getRawDb()),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Kayıtlı yarışmalar yüklenemedi." }, 500);
  }
}

export async function POST(request: Request) {
  const p = await payload(request),
    action = String(p.action || "");

  if (action === "login") {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    if (isRateLimited(ip)) {
      return json(
        { error: "Çok fazla hatalı deneme yapıldı. Lütfen 1 dakika bekleyin." },
        429,
      );
    }

    const inputUser = String(p.username || "").trim();
    const inputPass = String(p.password || "");
    const passHash = await passwordHash(inputPass);

    const isUserValid = inputUser === "admin";
    const isPassValid = timingSafeEqual(passHash, PASSWORD_HASH);

    if (!isUserValid || !isPassValid) {
      recordLoginFailure(ip);
      return json({ error: "Kullanıcı adı veya şifre hatalı." }, 401);
    }

    clearLoginFailures(ip);
    return json({ authenticated: true }, 200, {
      "Set-Cookie": `quizora_admin=${SESSION}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`,
    });
  }

  if (action === "logout") {
    return json({ authenticated: false }, 200, {
      "Set-Cookie": `quizora_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    });
  }

  if (!authed(request))
    return json({ error: "Yönetici oturumu gerekli." }, 401);
  try {
    const db = getRawDb();
    if (action === "save" || action === "update") {
      const title = String(p.title || "").trim().slice(0, 150),
        items = Array.isArray(p.questions) ? p.questions : [],
        riskEnabled = !!p.riskEnabled;
      if (!title || !items.length)
        return json({ error: "Başlık ve en az bir soru gerekli." }, 400);
      const quizId =
          action === "update" ? String(p.quizId) : crypto.randomUUID(),
        now = Date.now();
      const inserts = items.map((q: any, i: number) => {
        const prompt = String(q.prompt || "").trim().slice(0, 500);
        const options = Array.isArray(q.options)
          ? q.options.map((o: unknown) => String(o ?? "").trim().slice(0, 200))
          : ["", "", "", ""];
        while (options.length < 4) options.push("");
        const safeOptions = options.slice(0, 4);
        const correctIndex = Math.max(0, Math.min(3, parseInt(String(q.correctIndex), 10) || 0));
        const seconds = Math.max(5, Math.min(180, parseInt(String(q.seconds), 10) || 20));
        const points = Math.max(0, Math.min(10000, parseInt(String(q.points), 10) || 1000));
        const imageUrl = String(q.imageUrl || "").trim().slice(0, 1000);

        return db
          .prepare(
            "INSERT INTO questions(id,quiz_id,position,prompt,options_json,correct_index,seconds,max_points,image_url) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            quizId,
            i,
            prompt,
            JSON.stringify(safeOptions),
            correctIndex,
            seconds,
            points,
            imageUrl,
          );
      });
      if (action === "update") {
        const oldRooms = await db
          .prepare("SELECT id FROM rooms WHERE quiz_id=?")
          .bind(quizId)
          .all<any>();
        const cleanup = oldRooms.results.flatMap((r: any) => [
          db.prepare("DELETE FROM answers WHERE room_id=?").bind(r.id),
          db.prepare("DELETE FROM players WHERE room_id=?").bind(r.id),
        ]);
        await db.batch([
          ...cleanup,
          db.prepare("DELETE FROM rooms WHERE quiz_id=?").bind(quizId),
          db
            .prepare("UPDATE quizzes SET title=?,risk_enabled=? WHERE id=?")
            .bind(title, riskEnabled ? 1 : 0, quizId),
          db.prepare("DELETE FROM questions WHERE quiz_id=?").bind(quizId),
          ...inserts,
        ]);
      } else
        await db.batch([
          db
            .prepare(
              "INSERT INTO quizzes(id,title,risk_enabled,created_at) VALUES(?,?,?,?)",
            )
            .bind(quizId, title, riskEnabled ? 1 : 0, now),
          ...inserts,
        ]);
      return json({ saved: true, quizId, quizzes: await listQuizzes(db) }, 201);
    }
    if (action === "copy") {
      const source = String(p.quizId),
        all = await listQuizzes(db),
        q = all.find((x) => x.id === source);
      if (!q) return json({ error: "Yarışma bulunamadı." }, 404);
      const quizId = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            "INSERT INTO quizzes(id,title,risk_enabled,created_at) VALUES(?,?,?,?)",
          )
          .bind(
            quizId,
            q.title + " — Kopya",
            q.riskEnabled ? 1 : 0,
            Date.now(),
          ),
        ...q.questions.map((x: any, i: number) =>
          db
            .prepare(
              "INSERT INTO questions(id,quiz_id,position,prompt,options_json,correct_index,seconds,max_points,image_url) VALUES(?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              quizId,
              i,
              x.prompt,
              JSON.stringify(x.options),
              x.correctIndex,
              x.seconds,
              x.points,
              x.imageUrl || "",
            ),
        ),
      ]);
      return json({ quizzes: await listQuizzes(db) }, 201);
    }
    if (action === "delete") {
      const quizId = String(p.quizId);
      const rooms = (
        await db
          .prepare("SELECT id FROM rooms WHERE quiz_id=?")
          .bind(quizId)
          .all<any>()
      ).results;
      for (const r of rooms)
        await db.batch([
          db.prepare("DELETE FROM answers WHERE room_id=?").bind(r.id),
          db.prepare("DELETE FROM players WHERE room_id=?").bind(r.id),
        ]);
      await db.batch([
        db.prepare("DELETE FROM rooms WHERE quiz_id=?").bind(quizId),
        db.prepare("DELETE FROM questions WHERE quiz_id=?").bind(quizId),
        db.prepare("DELETE FROM quizzes WHERE id=?").bind(quizId),
      ]);
      return json({ quizzes: await listQuizzes(db) });
    }
    if (action === "start") {
      const quizId = String(p.quizId || ""),
        count = Number(
          (
            await db
              .prepare("SELECT COUNT(*) n FROM questions WHERE quiz_id=?")
              .bind(quizId)
              .first<any>()
          )?.n || 0,
        );
      if (!count) return json({ error: "Yarışma bulunamadı." }, 404);
      void cleanupStaleRooms(db);
      const roomCode = await generateUniqueRoomCode(db),
        hostToken = crypto.randomUUID(),
        doubleQuestion = count > 2 ? Math.floor(Math.random() * count) : -1,
        quiz = await db
          .prepare("SELECT risk_enabled FROM quizzes WHERE id=?")
          .bind(quizId)
          .first<any>();
      await db
        .prepare(
          "INSERT INTO rooms(id,code,quiz_id,host_token,status,current_question,double_question,risk_enabled,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          roomCode,
          quizId,
          hostToken,
          "lobby",
          -1,
          doubleQuestion,
          quiz?.risk_enabled ? 1 : 0,
          Date.now(),
        )
        .run();
      return json({ code: roomCode, hostToken }, 201);
    }
    return json({ error: "Geçersiz işlem." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Yönetici işlemi tamamlanamadı." }, 500);
  }
}
