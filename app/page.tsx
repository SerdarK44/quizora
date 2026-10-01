"use client";
import { useEffect, useState } from "react";
type Q = {
  prompt: string;
  options: string[];
  correctIndex: number;
  seconds: number;
  points?: number;
  imageUrl?: string;
};
const seed: Q[] = [
    {
      prompt: "Türkiye'nin başkenti neresidir?",
      options: ["Ankara", "İstanbul", "İzmir", "Bursa"],
      correctIndex: 0,
      seconds: 20,
    },
    {
      prompt: "Güneş sistemindeki en büyük gezegen hangisidir?",
      options: ["Dünya", "Satürn", "Jüpiter", "Mars"],
      correctIndex: 2,
      seconds: 20,
    },
    {
      prompt: "Bir ahtapotun kaç kalbi vardır?",
      options: ["Bir", "İki", "Üç", "Dört"],
      correctIndex: 2,
      seconds: 20,
    },
    {
      prompt: "Dünyanın en büyük okyanusu hangisidir?",
      options: ["Atlas", "Hint", "Pasifik", "Arktik"],
      correctIndex: 2,
      seconds: 20,
    },
    {
      prompt: "Hangisi bir programlama dili değildir?",
      options: ["Python", "Ruby", "Cobra", "Photoshop"],
      correctIndex: 3,
      seconds: 20,
    },
    {
      prompt: "Işık bir saniyede yaklaşık kaç kilometre yol alır?",
      options: ["30 bin", "300 bin", "3 milyon", "30 milyon"],
      correctIndex: 1,
      seconds: 30,
    },
    {
      prompt: "Mona Lisa tablosunu kim yapmıştır?",
      options: ["Van Gogh", "Picasso", "Da Vinci", "Michelangelo"],
      correctIndex: 2,
      seconds: 20,
    },
    {
      prompt: "İnsan vücudundaki en büyük organ hangisidir?",
      options: ["Karaciğer", "Deri", "Akciğer", "Beyin"],
      correctIndex: 1,
      seconds: 20,
    },
  ],
  shapes = ["▲", "◆", "●", "■"];
