import { getRawDb } from "../../../db";
const json = (data: unknown, status = 200) => Response.json(data, { status });
const id = () => crypto.randomUUID();
const ADMIN_SESSION =
  "7f5d4f2e8d27e2c41f7f9d99c99038eb510aa67c5acf62406d5c306b397da83b";
const isAdmin = (r: Request) =>
  (r.headers.get("cookie") || "")
    .split(";")
    .some((x) => x.trim() === `quizora_admin=${ADMIN_SESSION}`);
async function readBody(r: Request) {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
async function finishRound(db: D1Database, room: any, question: any) {
  const locked = await db
    .prepare(
      "UPDATE rooms SET status='results' WHERE id=? AND status='question'",
    )
    .bind(room.id)
    .run();
  if (Number(locked.meta.changes || 0) > 0)
    await db
      .prepare(
        "UPDATE players SET score=score+COALESCE((SELECT points FROM answers WHERE answers.player_id=players.id AND answers.question_id=?),0) WHERE room_id=?",
      )
      .bind(question.id, room.id)
      .run();
}
export async function GET(request: Request) {
  try {
    const db = getRawDb(),
      u = new URL(request.url),
      roomCode = (u.searchParams.get("code") || "").replace(/\D/g, "");
    let room = await db
      .prepare("SELECT * FROM rooms WHERE code=?")
      .bind(roomCode)
      .first<Record<string, any>>();
    if (!room) return json({ error: "Oda bulunamadı." }, 404);
    const qs = (
      await db
        .prepare(
          "SELECT id,position,prompt,options_json,seconds,max_points,image_url,correct_index FROM questions WHERE quiz_id=? ORDER BY position",
        )
        .bind(room.quiz_id)
        .all<Record<string, any>>()
    ).results;
    const qi = Number(room.current_question),
      q = qi >= 0 ? qs[qi] : null;
    let answered = q
      ? Number(
          (
            await db
              .prepare(
                "SELECT COUNT(*) n FROM answers WHERE room_id=? AND question_id=?",
              )
              .bind(room.id, q.id)
              .first<Record<string, any>>()
          )?.n || 0,
        )
      : 0;
    const playerCount = Number(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM players WHERE room_id=?")
          .bind(room.id)
          .first<Record<string, any>>()
      )?.n || 0,
    );
    if (
      room.status === "question" &&
      q &&
      ((answered >= playerCount && playerCount > 0) ||
        Date.now() >=
          Number(room.question_started_at) + Number(q.seconds) * 1000)
    ) {
      await finishRound(db, room, q);
      room = { ...room, status: "results" };
    }
    const basePlayers = (
      await db
        .prepare(
          "SELECT id,name,score FROM players WHERE room_id=? ORDER BY score DESC,joined_at ASC",
        )
        .bind(room.id)
        .all<Record<string, any>>()
    ).results;
    const answerRows = (
      await db
        .prepare(
          "SELECT a.player_id,a.points,a.is_correct,a.risk,a.answered_at,q.position FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.room_id=? ORDER BY q.position",
        )
        .bind(room.id)
        .all<Record<string, any>>()
    ).results;
    const playerStats = new Map<
      string,
      { streak: number; roundPoints: number }
    >();
    for (const p of basePlayers)
      playerStats.set(p.id, { streak: 0, roundPoints: 0 });
    for (const a of answerRows) {
      const s = playerStats.get(a.player_id);
      if (!s) continue;
      s.streak = a.is_correct ? s.streak + 1 : 0;
      if (Number(a.position) === qi) s.roundPoints = Number(a.points);
    }
    const players = basePlayers.map((p) => ({
      ...p,
      ...playerStats.get(p.id),
    }));
    const roundWinner =
      room.status === "results"
        ? [...players].sort((a, b) => b.roundPoints - a.roundPoints)[0]
        : null;
    const previousOrder = [...players].sort(
      (a, b) => b.score - b.roundPoints - (a.score - a.roundPoints),
    );
    const currentRanks = new Map(players.map((p, i) => [p.id, i]));
    const biggestRiser =
      room.status === "results"
        ? previousOrder
            .map((p, oldRank) => ({
              p,
              rise: oldRank - (currentRanks.get(p.id) || 0),
            }))
            .sort((a, b) => b.rise - a.rise)[0]
        : null;
    const quips = [
      "alev aldı!",
      "roket gibi gidiyor!",
      "cevapları kahvaltıda yemiş!",
      "klavyeye sihir yaptı!",
      "bu turu cebine koydu!",
      "bilgi motorunu çalıştırdı!",
    ];
    const roundMessage =
      roundWinner && roundWinner.roundPoints > 0
        ? `${roundWinner.name} ${quips[(qi + roundWinner.name.length) % quips.length]}`
        : null;
    const currentCorrect = answerRows
        .filter((a) => Number(a.position) === qi && a.is_correct)
        .sort((a, b) => a.answered_at - b.answered_at),
      fastest = currentCorrect[0],
      lastSecond = currentCorrect
        .filter(
          (a) =>
            Number(a.answered_at) >=
            Number(room.question_started_at) +
              (Number(q?.seconds || 0) - 2) * 1000,
        )
        .at(-1);
    const awards = {
      fastest: fastest
        ? basePlayers.find((p) => p.id === fastest.player_id)?.name
        : null,
      biggestRise:
        biggestRiser && biggestRiser.rise > 0 ? biggestRiser.p.name : null,
      lastSecond: lastSecond
        ? basePlayers.find((p) => p.id === lastSecond.player_id)?.name
        : null,
    };
    const token = u.searchParams.get("playerToken"),
      host = u.searchParams.get("hostToken") === room.host_token;
    let player = null,
      hasAnswered = false;
    if (token) {
      player = await db
        .prepare(
          "SELECT id,name,score FROM players WHERE room_id=? AND token=?",
        )
        .bind(room.id, token)
        .first<Record<string, any>>();
      if (player && q)
        hasAnswered = !!(await db
          .prepare("SELECT 1 FROM answers WHERE player_id=? AND question_id=?")
          .bind(player.id, q.id)
          .first());
    }
    const enrichedPlayer = player
      ? players.find((p) => p.id === player.id)
      : null;
    return json({
      room: {
        code: room.code,
        status: room.status,
        currentQuestion: qi,
        questionStartedAt: room.question_started_at,
        totalQuestions: qs.length,
        isDouble: qi === Number(room.double_question),
      },
      question: q
        ? {
            id: q.id,
            prompt: q.prompt,
            options: JSON.parse(q.options_json),
            seconds: q.seconds,
            imageUrl: q.image_url || "",
            ...(room.status === "results" || room.status === "finished" || host
              ? { correctIndex: q.correct_index }
              : {}),
          }
        : null,
      players,
      player: enrichedPlayer
        ? {
            ...enrichedPlayer,
            score: room.status === "question" ? null : enrichedPlayer.score,
          }
        : null,
      hasAnswered,
      answered,
      isHost: host,
      roundMessage,
      awards,
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Oyun verileri yüklenemedi." }, 500);
  }
}
export async function POST(request: Request) {
  try {
    const db = getRawDb(),
      p = await readBody(request),
      action = String(p.action || "");
    if (action === "create") {
      if (!isAdmin(request))
        return json({ error: "Yönetici oturumu gerekli." }, 401);
      const title = String(p.title || "").trim(),
        items = Array.isArray(p.questions) ? (p.questions as any[]) : [];
      if (
        !title ||
        !items.length ||
        items.some(
          (q) =>
            !String(q.prompt).trim() ||
            !Array.isArray(q.options) ||
            q.options.some((o: unknown) => !String(o).trim()),
        )
      )
        return json({ error: "Tüm soru ve seçenekleri doldur." }, 400);
      const quizId = id(),
        roomId = id(),
        hostToken = id(),
        roomCode = String(Math.floor(100000 + Math.random() * 900000)),
        now = Date.now();
      await db.batch([
        db
          .prepare("INSERT INTO quizzes(id,title,created_at) VALUES(?,?,?)")
          .bind(quizId, title, now),
        ...items.map((q, i) =>
          db
            .prepare(
              "INSERT INTO questions(id,quiz_id,position,prompt,options_json,correct_index,seconds,max_points,image_url) VALUES(?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              id(),
              quizId,
              i,
              String(q.prompt).trim(),
              JSON.stringify(q.options),
              Number(q.correctIndex),
              Math.max(5, Math.min(120, Number(q.seconds) || 20)),
              Math.max(100, Math.min(5000, Number(q.points) || 1000)),
              String(q.imageUrl || ""),
            ),
        ),
        db
          .prepare(
            "INSERT INTO rooms(id,code,quiz_id,host_token,status,current_question,double_question,created_at) VALUES(?,?,?,?,?,?,?,?)",
          )
          .bind(
            roomId,
            roomCode,
            quizId,
            hostToken,
            "lobby",
            -1,
            items.length > 2 ? Math.floor(Math.random() * items.length) : -1,
            now,
          ),
      ]);
      return json({ code: roomCode, hostToken }, 201);
    }
    const roomCode = String(p.code || "").replace(/\D/g, ""),
      room = await db
        .prepare("SELECT * FROM rooms WHERE code=?")
        .bind(roomCode)
        .first<Record<string, any>>();
    if (!room) return json({ error: "Oda bulunamadı." }, 404);
    if (action === "join") {
      if (room.status !== "lobby")
        return json({ error: "Bu oyun başlamış." }, 409);
      const name = String(p.name || "")
        .trim()
        .slice(0, 24);
      if (!name) return json({ error: "Bir isim yaz." }, 400);
      const token = id();
      await db
        .prepare(
          "INSERT INTO players(id,room_id,name,token,score,joined_at) VALUES(?,?,?,?,0,?)",
        )
        .bind(id(), room.id, name, token, Date.now())
        .run();
      return json({ playerToken: token }, 201);
    }
    if (action === "advance") {
      if (String(p.hostToken) !== room.host_token)
        return json({ error: "Yetkisiz işlem." }, 403);
      if (room.status === "question") {
        const q = await db
          .prepare("SELECT id FROM questions WHERE quiz_id=? AND position=?")
          .bind(room.quiz_id, room.current_question)
          .first();
        if (q) await finishRound(db, room, q);
        return json({ ok: true });
      }
      const count = Number(
          (
            await db
              .prepare("SELECT COUNT(*) n FROM questions WHERE quiz_id=?")
              .bind(room.quiz_id)
              .first<Record<string, any>>()
          )?.n || 0,
        ),
        next = Number(room.current_question) + 1;
      if (next >= count)
        await db
          .prepare("UPDATE rooms SET status='finished' WHERE id=?")
          .bind(room.id)
          .run();
      else
        await db
          .prepare(
            "UPDATE rooms SET status='question',current_question=?,question_started_at=? WHERE id=?",
          )
          .bind(next, Date.now(), room.id)
          .run();
      return json({ ok: true });
    }
    if (action === "kick") {
      if (String(p.hostToken) !== room.host_token)
        return json({ error: "Yetkisiz işlem." }, 403);
      const playerId = String(p.playerId);
      await db.batch([
        db.prepare("DELETE FROM answers WHERE player_id=?").bind(playerId),
        db
          .prepare("DELETE FROM players WHERE id=? AND room_id=?")
          .bind(playerId, room.id),
      ]);
      return json({ ok: true });
    }
    if (action === "answer") {
      if (room.status !== "question")
        return json({ error: "Cevap süresi kapandı." }, 409);
      const player = await db
        .prepare("SELECT * FROM players WHERE room_id=? AND token=?")
        .bind(room.id, String(p.playerToken))
        .first<Record<string, any>>();
      if (!player) return json({ error: "Oyuncu bulunamadı." }, 403);
      const q = await db
        .prepare("SELECT * FROM questions WHERE quiz_id=? AND position=?")
        .bind(room.quiz_id, room.current_question)
        .first<Record<string, any>>();
      if (
        !q ||
        Date.now() >=
          Number(room.question_started_at) + Number(q.seconds) * 1000
      )
        return json({ error: "Süre doldu." }, 409);
      const option = Number(p.optionIndex),
        correct = option === Number(q.correct_index),
        risk = !!p.risk,
        elapsed = Math.max(0, Date.now() - Number(room.question_started_at)),
        ratio = Math.max(0, 1 - elapsed / (Number(q.seconds) * 1000)),
        maxPoints = Number(q.max_points) || 1000,
        double =
          Number(room.current_question) === Number(room.double_question)
            ? 2
            : 1,
        base = Math.round(maxPoints * (0.5 + 0.5 * ratio)) * double,
        points = correct
          ? risk
            ? base * 2
            : base
          : risk
            ? -Math.round(maxPoints * 0.25)
            : 0;
      try {
        await db
          .prepare(
            "INSERT INTO answers(id,room_id,player_id,question_id,option_index,is_correct,risk,points,answered_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id(),
            room.id,
            player.id,
            q.id,
            option,
            correct ? 1 : 0,
            risk ? 1 : 0,
            points,
            Date.now(),
          )
          .run();
      } catch {
        return json({ error: "Bu soruyu zaten cevapladın." }, 409);
      }
      return json({ received: true });
    }
    return json({ error: "Geçersiz işlem." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Sunucu işlemi tamamlayamadı." }, 500);
  }
}
