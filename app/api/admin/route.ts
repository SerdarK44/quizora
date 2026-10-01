import { getRawDb } from "../../../db";
const PASSWORD_HASH =
  "79eceb95913939893f07bcc38a6fa2fdad0fb738899275667c1e530eaaa6263b";
const SESSION =
  "7f5d4f2e8d27e2c41f7f9d99c99038eb510aa67c5acf62406d5c306b397da83b";
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
async function listQuizzes(db: D1Database) {
  const quizzes = (
    await db
      .prepare(
        "SELECT id,title,created_at FROM quizzes ORDER BY created_at DESC",
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
    questions: questions
      .filter((x) => x.quiz_id === q.id)
      .map((x) => ({
        prompt: x.prompt,
        options: JSON.parse(x.options_json),
        correctIndex: x.correct_index,
        seconds: x.seconds,
        points: x.max_points,
        imageUrl: x.image_url || "",
      })),
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
    if (
      String(p.username) !== "admin" ||
      (await passwordHash(String(p.password || ""))) !== PASSWORD_HASH
    )
      return json({ error: "Kullanıcı adı veya şifre hatalı." }, 401);
    return json({ authenticated: true }, 200, {
      "Set-Cookie": `quizora_admin=${SESSION}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`,
    });
  }
  if (!authed(request))
    return json({ error: "Yönetici oturumu gerekli." }, 401);
  try {
    const db = getRawDb();
    if (action === "save" || action === "update") {
      const title = String(p.title || "").trim(),
        items = Array.isArray(p.questions) ? p.questions : [];
      if (!title || !items.length)
        return json({ error: "Başlık ve soru gerekli." }, 400);
      const quizId =
          action === "update" ? String(p.quizId) : crypto.randomUUID(),
        now = Date.now();
      const inserts = items.map((q: any, i: number) =>
        db
          .prepare(
            "INSERT INTO questions(id,quiz_id,position,prompt,options_json,correct_index,seconds,max_points,image_url) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            quizId,
            i,
            String(q.prompt),
            JSON.stringify(q.options),
            Number(q.correctIndex),
            Number(q.seconds) || 20,
            Number(q.points) || 1000,
            String(q.imageUrl || ""),
          ),
      );
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
          db.prepare("UPDATE quizzes SET title=? WHERE id=?").bind(title, quizId),
          db.prepare("DELETE FROM questions WHERE quiz_id=?").bind(quizId),
          ...inserts,
        ]);
      }
      else
        await db.batch([
          db
            .prepare("INSERT INTO quizzes(id,title,created_at) VALUES(?,?,?)")
            .bind(quizId, title, now),
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
          .prepare("INSERT INTO quizzes(id,title,created_at) VALUES(?,?,?)")
          .bind(quizId, q.title + " — Kopya", Date.now()),
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
      const roomCode = String(Math.floor(100000 + Math.random() * 900000)),
        hostToken = crypto.randomUUID(),
        doubleQuestion = count > 2 ? Math.floor(Math.random() * count) : -1;
      await db
        .prepare(
          "INSERT INTO rooms(id,code,quiz_id,host_token,status,current_question,double_question,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          roomCode,
          quizId,
          hostToken,
          "lobby",
          -1,
          doubleQuestion,
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