async function api(method: string, data?: any, query = "") {
  const r = await fetch("/api/game" + query, {
    method,
    headers: { "content-type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Bir hata oluştu");
  return j;
}
async function adminApi(method: string, data?: any) {
  const r = await fetch("/api/admin", {
    method,
    headers: { "content-type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Yönetici oturumu gerekli");
  return j;
}
export default function Home() {
  const [view, setView] = useState<
      "home" | "login" | "editor" | "host" | "player"
    >("home"),
    [title, setTitle] = useState("Genel Kültür Yarışması"),
    [questions, setQuestions] = useState<Q[]>(seed),
    [selected, setSelected] = useState(0),
    [activeQuizId, setActiveQuizId] = useState(""),
    [bulkPoints, setBulkPoints] = useState(1000),
    [bulkSeconds, setBulkSeconds] = useState(20),
    [savedQuizzes, setSavedQuizzes] = useState<any[]>([]),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [hostToken, setHostToken] = useState(""),
    [playerToken, setPlayerToken] = useState(""),
    [risk, setRisk] = useState(false),
    [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const poll = async () => {
    if (!code) return;
    try {
      const qs = new URLSearchParams({
        code,
        ...(hostToken ? { hostToken } : {}),
        ...(playerToken ? { playerToken } : {}),
      });
      setState(await api("GET", undefined, "?" + qs));
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("quizora-active") || "null");
      if (s?.code) {
        setCode(s.code);
        setName(s.name || "");
        if (s.hostToken) {
          setHostToken(s.hostToken);
          setView("host");
        } else if (s.playerToken) {
          setPlayerToken(s.playerToken);
          setView("player");
        }
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (view !== "host" && view !== "player") return;
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [view, code, hostToken, playerToken]);
  const loadLibrary = async () => {
      const r = await adminApi("GET");
      setSavedQuizzes(r.quizzes || []);
    },
    openAdmin = async () => {
      try {
        await loadLibrary();
        setView("editor");
      } catch {
        setView("login");
      }
    },
    login = async () => {
      setBusy(true);
      try {
        await adminApi("POST", { action: "login", username, password });
        await loadLibrary();
        setError("");
        setView("editor");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    saveQuiz = async () => {
      setBusy(true);
      try {
        const r = await adminApi("POST", {
          action: activeQuizId ? "update" : "save",
          quizId: activeQuizId,
          title,
          questions,
        });
        setSavedQuizzes(r.quizzes || []);
        setActiveQuizId(r.quizId || activeQuizId);
        setError("");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    copyQuiz = async (id: string) => {
      const r = await adminApi("POST", { action: "copy", quizId: id });
      setSavedQuizzes(r.quizzes || []);
    },
    deleteQuiz = async (id: string) => {
      const r = await adminApi("POST", { action: "delete", quizId: id });
      setSavedQuizzes(r.quizzes || []);
      if (activeQuizId === id) setActiveQuizId("");
    },
    startSaved = async (quizId: string) => {
      setBusy(true);
      try {
        const r = await adminApi("POST", { action: "start", quizId });
        setCode(r.code);
        setHostToken(r.hostToken);
        localStorage.setItem(
          "quizora-active",
          JSON.stringify({ code: r.code, hostToken: r.hostToken }),
        );
        setView("host");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    create = async () => {
      setBusy(true);
      try {
        const r = await api("POST", { action: "create", title, questions });
        setCode(r.code);
        setHostToken(r.hostToken);
        localStorage.setItem(
          "quizora-active",
          JSON.stringify({ code: r.code, hostToken: r.hostToken }),
        );
        setView("host");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    join = async () => {
      setBusy(true);
      try {
        const r = await api("POST", { action: "join", code, name });
        setPlayerToken(r.playerToken);
        localStorage.setItem(
          "quizora-active",
          JSON.stringify({ code, name, playerToken: r.playerToken }),
        );
        setView("player");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    advance = async () => {
      await api("POST", { action: "advance", code, hostToken });
      setRisk(false);
      poll();
    },
    answer = async (i: number) => {
      if (state?.hasAnswered) return;
      try {
        await api("POST", {
          action: "answer",
          code,
          playerToken,
          optionIndex: i,
          risk,
        });
        setRisk(false);
        poll();
      } catch (e: any) {
        setError(e.message);
      }
    };
  if (view === "home")
    return (
      <main className="landing">
        <header>
          <Logo />
          <button className="ghost" onClick={openAdmin}>
            Yönetici paneli
          </button>
        </header>
        <section className="join">
          <span className="kicker">CANLI BİLGİ YARIŞMASI</span>
          <h1>
            Oyun kodunu gir,
            <br />
            yarışmaya katıl.
          </h1>
          <p>Soruyu ekranda gör, cevabını seç ve zirveye çık.</p>
          <div className="joincard">
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Oyun kodu"
              inputMode="numeric"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Takma adın"
            />
            <button onClick={join} disabled={busy}>
              Oyuna katıl
            </button>
            {error && <small>{error}</small>}
          </div>
          <button className="hostlink" onClick={openAdmin}>
            Yeni bir oyun hazırla
          </button>
        </section>
      </main>
    );
  if (view === "login")
    return (
      <main className="adminlogin">
        <div className="loginpanel">
          <Logo />
          <span className="kicker">YÖNETİCİ GİRİŞİ</span>
          <h1>Tekrar hoş geldin.</h1>
          <p>Yarışmalarına ulaşmak için giriş yap.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <label>
              Kullanıcı adı
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Şifre
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Giriş yapılıyor…" : "Giriş yap"}
            </button>
            {error && <small>{error}</small>}
          </form>
          <button className="backlink" onClick={() => setView("home")}>
            Oyuncu ekranına dön
          </button>
        </div>
      </main>
    );
  if (view === "editor")
    return (
      <AdminWorkspace
        {...{
          title,
          setTitle,
          questions,
          setQuestions,
          selected,
          setSelected,
          activeQuizId,
          setActiveQuizId,
          bulkPoints,
          setBulkPoints,
          bulkSeconds,
          setBulkSeconds,
          savedQuizzes,
          saveQuiz,
          copyQuiz,
          deleteQuiz,
          startSaved,
          create,
          busy,
          error,
          setView,
        }}
      />
    );
  if (!state) return <main className="loading">Oyun yükleniyor…</main>;
  const room = state.room,
    q = state.question,
    players = state.players || [];
  if (view === "host")
    return (
      <main className="gamehost">
        <div className="gamebar">
          <Logo />
          <span className="code">
            Oyun kodu <b>{room.code}</b>
          </span>
          <span>{players.length} oyuncu</span>
        </div>
        {room.status === "lobby" ? (
          <section className="lobby">
            <span className="kicker">OYUNCULAR BEKLENİYOR</span>
            <h1>{room.code}</h1>
            <p>Oyuncular bu kodla katılabilir.</p>
            <div className="chips">
              {players.map((p: any) => (
                <span key={p.id}>
                  {p.name}
                  <button
                    aria-label={p.name + " oyuncusunu çıkar"}
                    onClick={async () => {
                      await api("POST", {
                        action: "kick",
                        code,
                        hostToken,
                        playerId: p.id,
                      });
                      poll();
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              className="primary big"
              onClick={advance}
              disabled={!players.length}
            >
              Oyunu başlat
            </button>
          </section>
        ) : room.status === "finished" ? (
          <Podium
            players={players}
            onExit={() => {
              localStorage.removeItem("quizora-active");
              setView("home");
            }}
          />
        ) : room.status === "results" ? (
          <RoundResults
            q={q}
            players={players}
            message={state.roundMessage}
            awards={state.awards}
            onNext={advance}
          />
        ) : (
          <GameScreen
            q={q}
            room={room}
            state={state}
            host
            onAnswer={() => {}}
            footer={
              <button className="next" onClick={advance}>
                Turu bitir
              </button>
            }
          />
        )}
      </main>
    );
  if (room.status === "lobby")
    return (
      <main className="playerwait" role="status">
        <Logo />
        <div className="pulse" aria-hidden="true">
          ✓
        </div>
        <h1>Oyundasın!</h1>
        <p>
          <b>{name}</b>, yönetici oyunu başlatınca ilk soru burada açılacak.
        </p>
        <span className="waitcode">Oda {room.code}</span>
      </main>
    );
  if (room.status === "finished")
    return (
      <Podium
        players={players}
        personal={state.player}
        onExit={() => {
          localStorage.removeItem("quizora-active");
          setView("home");
        }}
      />
    );
  if (room.status === "results")
    return (
      <RoundResults
        q={q}
        players={players}
        personal={state.player}
        message={state.roundMessage}
        awards={state.awards}
      />
    );
  return (
    <GameScreen
      q={q}
      room={room}
      state={state}
      risk={risk}
      setRisk={setRisk}
      onAnswer={answer}
      footer={
        state.hasAnswered ? (
          <div className="answered" role="status">
            <b>✓ Cevabın alındı</b>
            <span>Turun bitmesini bekle</span>
          </div>
        ) : null
      }
    />
  );
}
function AdminWorkspace(p: any) {
  const {
    title,
    setTitle,
    questions,
    setQuestions,
    selected,
    setSelected,
    activeQuizId,
    setActiveQuizId,
    bulkPoints,
    setBulkPoints,
    bulkSeconds,
    setBulkSeconds,
    savedQuizzes,
    saveQuiz,
    copyQuiz,
    deleteQuiz,
    startSaved,
    create,
    busy,
    error,
    setView,
  } = p;
  const [search, setSearch] = useState(""),
    [preview, setPreview] = useState(false);
  const q = questions[selected] || questions[0];
  const update = (patch: any) => {
    const next = [...questions];
    next[selected] = { ...q, ...patch };
    setQuestions(next);
  };
  const add = () => {
    setQuestions([
      ...questions,
      {
        prompt: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        seconds: bulkSeconds,
        points: bulkPoints,
        imageUrl: "",
      },
    ]);
    setSelected(questions.length);
  };
  const remove = () => {
    if (questions.length === 1) return;
    const next = questions.filter((_: any, i: number) => i !== selected);
    setQuestions(next);
    setSelected(Math.max(0, selected - 1));
  };
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...questions],
      item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    setQuestions(next);
    setSelected(to);
  };
  const filtered = savedQuizzes.filter((x: any) =>
    x.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="admin studioapp">
      <header>
        <Logo />
        <div className="studioactions">
          <button className="ghost" onClick={() => setView("home")}>
            Çıkış
          </button>
          <button className="ghost savebtn" onClick={saveQuiz} disabled={busy}>
            {activeQuizId ? "Güncelle" : "Kaydet"}
          </button>
          <button
            className="primary"
            onClick={create}
            disabled={busy || !questions.length}
          >
            {busy ? "Hazırlanıyor…" : "Oda oluştur"}
          </button>
        </div>
      </header>
      <div className="studiotitle">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Yarışma adı"
        />
        <span>{questions.length} soru</span>
      </div>
      <section className="studio">
        <aside className="librarypane">
          <div className="panetitle">
            <span>YARIŞMALARIM</span>
            <b>{savedQuizzes.length}</b>
          </div>
          <input
            className="quizsearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Yarışma ara…"
            aria-label="Yarışma ara"
          />
          <div className="librarylist">
            {filtered.map((item: any) => (
              <article
                className={activeQuizId === item.id ? "selected" : ""}
                key={item.id}
              >
                <button
                  onClick={() => {
                    setActiveQuizId(item.id);
                    setTitle(item.title);
                    setQuestions(item.questions);
                    setSelected(0);
                  }}
                >
                  <strong>{item.title}</strong>
                  <small>{item.questions.length} soru</small>
                </button>
                <div className="libactions">
                  <button
                    onClick={() => startSaved(item.id)}
                    aria-label={item.title + " yarışmasını başlat"}
                    title="Başlat"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => copyQuiz(item.id)}
                    aria-label={item.title + " yarışmasını kopyala"}
                    title="Kopyala"
                  >
                    ⧉
                  </button>
                  <button
                    onClick={() => deleteQuiz(item.id)}
                    aria-label={item.title + " yarışmasını sil"}
                    title="Sil"
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <p>
                {search
                  ? "Eşleşen yarışma bulunamadı."
                  : "Kaydettiğin yarışmalar burada görünecek."}
              </p>
            )}
          </div>
          <div className="globalsettings">
            <div className="panetitle">
              <span>VARSAYILANLAR</span>
            </div>
            <label>
              Süre
              <select
                value={bulkSeconds}
                onChange={(e) => setBulkSeconds(+e.target.value)}
              >
                <option value="10">10 saniye</option>
                <option value="20">20 saniye</option>
                <option value="30">30 saniye</option>
                <option value="60">60 saniye</option>
              </select>
            </label>
            <label>
              Puan
              <input
                type="number"
                min="100"
                max="5000"
                step="100"
                value={bulkPoints}
                onChange={(e) => setBulkPoints(+e.target.value)}
              />
            </label>
            <button
              onClick={() =>
                setQuestions(
                  questions.map((x: any) => ({
                    ...x,
                    seconds: bulkSeconds,
                    points: bulkPoints,
                  })),
                )
              }
            >
              Tüm sorulara uygula
            </button>
          </div>
        </aside>
        <section className="builderpane">
          <div className="questionstrip">
            {questions.map((x: any, i: number) => (
              <button
                draggable
                className={i === selected ? "active" : ""}
                key={i}
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", String(i))
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  reorder(+e.dataTransfer.getData("text/plain"), i);
                }}
                onClick={() => setSelected(i)}
              >
                <b>{i + 1}</b>
                <span>{x.prompt || "Yeni soru"}</span>
              </button>
            ))}
            <button className="newquestion" onClick={add}>
              ＋ Yeni soru
            </button>
          </div>
          {q && (
            <article className="questioncanvas">
              <button
                className="previewtoggle"
                onClick={() => setPreview(!preview)}
              >
                {preview ? "Düzenle" : "Ön izle"}
              </button>
              <div className="canvaslabel">
                <span>SORU {selected + 1}</span>
                <span>
                  {preview ? "OYUNCU ÖN İZLEMESİ" : "Doğru cevabı işaretle"}
                </span>
              </div>
              {q.imageUrl && (
                <img
                  className="editorquestionimage"
                  src={q.imageUrl}
                  alt="Soru görseli"
                />
              )}
              {preview ? (
                <h2 className="previewprompt">
                  {q.prompt || "Soru metni burada görünecek"}
                </h2>
              ) : (
                <textarea
                  value={q.prompt}
                  onChange={(e) => update({ prompt: e.target.value })}
                  placeholder="Sorunu buraya yaz…"
                />
              )}
              <div className="canvasoptions">
                {q.options.map((o: string, i: number) => (
                  <label
                    className={
                      "canvasoption c" +
                      i +
                      (q.correctIndex === i ? " correct" : "")
                    }
                    key={i}
                  >
                    <span>{shapes[i]}</span>
                    <input
                      value={o}
                      onChange={(e) => {
                        const opts = [...q.options];
                        opts[i] = e.target.value;
                        update({ options: opts });
                      }}
                      placeholder={i + 1 + ". cevap"}
                    />
                    <button onClick={() => update({ correctIndex: i })}>
                      {q.correctIndex === i ? "✓" : ""}
                    </button>
                  </label>
                ))}
              </div>
            </article>
          )}
        </section>
        <aside className="inspector">
          <div className="panetitle">
            <span>SORU AYARLARI</span>
          </div>
          <label>
            Görsel URL
            <input
              value={q?.imageUrl || ""}
              onChange={(e) => update({ imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label>
            Süre
            <select
              value={q?.seconds || 20}
              onChange={(e) => update({ seconds: +e.target.value })}
            >
              <option value="10">10 saniye</option>
              <option value="20">20 saniye</option>
              <option value="30">30 saniye</option>
              <option value="60">60 saniye</option>
            </select>
          </label>
          <label>
            Puan
            <input
              type="number"
              min="100"
              max="5000"
              step="100"
              value={q?.points || 1000}
              onChange={(e) => update({ points: +e.target.value })}
            />
          </label>
          <div className="inspectmeta">
            <span>Doğru cevap</span>
            <b>{String.fromCharCode(65 + (q?.correctIndex || 0))}</b>
          </div>
          <button
            className="duplicate"
            onClick={() => {
              setQuestions([...questions, { ...q, options: [...q.options] }]);
              setSelected(questions.length);
            }}
          >
            Soruyu çoğalt
          </button>
          <button
            className="deletequestion"
            onClick={remove}
            disabled={questions.length === 1}
          >
            Soruyu sil
          </button>
        </aside>
      </section>
      {error && <div className="error">{error}</div>}
    </main>
  );
}
function Logo() {
  return (
    <div className="logo">
      <span>◆</span>Quizora
    </div>
  );
}
function GameScreen({
  q,
  room,
  state,
  host,
  risk,
  setRisk,
  onAnswer,
  footer,
}: any) {
  const current = room.currentQuestion + 1,
    remaining = room.totalQuestions - current;
  return (
    <main className={"gamescreen " + (host ? "hostscreen" : "playerscreen")}>
      <header className="playheader">
        <div>
          <span className="questioncount">Soru {current}</span>
          <span className="remaining">
            {remaining ? remaining + " soru kaldı" : "Son soru"}
          </span>
        </div>
        <div className="playstatus" role="status">
          {host ? (
            <>
              <b>{state.answered}</b>
              <span>{state.players.length} cevap</span>
            </>
          ) : state.hasAnswered ? (
            <>
              <b>✓</b>
              <span>Kaydedildi</span>
            </>
          ) : (
            <>
              <b>A–D</b>
              <span>Bir cevap seç</span>
            </>
          )}
        </div>
      </header>
      <div
        className="gameprogress"
        role="progressbar"
        aria-label="Yarışma ilerlemesi"
        aria-valuemin={1}
        aria-valuemax={room.totalQuestions}
        aria-valuenow={current}
      >
        <i style={{ width: (current / room.totalQuestions) * 100 + "%" }} />
      </div>
      <section className="questionarea" aria-labelledby="active-question">
        <Countdown startedAt={room.questionStartedAt} seconds={q?.seconds} />
        <div className="questioncontent">
          {room.isDouble && (
            <div className="doublebadge">✦ Sürpriz tur · 2× puan</div>
          )}
          {q?.imageUrl && (
            <img
              className="questionimage"
              src={q.imageUrl}
              alt="Soru görseli"
            />
          )}
          <h1 id="active-question">{q?.prompt}</h1>
        </div>
        {!host && !state.hasAnswered && (
          <button
            className={"riskbutton " + (risk ? "active" : "")}
            aria-pressed={risk}
            onClick={() => setRisk(!risk)}
          >
            <b>⚡ Risk {risk ? "açık" : "kapalı"}</b>
            <small>Doğruysa 2×, yanlışsa puan kaybı</small>
          </button>
        )}
      </section>
      <section className="answers" aria-label="Cevap seçenekleri">
        {q?.options.map((o: string, i: number) => (
          <button
            key={i}
            aria-label={String.fromCharCode(65 + i) + " seçeneği: " + o}
            className={"answer c" + i}
            onClick={() => !host && onAnswer(i)}
            disabled={host || state.hasAnswered}
          >
            <span aria-hidden="true">{String.fromCharCode(65 + i)}</span>
            <strong>{o}</strong>
            {!host && !state.hasAnswered && (
              <small aria-hidden="true">Seç</small>
            )}
          </button>
        ))}
      </section>
      {footer && <div className="gamefooter">{footer}</div>}
    </main>
  );
}
function Countdown({ startedAt, seconds }: any) {
  const [left, setLeft] = useState(seconds || 0);
  useEffect(() => {
    const tick = () =>
      setLeft(
        Math.max(
          0,
          Math.ceil(
            (Number(startedAt) + Number(seconds) * 1000 - Date.now()) / 1000,
          ),
        ),
      );
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt, seconds]);
  return (
    <div
      className={"clock " + (left <= 5 ? "urgent" : "")}
      role="timer"
      aria-label={"Kalan süre " + left + " saniye"}
    >
      <b>{left}</b>
      <small>sn</small>
    </div>
  );
}
function RoundResults({ q, players, personal, onNext, message, awards }: any) {
  const me = personal ? players.find((p: any) => p.id === personal.id) : null;
  return (
    <main className="roundresults">
      <section className="correctanswer">
        <span className="kicker">DOĞRU CEVAP</span>
        <h1>{q?.options?.[q.correctIndex]}</h1>
        {message && <div className="roundquip">⚡ {message}</div>}
        {awards && (
          <div className="roundawards">
            {awards.fastest && (
              <span>
                <b>⚡ En hızlı</b>
                {awards.fastest}
              </span>
            )}
            {awards.biggestRise && (
              <span>
                <b>↗ En büyük yükseliş</b>
                {awards.biggestRise}
              </span>
            )}
            {awards.lastSecond && (
              <span>
                <b>⏱ Son saniye</b>
                {awards.lastSecond}
              </span>
            )}
          </div>
        )}
      </section>
      <section className="roundboard">
        <span className="kicker">TUR SONU</span>
        <h2>Liderlik tablosu</h2>
        {me && (
          <div className="myround">
            <span>
              Senin sıran{" "}
              <b>#{players.findIndex((p: any) => p.id === me.id) + 1}</b>
            </span>
            <strong>+{me.roundPoints} puan</strong>
            {me.streak >= 2 && (
              <i>
                🔥 {streakLabel(me.streak)} · {me.streak} seri
              </i>
            )}
          </div>
        )}
        <div className="ranking">
          {players.slice(0, 8).map((p: any, i: number) => (
            <div className={personal?.id === p.id ? "me" : ""} key={p.id}>
              <b>{i + 1}</b>
              <span>
                {p.name}
                {p.streak >= 2 && (
                  <em>
                    🔥 {streakLabel(p.streak)} · {p.streak}
                  </em>
                )}
              </span>
              <strong>
                {p.score}
                <small>+{p.roundPoints}</small>
              </strong>
            </div>
          ))}
        </div>
        {onNext ? (
          <button className="primary" onClick={onNext}>
            Sonraki soru
          </button>
        ) : (
          <p className="waitingnext">Yönetici sonraki soruyu hazırlıyor…</p>
        )}
      </section>
    </main>
  );
}
function streakLabel(streak: number) {
  if (streak >= 8) return "Volkan";
  if (streak >= 5) return "Alev topu";
  if (streak >= 3) return "Alev aldı";
  return "Isınıyor";
}
function Podium({ players, personal, onExit }: any) {
  const top = players.slice(0, 3),
    meIndex = personal
      ? players.findIndex((p: any) => p.id === personal.id)
      : -1;
  return (
    <main className="podium">
      <span className="kicker">OYUN TAMAMLANDI</span>
      <h1>İşte şampiyonlar</h1>
      <div className="podiumstage">
        {[top[1], top[0], top[2]].map(
          (p: any, i: number) =>
            p && (
              <div className={"podiumplayer place" + [2, 1, 3][i]} key={p.id}>
                <div className="medal">{["2", "1", "3"][i]}</div>
                <strong>{p.name}</strong>
                {p.streak >= 2 && <span>🔥 {p.streak} seri</span>}
                <b>{p.score}</b>
                <div className="block">{["2", "1", "3"][i]}</div>
              </div>
            ),
        )}
      </div>
      {personal && (
        <div className="yourplace">
          <span>
            <small>SENİN SIRAN</small>
            <b>#{meIndex + 1}</b>
          </span>
          <strong>{personal.score} puan</strong>
          <em>
            {meIndex === 0
              ? "Taht senin 👑"
              : meIndex < 3
                ? "Podyumdasın, güzel iş!"
                : "Bir sonraki oyunda podyum yakın."}
          </em>
        </div>
      )}
      <div className="finalothers">
        {players.slice(3, 8).map((p: any, i: number) => (
          <div key={p.id}>
            <b>{i + 4}</b>
            <span>{p.name}</span>
            <strong>{p.score}</strong>
          </div>
        ))}
      </div>
      <button className="primary" onClick={onExit}>
        Ana sayfaya dön
      </button>
    </main>
  );
}
