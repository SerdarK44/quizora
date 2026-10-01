"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Trophy,
  Flame,
  Zap,
  Sparkles,
  Clock,
  Check,
  X,
  Users,
  Copy,
  Plus,
  Trash2,
  Shield,
  Edit3,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  ListOrdered,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Star,
  Upload,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ImageIcon,
} from "lucide-react";
import {
  playClick,
  playTick,
  playCountdownBeep,
  playSelect,
  playWrong,
  playFanfare,
  toggleMute,
  initSoundPreference,
  hapticFeedback,
  warmupAudio,
} from "@/lib/audio";
import { Confetti } from "@/components/confetti";
import { QRCodeCard } from "@/components/QRCodeCard";
import { ImportQuizModal } from "@/components/ImportQuizModal";
import { LibraryModal } from "@/components/LibraryModal";

interface Question {
  id?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  seconds: number;
  points?: number;
  imageUrl?: string;
}

interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  roundPoints: number;
}

interface Room {
  code: string;
  status: "lobby" | "question" | "results" | "finished";
  currentQuestion: number;
  questionStartedAt: number;
  totalQuestions: number;
  isDouble: boolean;
  riskEnabled: boolean;
}

interface GameState {
  serverTime?: number;
  room: Room;
  question: Question | null;
  players: Player[];
  player: Player | null;
  hasAnswered: boolean;
  answered: number;
  isHost: boolean;
  roundMessage: string | null;
  awards: {
    fastest: string | null;
    biggestRise: string | null;
    lastSecond: string | null;
  };
}

interface SavedQuiz {
  id: string;
  title: string;
  riskEnabled: boolean;
  questions: Question[];
}

const seed: Question[] = [
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
];

const shapes = ["▲", "◆", "●", "■"];
const shapeNames = [
  "Kırmızı Üçgen",
  "Mavi Baklava",
  "Sarı Daire",
  "Yeşil Kare",
];
const shapeLetters = ["A", "B", "C", "D"];
const answerBtnClasses = [
  "answer-btn-c0",
  "answer-btn-c1",
  "answer-btn-c2",
  "answer-btn-c3",
];

async function api(method: string, data?: unknown, query = "") {
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

async function adminApi(method: string, data?: unknown) {
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
  const [session] = useState<{
    code?: string;
    name?: string;
    hostToken?: string;
    playerToken?: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem("quizora-active") || "null");
    } catch {
      return null;
    }
  });

  const [view, setView] = useState<
    "home" | "login" | "editor" | "host" | "player"
  >(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const pinParam = urlParams.get("pin") || urlParams.get("code");
      if (pinParam) {
        return "home";
      }
    }
    if (session?.code) {
      if (session.hostToken) return "host";
      if (session.playerToken) return "player";
    }
    return "home";
  });
  const [title, setTitle] = useState("Genel Kültür Yarışması");
  const [questions, setQuestions] = useState<Question[]>(seed);
  const [selected, setSelected] = useState(0);
  const [activeQuizId, setActiveQuizId] = useState("");
  const [bulkPoints, setBulkPoints] = useState(1000);
  const [bulkSeconds, setBulkSeconds] = useState(20);
  const [riskEnabled, setRiskEnabled] = useState(false);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const pinParam = urlParams.get("pin") || urlParams.get("code");
      if (pinParam) {
        return pinParam.replace(/\D/g, "").slice(0, 6);
      }
    }
    return session?.code || "";
  });
  const [name, setName] = useState(() => session?.name || "");
  const [hostToken, setHostToken] = useState(() => session?.hostToken || "");
  const [playerToken, setPlayerToken] = useState(
    () => session?.playerToken || "",
  );
  const [risk, setRisk] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(() => initSoundPreference());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [screenAnnouncement, setScreenAnnouncement] = useState("");
  const [serverOffset, setServerOffset] = useState(0);

  const handleToggleSound = () => {
    const isNowMuted = toggleMute();
    setMuted(isNowMuted);
    if (!isNowMuted) playClick();
  };

  // Ultra low-latency poll function (called on action and on timer)
  const poll = useCallback(async () => {
    if (!code) return;
    try {
      const qs = new URLSearchParams({
        code,
        ...(hostToken ? { hostToken } : {}),
        ...(playerToken ? { playerToken } : {}),
      });
      const newState = (await api("GET", undefined, "?" + qs)) as GameState;
      if (typeof newState.serverTime === "number") {
        setServerOffset(newState.serverTime - Date.now());
      }
      setState(newState);
      setError("");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    }
  }, [code, hostToken, playerToken]);

  // Auto reset selection and risk state when question advances (React recommended pattern)
  const [prevQuestion, setPrevQuestion] = useState(state?.room?.currentQuestion);
  if (state?.room?.currentQuestion !== prevQuestion) {
    setPrevQuestion(state?.room?.currentQuestion);
    setSelectedOption(null);
    setRisk(false);
  }

  // Dynamic ultra-low latency polling based on game status + visibilitychange
  useEffect(() => {
    if (view !== "host" && view !== "player") return;
    if (!code) return;

    let isSubscribed = true;
    const fetchRoom = async () => {
      try {
        const qs = new URLSearchParams({
          code,
          ...(hostToken ? { hostToken } : {}),
          ...(playerToken ? { playerToken } : {}),
        });
        const newState = (await api("GET", undefined, "?" + qs)) as GameState;
        if (typeof newState.serverTime === "number") {
          setServerOffset(newState.serverTime - Date.now());
        }
        if (isSubscribed) {
          setState(newState);
          setError("");
        }
      } catch (e: unknown) {
        if (isSubscribed) {
          const err = e as Error;
          setError(err.message);
        }
      }
    };

    void fetchRoom();
    // 320ms during active question for instantaneous response, 450ms otherwise
    const intervalMs = state?.room?.status === "question" ? 320 : 450;
    const intervalId = setInterval(() => {
      void fetchRoom();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchRoom();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [view, code, hostToken, playerToken, state?.room?.status]);

  const loadLibrary = async () => {
    const r = await adminApi("GET");
    setSavedQuizzes(r.quizzes || []);
  };

  const openAdmin = async () => {
    playClick();
    try {
      await loadLibrary();
      setView("editor");
    } catch {
      setView("login");
    }
  };

  const login = async () => {
    playClick();
    setBusy(true);
    try {
      await adminApi("POST", { action: "login", username, password });
      await loadLibrary();
      setError("");
      setView("editor");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    playClick();
    setBusy(true);
    try {
      await adminApi("POST", { action: "logout" });
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setView("home");
    }
  };

  const saveQuiz = async () => {
    playClick();
    setBusy(true);
    try {
      const r = await adminApi("POST", {
        action: activeQuizId ? "update" : "save",
        quizId: activeQuizId,
        title,
        questions,
        riskEnabled,
      });
      setSavedQuizzes(r.quizzes || []);
      setActiveQuizId(r.quizId || activeQuizId);
      setError("");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyQuiz = async (id: string) => {
    playClick();
    const r = await adminApi("POST", { action: "copy", quizId: id });
    setSavedQuizzes(r.quizzes || []);
  };

  const deleteQuiz = async (id: string) => {
    playClick();
    const r = await adminApi("POST", { action: "delete", quizId: id });
    setSavedQuizzes(r.quizzes || []);
    if (activeQuizId === id) setActiveQuizId("");
  };

  const startSaved = async (quizId: string) => {
    playClick();
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
      void poll();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    playClick();
    setBusy(true);
    try {
      const r = await api("POST", {
        action: "create",
        title,
        questions,
        riskEnabled,
      });
      setCode(r.code);
      setHostToken(r.hostToken);
      localStorage.setItem(
        "quizora-active",
        JSON.stringify({ code: r.code, hostToken: r.hostToken }),
      );
      setView("host");
      void poll();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    warmupAudio();
    playClick();
    if (!code || !name.trim()) {
      setError("Lütfen oyun kodunu ve takma adını gir.");
      return;
    }
    setBusy(true);
    try {
      const r = await api("POST", { action: "join", code, name });
      setPlayerToken(r.playerToken);
      localStorage.setItem(
        "quizora-active",
        JSON.stringify({ code, name, playerToken: r.playerToken }),
      );
      setView("player");
      void poll();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    playClick();
    setSelectedOption(null);
    setRisk(false);
    try {
      await api("POST", { action: "advance", code, hostToken });
      void poll();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    }
  };

  // Instant Optimistic Answer Feedback (0ms latency feel)
  const answer = useCallback(
    async (i: number) => {
      if (state?.hasAnswered || selectedOption !== null) return;
      // 1. Instant feedback: sound, haptics, UI selection, screen reader announcement
      setSelectedOption(i);
      playSelect();
      hapticFeedback(40);
      setScreenAnnouncement(
        `Cevabınız kaydedildi: Seçenek ${shapeLetters[i]} - ${shapeNames[i]}`,
      );

      // 2. Immediate async network dispatch
      try {
        await api("POST", {
          action: "answer",
          code,
          playerToken,
          optionIndex: i,
          risk,
        });
        setRisk(false);
        void poll();
      } catch (e: unknown) {
        const err = e as Error;
        setError(err.message);
        setSelectedOption(null);
      }
    },
    [state?.hasAnswered, selectedOption, code, playerToken, risk, poll],
  );

  // Keyboard accessibility for participant during question view: keys 1/2/3/4 or A/B/C/D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (view === "player" && state?.room?.status === "question") {
        const now = Date.now() + serverOffset;
        if (now < Number(state.room.questionStartedAt)) return;

        if (e.key === "1" || e.key.toLowerCase() === "a") {
          void answer(0);
        } else if (e.key === "2" || e.key.toLowerCase() === "b") {
          void answer(1);
        } else if (e.key === "3" || e.key.toLowerCase() === "c") {
          void answer(2);
        } else if (e.key === "4" || e.key.toLowerCase() === "d") {
          void answer(3);
        } else if (e.key.toLowerCase() === "r" && state.room.riskEnabled) {
          playClick();
          setRisk((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, state?.room?.status, state?.room?.riskEnabled, state?.room?.questionStartedAt, answer, serverOffset]);

  // SCREEN 1: LANDING / PLAYER JOIN SCREEN
  if (view === "home") {
    const isPinPreFilled = Boolean(code && code.length === 6);

    return (
      <main className="min-h-[100dvh] flex flex-col bg-[#090d16] bg-dots text-white relative selection:bg-indigo-500 selection:text-white safe-pt safe-pb">
        <header className="h-16 px-4 sm:px-8 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-20">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleToggleSound}
              className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 flex items-center justify-center text-slate-300 transition-colors"
              title={muted ? "Sesi Aç" : "Sesi Kapat"}
              aria-label="Ses Kontrolü"
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-indigo-400" />
              )}
            </button>
            <button
              onClick={openAdmin}
              className="btn-3d btn-3d-surface px-4 py-2 text-xs sm:text-sm flex items-center gap-2 text-slate-200"
              aria-label="Yönetici Paneline Git"
            >
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Yönetici Paneli</span>
            </button>
          </div>
        </header>

        <section className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-md mx-auto w-full z-10">
          {/* ÜST BAŞLIK */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Canlı Bilgi Yarışması</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">
              {isPinPreFilled ? "Odaya Katılıyorsun!" : "Yarışmaya Katıl"}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xs mx-auto">
              {isPinPreFilled
                ? "PIN kodun hazır. Yalnızca ismini yaz ve oyuna gir."
                : "PIN kodunu ve adını girerek canlı oyuna dahil ol."}
            </p>
          </div>

          {/* FORM KARTI */}
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-4">
            {isPinPreFilled ? (
              /* QR İLE VEYA LİNKLE GELEN HIZLI KATILIM KARTI */
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Oyun Kodu (PIN)
                      </span>
                      <span className="font-mono font-black text-xl text-white tracking-widest">
                        {code}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setCode("");
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                  >
                    Değiştir
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="join-name-pre"
                    className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider"
                  >
                    Takma Adın / İsmin
                  </label>
                  <input
                    id="join-name-pre"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && name.trim()) {
                        void join();
                      }
                    }}
                    maxLength={20}
                    placeholder="Örn: Ahmet, Ayşe, Şampiyon…"
                    className="w-full h-14 bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-2xl px-4 font-bold text-lg text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={join}
                  disabled={busy || !code || !name.trim()}
                  className="btn-3d btn-3d-green w-full h-14 text-base sm:text-lg font-black tracking-wide"
                >
                  {busy ? "Katılınıyor…" : "OYUNA GİR 🚀"}
                </button>
              </div>
            ) : (
              /* STANDART PIN & İSİM GİRİŞİ */
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="join-code"
                    className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider"
                  >
                    Oyun Kodu (PIN)
                  </label>
                  <input
                    id="join-code"
                    value={code}
                    onChange={(e) => {
                      playClick();
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    }}
                    placeholder="000 000"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full h-14 bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-2xl px-4 text-center font-black text-3xl tracking-[0.25em] text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="join-name"
                    className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider"
                  >
                    Takma Adın / İsmin
                  </label>
                  <input
                    id="join-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && code.length >= 4 && name.trim()) {
                        void join();
                      }
                    }}
                    maxLength={20}
                    placeholder="Nasıl seslenelim?"
                    className="w-full h-12 bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-2xl px-4 font-bold text-base text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={join}
                  disabled={busy || !code || !name.trim()}
                  className="btn-3d btn-3d-primary w-full h-14 text-base sm:text-lg font-black tracking-wide"
                >
                  {busy ? "Katılınıyor…" : "OYUNA KATIL →"}
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            onClick={openAdmin}
            className="mt-6 text-xs sm:text-sm text-slate-400 hover:text-white transition-colors font-bold inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700"
          >
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Kendi yarışmanı mı yöneteceksin? <strong className="text-indigo-400">Oda Kur →</strong></span>
          </button>
        </section>
      </main>
    );
  }

  // SCREEN 2: ADMIN LOGIN SCREEN
  if (view === "login") {
    return (
      <main className="min-h-[100dvh] flex flex-col bg-[#090d16] bg-dots text-white p-4 safe-pt safe-pb">
        <header className="h-16 px-4 border-b border-slate-800/60 flex items-center justify-between">
          <Logo />
          <button
            onClick={() => setView("home")}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            ← Ana Sayfa
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center max-w-md mx-auto w-full">
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>

            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-1">
              Yönetici Girişi
            </span>
            <h1 className="text-2xl font-black text-white mb-2">Quizora Studio</h1>
            <p className="text-slate-400 text-xs sm:text-sm mb-6">
              Yarışmalarını düzenlemek ve canlı oda başlatmak için giriş yap.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
                  Kullanıcı Adı
                </label>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full h-11 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 text-sm font-semibold text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
                  Şifre
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full h-11 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 text-sm font-semibold text-white focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="btn-3d btn-3d-primary w-full h-12 text-sm font-bold uppercase tracking-wider mt-2"
              >
                {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
              </button>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      </main>
    );
  }

  // SCREEN 3: ADMIN STUDIO / QUIZ EDITOR
  if (view === "editor") {
    return (
      <AdminWorkspace
        title={title}
        setTitle={setTitle}
        questions={questions}
        setQuestions={setQuestions}
        selected={selected}
        setSelected={setSelected}
        activeQuizId={activeQuizId}
        setActiveQuizId={setActiveQuizId}
        bulkPoints={bulkPoints}
        setBulkPoints={setBulkPoints}
        bulkSeconds={bulkSeconds}
        setBulkSeconds={setBulkSeconds}
        riskEnabled={riskEnabled}
        setRiskEnabled={setRiskEnabled}
        savedQuizzes={savedQuizzes}
        saveQuiz={saveQuiz}
        copyQuiz={copyQuiz}
        deleteQuiz={deleteQuiz}
        startSaved={startSaved}
        create={create}
        busy={busy}
        error={error}
        logout={logout}
      />
    );
  }

  // LOADING STATE
  if (!state) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#090d16] text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-4 animate-spin text-indigo-400">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="text-lg font-black tracking-tight">Oyun Yükleniyor…</div>
        <p className="text-xs text-slate-500 mt-1">Sunucuyla anlık bağlantı kuruluyor</p>
      </main>
    );
  }

  const room = state.room;
  const q = state.question;
  const players = state.players || [];

  // SCREEN 4: HOST VIEW (Lobby, Active Game, Round Results, Podium)
  if (view === "host") {
    return (
      <main className="min-h-[100dvh] flex flex-col bg-[#090d16] text-white selection:bg-indigo-500 safe-pt safe-pb">
        <div className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-20">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
                PIN:
              </span>
              <span className="font-mono font-black text-lg text-indigo-400 tracking-wider">
                {room.code}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2 text-indigo-300 text-xs font-bold">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>{players.length} Oyuncu</span>
            </div>
            <button
              onClick={handleToggleSound}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-300"
              aria-label="Ses Kontrolü"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-indigo-400" />
              )}
            </button>
            <button
              onClick={() => {
                playClick();
                localStorage.removeItem("quizora-active");
                setView("home");
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-slate-700/50 text-xs font-bold text-slate-300 transition-colors"
              title="Odayı Kapat"
            >
              Çıkış
            </button>
          </div>
        </div>

        {room.status === "lobby" ? (
          <section className="flex-1 flex flex-col p-4 sm:p-8 max-w-5xl mx-auto w-full">
            {/* Üst Durum Rozeti */}
            <div className="flex items-center justify-between mb-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Lobi Açık · Oyuncular Bekleniyor</span>
              </div>

              <div className="text-xs text-slate-400 font-bold hidden sm:block">
                Katılımcılar kamerayla QR kodu tarayarak doğrudan girebilir
              </div>
            </div>

            {/* Ana Katılım Alanı: Otomatik QR Kod (Sol) & Dev PIN (Sağ) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-stretch mb-6">
              {/* SOL PANEL: OTOMATİK QR KOD */}
              <QRCodeCard
                url={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/?pin=${room.code}`
                    : `/?pin=${room.code}`
                }
                code={room.code}
                className="h-full justify-between"
              />

              {/* SAĞ PANEL: DEV PIN & BAŞLATMA ALANI */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                    Veya Tarayıcıdan Katıl
                  </div>
                  <div className="text-xs text-slate-300 font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 inline-block mb-4">
                    {typeof window !== "undefined" ? window.location.host : "quizora.app"}
                  </div>

                  <div className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-1.5">
                    Oyun Kodu (PIN)
                  </div>
                  <div
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(room.code);
                      }
                      playClick();
                    }}
                    title="PIN'i Kopyalamak İçin Tıkla"
                    className="group cursor-pointer bg-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400 rounded-2xl p-4 sm:p-5 flex items-center justify-between transition-all shadow-inner mb-2"
                  >
                    <span className="font-mono font-black text-4xl sm:text-6xl tracking-[0.2em] text-white">
                      {room.code}
                    </span>
                    <Copy className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                  </div>
                  <div className="text-[11px] text-slate-500 mb-4">
                    PIN kodunu kopyalamak için üzerine tıkla
                  </div>
                </div>

                {/* Oyuncu Durumu & Başlat Butonu */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-400" />
                      <span>{players.length} Oyuncu Hazır</span>
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {players.length > 0 ? "Başlamaya Hazır!" : "Bağlantı bekleniyor…"}
                    </span>
                  </div>

                  <button
                    onClick={advance}
                    disabled={!players.length}
                    className="btn-3d btn-3d-green w-full h-14 sm:h-16 text-base sm:text-xl font-black uppercase tracking-wider shadow-xl"
                  >
                    {players.length === 0
                      ? "Oyuncular Bekleniyor…"
                      : `Oyunu Başlat (${players.length} Oyuncu) →`}
                  </button>
                </div>
              </div>
            </div>

            {/* ALT PANEL: KATILAN OYUNCULAR LİSTESİ */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 sm:p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Lobideki Oyuncular ({players.length})</span>
                </div>
                {players.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">
                    Uygunsuz isimli oyuncunun yanındaki × simgesine tıklayarak çıkarabilirsin
                  </span>
                )}
              </div>

              {players.length === 0 ? (
                <div className="flex-1 p-8 text-center text-slate-500 text-sm border-2 border-dashed border-slate-800/80 rounded-2xl flex flex-col items-center justify-center min-h-[130px]">
                  <span className="text-2xl mb-1">📱</span>
                  <span className="font-bold text-slate-400">İlk oyuncunun bağlanması bekleniyor…</span>
                  <span className="text-xs text-slate-600 mt-1">
                    Telefonunun kamerasını soldaki QR koda tutarak anında bağlanabilirsin
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 max-h-56 overflow-y-auto p-1">
                  {players.map((p, idx) => {
                    const colors = [
                      "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
                      "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                      "bg-amber-500/20 text-amber-300 border-amber-500/40",
                      "bg-rose-500/20 text-rose-300 border-rose-500/40",
                      "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
                    ];
                    const colorClass = colors[idx % colors.length];

                    return (
                      <div
                        key={p.id}
                        className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm font-bold shadow-md hover:border-slate-700 transition-all"
                      >
                        <span
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center font-black text-xs ${colorClass}`}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-extrabold">{p.name}</span>
                        <button
                          title={`${p.name} oyuncusunu çıkar`}
                          onClick={async () => {
                            playClick();
                            await api("POST", {
                              action: "kick",
                              code,
                              hostToken,
                              playerId: p.id,
                            });
                            void poll();
                          }}
                          className="opacity-40 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1 p-0.5 rounded-lg hover:bg-slate-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : room.status === "finished" ? (
          <Podium
            players={players}
            onExit={() => {
              playClick();
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
            key={room.currentQuestion}
            q={q}
            room={room}
            state={state}
            host
            selectedOption={null}
            onAnswer={() => {}}
            serverOffset={serverOffset}
            footer={
              <button
                className="btn-3d btn-3d-primary px-8 py-3.5 text-base font-black uppercase tracking-wider"
                onClick={advance}
              >
                Turu Bitir →
              </button>
            }
          />
        )}
      </main>
    );
  }

  // SCREEN 5: PLAYER VIEW (Waiting Lobby, Active Game, Round Results, Podium)
  if (room.status === "lobby") {
    return (
      <main className="min-h-[100dvh] flex flex-col bg-[#090d16] bg-dots text-white p-4 sm:p-6 relative select-none safe-pt safe-pb">
        <header className="h-14 flex items-center justify-between border-b border-slate-800/60 pb-2 shrink-0">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 transition-colors"
              aria-label="Ses Kontrolü"
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-indigo-400" />
              )}
            </button>
            <button
              onClick={() => {
                playClick();
                localStorage.removeItem("quizora-active");
                setView("home");
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white"
            >
              Ayrıl
            </button>
          </div>
        </header>

        <section className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto w-full my-auto py-4">
          {/* Animated Avatar */}
          <div className="relative mb-5">
            <div className="w-24 h-24 rounded-3xl bg-indigo-500/15 border-2 border-indigo-500 flex items-center justify-center text-white font-black text-3xl shadow-[0_0_50px_rgba(99,102,241,0.35)]">
              {name.slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px] uppercase shadow-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
              Hazır
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1.5 tracking-tight">
            Oyundasın, {name}!
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mb-5 max-w-xs leading-relaxed">
            Yönetici oyunu başlattığında ilk soru telefonunda anında açılacak.
          </p>

          {/* Room PIN badge with Tap-to-Copy */}
          <button
            onClick={() => {
              playClick();
              navigator.clipboard?.writeText(room.code);
              setScreenAnnouncement("Oda kodu panoya kopyalandı");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono font-bold hover:border-slate-700 transition-colors mb-4"
            title="Kopyalamak için tıkla"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Oda PIN: {room.code}</span>
            <Copy className="w-3.5 h-3.5 text-slate-500 ml-1" />
          </button>

          {/* Audio & Haptic Test Buttons (Warms up audio on mobile) */}
          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 mb-4 shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              Cihaz Testi & Isınma
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  warmupAudio();
                  playSelect();
                }}
                className="btn-3d btn-3d-surface h-11 text-xs font-bold flex items-center justify-center gap-1.5 text-indigo-300"
              >
                <span>🔊 Sesi Dene</span>
              </button>
              <button
                onClick={() => {
                  hapticFeedback([40, 30, 50]);
                  playClick();
                }}
                className="btn-3d btn-3d-surface h-11 text-xs font-bold flex items-center justify-center gap-1.5 text-amber-300"
              >
                <span>📳 Titreşimi Dene</span>
              </button>
            </div>
          </div>

          {/* Quick tips & accessibility notes */}
          <div className="w-full p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-left">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Hızlı İpucu</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Doğru cevaba ne kadar hızlı dokunursan o kadar yüksek puan kazanırsın.
              Klavyede <b>1-4</b> veya <b>A-D</b> tuşlarıyla da anında cevaplayabilirsin.
            </p>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500 font-bold shrink-0 py-2">
          Lobide {players.length} oyuncu hazır bekliyor
        </footer>
      </main>
    );
  }

  if (room.status === "finished") {
    return (
      <Podium
        players={players}
        personal={state.player}
        onExit={() => {
          playClick();
          localStorage.removeItem("quizora-active");
          setView("home");
        }}
      />
    );
  }

  if (room.status === "results") {
    return (
      <RoundResults
        q={q}
        players={players}
        personal={state.player}
        message={state.roundMessage}
        awards={state.awards}
      />
    );
  }

  // ACTIVE GAME FOR PLAYER (Fully optimized for accessibility & instant thumb feedback)
  return (
    <>
      <div className="sr-only" aria-live="assertive">
        {screenAnnouncement}
      </div>
      <GameScreen
        key={room.currentQuestion}
        q={q}
        room={room}
        state={state}
        risk={risk}
        setRisk={setRisk}
        selectedOption={selectedOption}
        onAnswer={answer}
        onTimeUp={poll}
        serverOffset={serverOffset}
        footer={
          state.hasAnswered || selectedOption !== null ? (
            <div
              role="status"
              aria-live="polite"
              className="px-5 py-2.5 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/70 text-emerald-300 font-bold text-xs sm:text-sm shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-bounce"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Cevabın kaydedildi! Sonuçlar bekleniyor…</span>
            </div>
          ) : null
        }
      />
    </>
  );
}

// LOGO COMPONENT
function Logo() {
  return (
    <div className="flex items-center gap-2.5 font-black tracking-tight text-white text-base sm:text-lg select-none">
      <div className="w-8 h-8 rounded-xl bg-indigo-600 border border-indigo-400/30 flex items-center justify-center shadow-md shadow-indigo-950 text-white font-black text-sm">
        ◆
      </div>
      <span className="font-black tracking-tight text-white">Quizora</span>
    </div>
  );
}

interface GameScreenProps {
  q: Question | null;
  room: Room;
  state: GameState;
  host?: boolean;
  risk?: boolean;
  setRisk?: (r: boolean) => void;
  selectedOption: number | null;
  onAnswer: (i: number) => void;
  onTimeUp?: () => void;
  footer?: React.ReactNode;
  serverOffset?: number;
}

// ACTIVE GAME SCREEN (HOST & PLAYER) - PERFECTED FOR MOBILE ERGONOMICS
function GameScreen({
  q,
  room,
  state,
  host = false,
  risk = false,
  setRisk,
  selectedOption,
  onAnswer,
  onTimeUp,
  footer,
  serverOffset = 0,
}: GameScreenProps) {
  const current = room.currentQuestion + 1;
  const remaining = room.totalQuestions - current;
  const progressPercent = Math.min(100, (current / room.totalQuestions) * 100);

  // 3-Second Pre-Question Anticipation Countdown (3... 2... 1... Başla!)
  const [preCountdown, setPreCountdown] = useState<number | null>(() => {
    const now = Date.now() + serverOffset;
    const diff = Number(room.questionStartedAt) - now;
    return diff > 50 ? Math.min(3, Math.max(1, Math.ceil(diff / 1000))) : null;
  });
  const lastBeepedSec = useRef<number | null>(null);

  useEffect(() => {
    const check = () => {
      const now = Date.now() + serverOffset;
      const diff = Number(room.questionStartedAt) - now;
      if (diff > 50) {
        const sec = Math.min(3, Math.max(1, Math.ceil(diff / 1000)));
        setPreCountdown(sec);
      } else {
        setPreCountdown(null);
      }
    };
    check();
    const timer = setInterval(check, 50);
    return () => clearInterval(timer);
  }, [room.questionStartedAt, serverOffset]);

  // Audio countdown beeps: 3, 2, 1 and Start fanfare
  useEffect(() => {
    if (preCountdown !== null) {
      if (lastBeepedSec.current !== preCountdown) {
        lastBeepedSec.current = preCountdown;
        playCountdownBeep(preCountdown);
      }
    } else {
      if (lastBeepedSec.current !== null) {
        lastBeepedSec.current = null;
        playCountdownBeep(0);
      }
    }
  }, [preCountdown]);

  if (preCountdown !== null) {
    return (
      <main
        className="h-[100dvh] flex flex-col bg-[#090d16] bg-dots text-white overflow-hidden select-none safe-pt safe-pb relative"
        role="alert"
        aria-live="assertive"
        aria-label={`Soru ${current} başlıyor: ${preCountdown}`}
      >
        {/* Top Header */}
        <header className="h-14 sm:h-16 px-4 sm:px-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              Soru Hazırlanıyor
            </span>
          </div>
          <div className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 font-mono font-black text-xs sm:text-sm">
            Soru {current} / {room.totalQuestions}
          </div>
        </header>

        {/* Center Countdown Stage */}
        <section className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-lg mx-auto w-full my-auto z-10">
          {room.isDouble && (
            <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-wider animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>⚡ 2× Çift Puan Turu</span>
            </div>
          )}

          <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-indigo-400 mb-4">
            Soru {current} Başlıyor
          </div>

          {/* Big Pulsing Number Dial */}
          <div className="relative mb-6">
            <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-indigo-950/50 border-4 border-indigo-500/70 flex items-center justify-center animate-countdown-ring relative">
              <span
                key={preCountdown}
                className="font-mono font-black text-8xl sm:text-9xl text-white tracking-tight animate-countdown-punch drop-shadow-[0_4px_30px_rgba(99,102,241,0.9)]"
              >
                {preCountdown}
              </span>
            </div>
            <div className="absolute inset-0 rounded-full border border-indigo-400/20 pointer-events-none scale-125" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
            Hazır Ol!
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xs leading-relaxed">
            {host
              ? "Tüm oyuncuların ekranında geri sayım yapılıyor, soru birkaç saniye içinde açılacak."
              : "Hızlı ve doğru cevap veren en yüksek puanı toplar. Parmaklar ekranda olsun!"}
          </p>
        </section>

        {/* Bottom Bar */}
        <footer className="h-12 px-4 text-center text-xs text-slate-500 font-bold flex items-center justify-center shrink-0">
          {host ? (
            <span>Lobide {state.players.length} oyuncu ekrana kilitlendi 🎯</span>
          ) : (
            <span>
              {room.totalQuestions - current > 0
                ? `${room.totalQuestions - current} soru daha var`
                : "Bu yarışmanın son sorusu!"}
            </span>
          )}
        </footer>
      </main>
    );
  }

  return (
    <main
      className="h-[100dvh] flex flex-col bg-[#090d16] text-white overflow-hidden select-none safe-pt safe-pb"
      role="main"
      aria-label={`Soru ${current} / ${room.totalQuestions}`}
    >
      {/* Top Header Bar */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-indigo-300 font-mono font-black text-xs sm:text-sm shadow-sm"
            aria-label={`Soru ${current} toplam ${room.totalQuestions}`}
          >
            Soru {current} / {room.totalQuestions}
          </div>
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">
            {remaining > 0 ? `${remaining} soru kaldı` : "Son soru"}
          </span>
        </div>

        {/* Center Countdown Clock with zero-delay timeup dispatch */}
        <Countdown
          startedAt={room.questionStartedAt}
          seconds={q?.seconds}
          onTimeUp={onTimeUp}
          serverOffset={serverOffset}
        />

        {/* Right Status */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          {host ? (
            <div
              className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1.5"
              aria-label={`${state.answered} kişi cevapladı`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {state.answered} / {state.players.length}
              </span>
            </div>
          ) : state.hasAnswered || selectedOption !== null ? (
            <div
              className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-black shadow-sm"
              role="status"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kaydedildi</span>
            </div>
          ) : state.player ? (
            <div
              className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono font-black flex items-center gap-1.5 shadow-sm"
              aria-label={`Puanın: ${state.player.score}`}
            >
              <span>{state.player.score} Puan</span>
              {state.player.streak >= 2 && (
                <span className="text-amber-400 flex items-center gap-0.5 text-[11px]">
                  <Flame className="w-3 h-3 animate-flame" />
                  <span>{state.player.streak}</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-xs font-bold">Bir cevap seç</span>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      <div
        className="w-full h-1 bg-slate-800 shrink-0"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={room.totalQuestions}
      >
        <div
          className="h-full bg-indigo-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Center Question Card Area - Premium Game Show Card */}
      <section className="flex-1 flex flex-col items-center justify-center p-3 sm:p-5 max-w-3xl mx-auto w-full min-h-0">
        <div className="w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
          {room.isDouble && (
            <div className="mb-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>2× Çift Puan Turu</span>
            </div>
          )}

          {q?.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={q.imageUrl}
              alt="Soru Görseli"
              className="max-h-24 sm:max-h-36 rounded-xl object-contain mb-3 border border-slate-800 shadow-md"
            />
          )}

          <h1
            id="question-prompt"
            className="text-lg sm:text-2xl md:text-3xl font-black text-white leading-snug tracking-tight line-clamp-4"
          >
            {q?.prompt}
          </h1>

          {!host &&
            setRisk &&
            room.riskEnabled &&
            !state.hasAnswered &&
            selectedOption === null && (
              <button
                onClick={() => {
                  playClick();
                  setRisk(!risk);
                }}
                aria-pressed={risk}
                aria-label="Risk Modunu Aç/Kapat"
                className={`mt-3 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 touch-manipulation ${
                  risk
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Zap
                  className={`w-3.5 h-3.5 ${
                    risk ? "text-amber-400" : "text-slate-500"
                  }`}
                />
                <span>
                  {risk
                    ? "⚡ Risk Açık (Doğruysa 2×, Yanlışsa -Puan)"
                    : "⚡ Risk Kapalı"}
                </span>
              </button>
            )}
        </div>
      </section>

      {/* 4 Large Thumb-Friendly Answer Buttons in 2x2 Grid - Pure Shape & Bold Text */}
      <section
        className="p-2.5 sm:p-4 grid grid-cols-2 gap-2.5 sm:gap-3.5 max-w-4xl mx-auto w-full shrink-0 h-[46%] min-h-[13.5rem]"
        aria-labelledby="question-prompt"
      >
        {q?.options.map((optionText: string, i: number) => {
          const isSelected = selectedOption === i;
          const isDimmed = selectedOption !== null && !isSelected;
          const isEmpty = !optionText?.trim();
          return (
            <button
              key={i}
              onClick={() => !host && !isEmpty && onAnswer(i)}
              disabled={host || state.hasAnswered || selectedOption !== null || isEmpty}
              aria-label={isEmpty ? "Boş Seçenek" : `Seçenek ${shapeLetters[i]}: ${optionText}`}
              aria-pressed={isSelected}
              tabIndex={host || isEmpty ? -1 : 0}
              className={`answer-btn ${answerBtnClasses[i]} ${
                isSelected ? "selected-answer" : ""
              } ${isDimmed ? "dimmed-answer" : ""} ${
                isEmpty ? "invisible pointer-events-none" : ""
              }`}
            >
              <div
                className="answer-shape-badge"
                aria-hidden="true"
              >
                <span>{isSelected ? "✓" : shapes[i]}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-base sm:text-xl md:text-2xl font-black text-white leading-snug tracking-tight line-clamp-3 break-words">
                  {optionText}
                </span>
              </div>
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-md animate-pulse">
                  ✓ Seçildi
                </span>
              )}
            </button>
          );
        })}
      </section>

      {/* Fixed bottom notification */}
      {footer && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          {footer}
        </div>
      )}
    </main>
  );
}

// COUNTDOWN TIMER COMPONENT
function Countdown({
  startedAt,
  seconds,
  onTimeUp,
  serverOffset = 0,
}: {
  startedAt: number;
  seconds?: number;
  onTimeUp?: () => void;
  serverOffset?: number;
}) {
  const [left, setLeft] = useState(seconds || 0);
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    timeUpFiredRef.current = false;
    const tick = () => {
      const now = Date.now() + serverOffset;
      const remaining = Math.max(
        0,
        Math.ceil(
          (Number(startedAt) + Number(seconds || 0) * 1000 - now) / 1000,
        ),
      );
      setLeft(remaining);
      if (remaining <= 5 && remaining > 0) {
        playTick(true);
      }
      if (remaining === 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        onTimeUp?.();
      }
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [startedAt, seconds, onTimeUp, serverOffset]);

  const isUrgent = left <= 5;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Kalan süre: ${left} saniye`}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-black text-sm transition-colors ${
        isUrgent
          ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-urgent"
          : "bg-slate-800 text-white border border-slate-700"
      }`}
    >
      <Clock
        className={`w-4 h-4 ${isUrgent ? "text-red-400" : "text-indigo-400"}`}
      />
      <span>{left}s</span>
    </div>
  );
}

interface RoundResultsProps {
  q: Question | null;
  players: Player[];
  personal?: Player | null;
  onNext?: () => void;
  message?: string | null;
  awards?: {
    fastest: string | null;
    biggestRise: string | null;
    lastSecond: string | null;
  };
}

// ROUND RESULTS SCREEN - PARTICIPANT EMPOWERED & ACCESSIBLE
function RoundResults({
  q,
  players,
  personal,
  onNext,
  message,
  awards,
}: RoundResultsProps) {
  const me = personal ? players.find((p) => p.id === personal.id) : null;
  const rank = me ? players.findIndex((p) => p.id === me.id) + 1 : 0;
  const hasAnsweredRef = useRef(false);

  useEffect(() => {
    if (personal && me && !hasAnsweredRef.current) {
      hasAnsweredRef.current = true;
      if (me.roundPoints > 0) {
        playFanfare();
      } else if (me.roundPoints < 0) {
        playWrong();
      }
    }
  }, [personal, me]);

  const awardItems = [
    awards?.fastest && { icon: "⚡", label: "En Hızlı", name: awards.fastest },
    awards?.biggestRise && {
      icon: "↗",
      label: "En Çok Yükselen",
      name: awards.biggestRise,
    },
    awards?.lastSecond && {
      icon: "⏱",
      label: "Son Saniye",
      name: awards.lastSecond,
    },
  ].filter(Boolean) as Array<{ icon: string; label: string; name: string }>;

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#090d16] text-white p-4 sm:p-6 select-none safe-pt safe-pb">
      {/* Participant Personal Result Banner */}
      {me && (
        <section
          role="status"
          aria-live="polite"
          className="max-w-2xl mx-auto w-full mb-3"
        >
          {me.roundPoints > 0 ? (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/60 flex items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-2xl flex items-center justify-center shrink-0 shadow-lg">
                  🎉
                </div>
                <div>
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest block">
                    Harika! Doğru Cevap
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    +{me.roundPoints} Puan
                  </div>
                </div>
              </div>
              {me.streak >= 2 && (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black shrink-0 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400 animate-flame" />
                  <span>{me.streak} Seri!</span>
                </div>
              )}
            </div>
          ) : me.roundPoints < 0 ? (
            <div className="p-4 rounded-2xl bg-red-950/40 border-2 border-red-500/60 flex items-center gap-3 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-red-500 text-white font-black text-2xl flex items-center justify-center shrink-0">
                ⚡
              </div>
              <div>
                <span className="text-[11px] font-black text-red-400 uppercase tracking-widest block">
                  Risk Kaybettirdi!
                </span>
                <div className="text-xl sm:text-2xl font-black text-red-300">
                  {me.roundPoints} Puan
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3 shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 font-black text-xl flex items-center justify-center shrink-0">
                ✕
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Bu Sefer Olmadı
                </span>
                <div className="text-base font-bold text-slate-300">
                  Sonraki soruda telafi et!
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Correct Answer Card */}
      {q && (
        <section className="max-w-2xl mx-auto w-full my-1 sm:my-2">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/95 border border-slate-800 flex items-center gap-3.5 shadow-md">
            <div
              className={`w-11 h-11 rounded-xl ${answerBtnClasses[q.correctIndex]} flex items-center justify-center font-black text-xl text-white shadow-md shrink-0`}
              aria-hidden="true"
            >
              {shapes[q.correctIndex]}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest block">
                Doğru Cevap
              </span>
              <h1 className="text-base sm:text-xl font-black text-white truncate">
                {q.options[q.correctIndex]}
              </h1>
            </div>
          </div>

          {message && (
            <div className="mt-2.5 p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-200 flex items-center gap-3 shadow-md">
              <span className="text-2xl shrink-0">⭐</span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-0.5">
                  Turun Yıldızı
                </span>
                <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                  {message}
                </p>
              </div>
            </div>
          )}

          {awardItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {awardItems.map((award) => (
                <div
                  key={award.label}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-center"
                >
                  <div className="text-base mb-0.5">{award.icon}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase truncate">
                    {award.label}
                  </div>
                  <div className="text-xs font-black text-white truncate">
                    {award.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Leaderboard & Stats */}
      <section className="flex-1 max-w-2xl mx-auto w-full flex flex-col my-2">
        {me && (
          <div className="p-3 mb-2.5 rounded-xl bg-slate-900 border border-indigo-500/40 shadow-lg grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Sıralaman
              </span>
              <strong className="text-base sm:text-lg font-black text-indigo-400">
                #{rank}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Bu Tur
              </span>
              <strong
                className={`text-base sm:text-lg font-black ${
                  me.roundPoints < 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {me.roundPoints > 0 ? `+${me.roundPoints}` : me.roundPoints}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Toplam
              </span>
              <strong className="text-base sm:text-lg font-black text-white">
                {me.score}
              </strong>
            </div>
          </div>
        )}

        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Liderlik Tablosu</span>
            </span>
            <span className="text-xs text-slate-500 font-bold">
              {players.length} Oyuncu
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {players.slice(0, 6).map((p, i: number) => {
              const isMe = personal?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-xl border text-sm font-bold transition-all ${
                    isMe
                      ? "bg-indigo-500/15 border-indigo-500/50 text-white shadow-md"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                        i === 0
                          ? "bg-amber-400 text-slate-950"
                          : i === 1
                            ? "bg-slate-300 text-slate-950"
                            : i === 2
                              ? "bg-amber-700 text-white"
                              : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.streak >= 2 && (
                      <span className="text-[11px] text-amber-400 font-bold shrink-0 flex items-center">
                        <Flame className="w-3 h-3 animate-flame" />
                        <span>{p.streak}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.roundPoints !== 0 && (
                      <span
                        className={`text-xs ${
                          p.roundPoints > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {p.roundPoints > 0
                          ? `+${p.roundPoints}`
                          : p.roundPoints}
                      </span>
                    )}
                    <span className="font-mono font-black text-white">
                      {p.score}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Pinned user row if outside top 6 */}
            {me && rank > 6 && (
              <>
                <div className="text-center text-[10px] text-slate-600 font-black py-0.5">
                  •••
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl border bg-indigo-500/20 border-indigo-500/60 text-white shadow-md text-sm font-bold">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {rank}
                    </span>
                    <span className="truncate font-black">{me.name} (Sen)</span>
                    {me.streak >= 2 && (
                      <span className="text-[11px] text-amber-400 font-bold shrink-0 flex items-center">
                        <Flame className="w-3 h-3 animate-flame" />
                        <span>{me.streak}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {me.roundPoints !== 0 && (
                      <span
                        className={`text-xs ${
                          me.roundPoints > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {me.roundPoints > 0
                          ? `+${me.roundPoints}`
                          : me.roundPoints}
                      </span>
                    )}
                    <span className="font-mono font-black text-white">
                      {me.score}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pb-1">
          {onNext ? (
            <button
              onClick={() => {
                playClick();
                onNext();
              }}
              className="btn-3d btn-3d-primary w-full h-13 text-base font-black uppercase tracking-wider"
              aria-label="Sonraki Soruya Geç"
            >
              Sonraki Soru →
            </button>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-500/30 flex items-center justify-center gap-2.5 text-center shadow-lg"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping shrink-0" />
              <span className="text-xs sm:text-sm font-black text-indigo-200">
                Oyun lideri sonraki soruyu hazırlıyor… Hazır ol!
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

interface PodiumProps {
  players: Player[];
  personal?: Player | null;
  onExit: () => void;
}

// PODIUM / FINAL SCREEN - COMPLETE WITH TOP 10, GAP ANALYSIS & FUN MESSAGES
function Podium({ players, personal, onExit }: PodiumProps) {
  const top = players.slice(0, 3);
  const top10 = players.slice(0, 10);
  const me = personal
    ? players.find((p) => p.id === personal.id) || personal
    : null;
  const meIndex = me ? players.findIndex((p) => p.id === me.id) : -1;
  const meRank = meIndex >= 0 ? meIndex + 1 : 0;

  // Comparison metrics for the user
  const aheadPlayer = meIndex > 0 ? players[meIndex - 1] : null;
  const pointDiff =
    me && aheadPlayer ? Math.max(0, aheadPlayer.score - me.score) : null;
  const behindPlayer = meIndex === 0 && players.length > 1 ? players[1] : null;
  const leadPoints =
    me && behindPlayer ? Math.max(0, me.score - behindPlayer.score) : null;

  useEffect(() => {
    playFanfare();
  }, []);

  // Witty & humorous podium commentary generator
  const getFunComment = () => {
    if (!me) return null;
    if (meRank === 1) {
      if (behindPlayer && typeof leadPoints === "number") {
        if (leadPoints === 0)
          return `Aynı puanda nefes kesen final! Hız farkıyla kupayı kaptın 👑`;
        if (leadPoints <= 150)
          return `Kıl payı şampiyonluk! ${behindPlayer.name} ile arandaki ${leadPoints} puanlık farkı koruyup tahtı vermedin! 🏆🤏`;
        return `Zirvenin tek sahibisin! ${behindPlayer.name} ile aranda tam ${leadPoints} puan fark açarak efsaneleştin! 👑✨`;
      }
      return "Kupayı müzeye kaldırma vakti! Bugün sana yetişebilen çıkmadı 🏆👑";
    }

    if (meRank === 2) {
      if (aheadPlayer && typeof pointDiff === "number") {
        if (pointDiff <= 150)
          return `Ah o son soru! Şampiyon ${aheadPlayer.name}'ı yakalamana sadece ${pointDiff} puan kalmıştı, gümüş madalya da parıl parıl parlıyor! 🥈🤏`;
        return `Kürsünün 2. basamağında rüzgar gibi estin! Şampiyonun ensesinde boza pişirdin, harika mücadele! 🥈⚡`;
      }
      return "Gümüş madalya parlıyor! Şampiyonun ensesinde boza pişirdin, harika mücadele! 🥈⚡";
    }

    if (meRank === 3) {
      if (aheadPlayer && typeof pointDiff === "number" && pointDiff <= 150) {
        return `Podyumu kaptın! 2. sıradaki ${aheadPlayer.name}'ı geçmeye sadece ${pointDiff} puan kalmıştı! 🥉🔥`;
      }
      return "Kürsünün bronz aslanı! Son virajda podyumu kaptın, madalya çok yakıştı! 🥉👏";
    }

    if (meRank <= 10) {
      if (aheadPlayer && typeof pointDiff === "number") {
        if (pointDiff <= 100)
          return `Bir tık daha hızlı dokunsan ${aheadPlayer.name}'ı sollamıştın! Sadece ${pointDiff} puan fark kaldı 🤏😅`;
        if (pointDiff <= 350)
          return `Önündeki ${aheadPlayer.name}'ı yakalamaya ${pointDiff} puan kalmıştı! İlk 10'da yerin parıldıyor 🎯🏎️`;
      }
      return "İlk 10'a girmek her yiğidin harcı değil! Yarışmanın elit kadrosundasın 🎯👏";
    }

    if (aheadPlayer && typeof pointDiff === "number" && pointDiff <= 200) {
      return `Önündeki ${aheadPlayer.name}'ı geçmene sadece ${pointDiff} puan kalmıştı! Bir sonraki oyunda intikam vakti 🥊💪`;
    }
    return "Bu seferlik ısınma turuydu, asıl şov ve rövanş bir sonraki oyunda! Pes etmek yok 🔥🚀";
  };

  const funComment = getFunComment();

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#090d16] bg-dots text-white p-4 sm:p-6 relative select-none safe-pt safe-pb overflow-y-auto">
      <Confetti />

      {/* Üst Başlık */}
      <div className="text-center my-3 z-10 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest mb-1.5">
          <Trophy className="w-3.5 h-3.5" />
          <span>Oyun Tamamlandı</span>
        </span>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Şampiyonlar Kürsüsü
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {players.length} yarışmacı arasından zirve belli oldu!
        </p>
      </div>

      {/* 3D PODYUM BLOKLARI (İLK 3) */}
      <div className="max-w-xl mx-auto w-full my-4 flex items-end justify-center gap-2 sm:gap-4 h-56 sm:h-64 z-10 px-2 shrink-0">
        {top[1] && (
          <div className="w-1/3 flex flex-col items-center podium-block-2">
            <div className="text-2xl sm:text-3xl mb-1">🥈</div>
            <strong className="text-xs sm:text-sm font-black text-slate-200 truncate max-w-full">
              {top[1].name}
            </strong>
            <span className="text-[11px] font-mono text-slate-400 font-bold mb-2">
              {top[1].score}p
            </span>
            <div className="w-full h-24 sm:h-32 rounded-t-2xl bg-gradient-to-t from-slate-800 to-slate-700 border-t-2 border-slate-500 flex items-center justify-center font-black text-2xl sm:text-3xl text-slate-300 shadow-xl">
              2
            </div>
          </div>
        )}

        {top[0] && (
          <div className="w-1/3 flex flex-col items-center podium-block-1">
            <div className="text-3xl sm:text-4xl mb-1 text-amber-400">👑</div>
            <strong className="text-sm sm:text-base font-black text-amber-300 truncate max-w-full">
              {top[0].name}
            </strong>
            <span className="text-xs font-mono text-amber-400 font-black mb-2">
              {top[0].score}p
            </span>
            <div className="w-full h-36 sm:h-48 rounded-t-2xl bg-gradient-to-t from-amber-600 to-amber-500 border-t-2 border-amber-300 flex items-center justify-center font-black text-3xl sm:text-5xl text-slate-950 shadow-2xl">
              1
            </div>
          </div>
        )}

        {top[2] && (
          <div className="w-1/3 flex flex-col items-center podium-block-3">
            <div className="text-2xl sm:text-3xl mb-1">🥉</div>
            <strong className="text-xs sm:text-sm font-black text-slate-200 truncate max-w-full">
              {top[2].name}
            </strong>
            <span className="text-[11px] font-mono text-slate-400 font-bold mb-2">
              {top[2].score}p
            </span>
            <div className="w-full h-18 sm:h-24 rounded-t-2xl bg-gradient-to-t from-amber-900 to-amber-800 border-t-2 border-amber-700 flex items-center justify-center font-black text-xl sm:text-2xl text-amber-200 shadow-lg">
              3
            </div>
          </div>
        )}
      </div>

      {/* KİŞİSEL SIRALAMA & ÖNDEKİ RAKİP ANALİZ KARTI */}
      {personal && me && (
        <section
          role="status"
          aria-live="polite"
          className="max-w-xl mx-auto w-full my-3 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border-2 border-indigo-500/40 shadow-2xl backdrop-blur-xl z-10 shrink-0 space-y-3.5"
        >
          {/* Üst Sıralama & Puan Başlığı */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shrink-0 ${
                  meRank === 1
                    ? "bg-amber-500 text-slate-950"
                    : meRank === 2
                      ? "bg-slate-300 text-slate-950"
                      : meRank === 3
                        ? "bg-amber-700 text-white"
                        : meRank <= 10
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-300"
                }`}
              >
                #{meRank}
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Senin Başarın
                </span>
                <span className="text-base sm:text-lg font-black text-white">
                  {me.name}{" "}
                  <span className="text-indigo-400 font-extrabold text-xs">
                    (Sen)
                  </span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Toplam Puan
              </span>
              <span className="text-xl sm:text-2xl font-mono font-black text-white tracking-tight">
                {me.score}{" "}
                <span className="text-xs font-sans text-slate-400">Puan</span>
              </span>
            </div>
          </div>

          {/* Bir Öndeki Kişiyi Yakalama Farkı veya Liderlik Farkı */}
          {meRank === 1 ? (
            behindPlayer && typeof leadPoints === "number" && (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">👑</span>
                  <div className="text-xs sm:text-sm text-emerald-200 font-bold truncate">
                    Zirvedesin! En yakın rakibin{" "}
                    <b className="text-white font-extrabold">{behindPlayer.name}</b>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs shrink-0 whitespace-nowrap">
                  +{leadPoints} Puan Öndesin
                </div>
              </div>
            )
          ) : aheadPlayer && typeof pointDiff === "number" ? (
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">🏎️</span>
                <div className="text-xs sm:text-sm text-amber-200 font-bold truncate">
                  Önündeki <b className="text-white">#{meRank - 1} {aheadPlayer.name}</b>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-xs shrink-0 whitespace-nowrap">
                {pointDiff === 0
                  ? "Aynı Puan!"
                  : `${pointDiff} Puan Kaldı`}
              </div>
            </div>
          ) : null}

          {/* Eğlenceli Mesaj Alanı */}
          {funComment && (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-indigo-500/20 text-slate-200 text-xs sm:text-sm font-medium leading-relaxed flex items-start gap-2.5 shadow-inner">
              <span className="text-base shrink-0 select-none">💬</span>
              <p className="flex-1 italic">{funComment}</p>
            </div>
          )}
        </section>
      )}

      {/* İLK 10 SIRALAMA LİSTESİ */}
      <section className="max-w-xl mx-auto w-full my-3 p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl z-10 shrink-0">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>İlk 10 Sıralama</span>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            Toplam {players.length} Yarışmacı
          </span>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {top10.map((p, index) => {
            const isMe = personal?.id === p.id;
            const rankNum = index + 1;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all text-sm ${
                  isMe
                    ? "bg-indigo-500/20 border-indigo-500 text-white font-black shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                    : rankNum === 1
                      ? "bg-amber-500/10 border-amber-500/30 text-slate-100 font-bold"
                      : rankNum === 2
                        ? "bg-slate-800/40 border-slate-700/60 text-slate-200 font-bold"
                        : rankNum === 3
                          ? "bg-amber-950/20 border-amber-800/40 text-slate-200 font-bold"
                          : "bg-slate-950/50 border-slate-800/60 text-slate-300 font-semibold"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                      rankNum === 1
                        ? "bg-amber-500 text-slate-950"
                        : rankNum === 2
                          ? "bg-slate-300 text-slate-950"
                          : rankNum === 3
                            ? "bg-amber-700 text-white"
                            : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {rankNum}
                  </span>
                  <span className="truncate">
                    {p.name} {isMe && <span className="text-indigo-400 font-black text-xs">(Sen)</span>}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono font-black text-xs sm:text-sm">
                  <span className={isMe ? "text-indigo-300" : rankNum === 1 ? "text-amber-400" : "text-white"}>
                    {p.score}
                  </span>
                  <span className="text-[10px] font-sans text-slate-500 font-bold">p</span>
                </div>
              </div>
            );
          })}

          {/* Oyuncu ilk 10 dışındaysa listeye sabitlenmiş satır */}
          {personal && me && meRank > 10 && (
            <>
              <div className="text-center text-[10px] text-slate-600 font-black py-0.5">
                •••
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl border-2 bg-indigo-500/20 border-indigo-500 text-white font-black shadow-lg text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {meRank}
                  </span>
                  <span className="truncate font-black">{me.name} (Sen)</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono font-black text-xs sm:text-sm">
                  <span className="text-indigo-300">{me.score}</span>
                  <span className="text-[10px] font-sans text-slate-400 font-bold">p</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* MATHTALK DESTEK & UYGULAMA İNDİRME ALANI */}
      <section className="max-w-lg mx-auto w-full my-3 p-5 sm:p-6 rounded-3xl bg-slate-900/95 border-2 border-indigo-500/30 shadow-2xl backdrop-blur-xl text-center z-10 shrink-0">
        <div className="flex items-center justify-center gap-1 text-amber-400 mb-2">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span className="text-xs font-black text-amber-300 ml-1.5 uppercase tracking-wider">
            5 Yıldız ile Destek Olun
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-black text-white mb-1.5 tracking-tight">
          MathTalk: YKS & LGS AI Asistanı
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-md mx-auto mb-5 leading-relaxed">
          MathTalk ekibi tarafından geliştirilmiş <strong>MathTalk</strong> uygulamamızı indirip <strong>5 yıldız</strong> vererek bize destek olabilirsiniz!
        </p>

        {/* Gerçek App Store & Google Play İndirme Butonları */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Apple App Store */}
          <a
            href="https://apps.apple.com/tr/app/mathtalk-yks-lgs-ai-assistant/id6756312927"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playClick}
            className="w-full sm:w-auto min-w-[190px] h-14 px-4 py-2 bg-black hover:bg-slate-950 border border-slate-700/80 hover:border-slate-500 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg group text-white"
          >
            <svg
              className="w-7 h-7 fill-white shrink-0 group-hover:scale-105 transition-transform"
              viewBox="0 0 24 24"
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.85-.9.04-2.02.61-2.67 1.36-.57.65-1.08 1.71-1.01 2.74 1.01.08 2.05-.5 2.67-1.25z" />
            </svg>
            <div className="text-left leading-tight">
              <span className="block text-[10px] font-medium tracking-tight text-slate-400 uppercase">
                Download on the
              </span>
              <span className="block text-base font-bold text-white tracking-tight">
                App Store
              </span>
            </div>
          </a>

          {/* Google Play Store */}
          <a
            href="https://play.google.com/store/apps/details?id=com.mathtalk.app&referrer=utm_source%3Dwebsite%26utm_medium%3Dhero_badge%26utm_campaign%3Dmathtalk_web"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playClick}
            className="w-full sm:w-auto min-w-[190px] h-14 px-4 py-2 bg-black hover:bg-slate-950 border border-slate-700/80 hover:border-slate-500 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg group text-white"
          >
            <svg
              className="w-6 h-6 shrink-0 group-hover:scale-105 transition-transform"
              viewBox="0 0 24 24"
            >
              <path fill="#4285F4" d="M3.6 2.3c-.3.3-.4.8-.4 1.4v16.6c0 .6.2 1.1.5 1.4l9.3-9.7L3.6 2.3z" />
              <path fill="#34A853" d="M16.9 15.5l-3.9-3.5-9.4 9.7c.3.2.8.3 1.3.1l12-6.3z" />
              <path fill="#FBBC05" d="M16.9 8.5L4.9 2.2C4.4 2 3.9 2.1 3.6 2.3l9.4 9.7 3.9-3.5z" />
              <path fill="#EA4335" d="M20.7 10.5l-3.8-2-3.9 3.5 3.9 3.5 3.8-2c.7-.4.7-1.4 0-1.8l-.0-.2z" />
            </svg>
            <div className="text-left leading-tight">
              <span className="block text-[10px] font-medium tracking-tight text-slate-400 uppercase">
                GET IT ON
              </span>
              <span className="block text-base font-bold text-white tracking-tight">
                Google Play
              </span>
            </div>
          </a>
        </div>
      </section>

      <div className="max-w-md mx-auto w-full my-3 pb-4 z-10 shrink-0">
        <button
          onClick={onExit}
          className="btn-3d btn-3d-primary w-full h-12 text-sm font-bold uppercase tracking-wider"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    </main>
  );
}

interface AdminWorkspaceProps {
  title: string;
  setTitle: (t: string) => void;
  questions: Question[];
  setQuestions: (q: Question[]) => void;
  selected: number;
  setSelected: (s: number) => void;
  activeQuizId: string;
  setActiveQuizId: (id: string) => void;
  bulkPoints: number;
  setBulkPoints: (p: number) => void;
  bulkSeconds: number;
  setBulkSeconds: (s: number) => void;
  riskEnabled: boolean;
  setRiskEnabled: (r: boolean) => void;
  savedQuizzes: SavedQuiz[];
  saveQuiz: () => void;
  copyQuiz: (id: string) => void;
  deleteQuiz: (id: string) => void;
  startSaved: (id: string) => void;
  create: () => void;
  busy: boolean;
  error: string;
  logout: () => void;
}

// ADMIN STUDIO WORKSPACE - STREAMLINED, INTUITIVE & DRAG-AND-DROP REORDERABLE
function AdminWorkspace({
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
  riskEnabled,
  setRiskEnabled,
  savedQuizzes,
  saveQuiz,
  copyQuiz,
  deleteQuiz,
  startSaved,
  create,
  busy,
  error,
  logout,
}: AdminWorkspaceProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [mobileTab, setMobileTab] = useState<"questions" | "editor">("editor");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const q = questions[selected] || questions[0];

  const update = (patch: Partial<Question>) => {
    const next = [...questions];
    next[selected] = { ...q, ...patch };
    setQuestions(next);
  };

  const add = () => {
    playClick();
    const newQuestion: Question = {
      prompt: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      seconds: bulkSeconds || 20,
      points: bulkPoints || 1000,
      imageUrl: "",
    };
    const next = [...questions, newQuestion];
    setQuestions(next);
    setSelected(next.length - 1);
    setMobileTab("editor");
  };

  const removeAt = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    playClick();
    if (questions.length <= 1) return;
    const next = questions.filter((_, i) => i !== index);
    setQuestions(next);
    if (selected >= next.length) {
      setSelected(next.length - 1);
    } else if (selected === index) {
      setSelected(Math.max(0, index - 1));
    }
  };

  const duplicateAt = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    playClick();
    const source = questions[index];
    const duplicated: Question = {
      ...source,
      options: [...source.options],
    };
    const next = [...questions];
    next.splice(index + 1, 0, duplicated);
    setQuestions(next);
    setSelected(index + 1);
  };

  // Reordering function: Drag-and-drop & Arrow buttons
  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length || fromIndex === toIndex)
      return;
    playClick();
    const updated = [...questions];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    setQuestions(updated);

    if (selected === fromIndex) {
      setSelected(toIndex);
    } else if (fromIndex < selected && toIndex >= selected) {
      setSelected(selected - 1);
    } else if (fromIndex > selected && toIndex <= selected) {
      setSelected(selected + 1);
    }
  };

  // Handle questions imported from CSV / Excel / JSON
  const handleImportQuestions = (
    imported: Question[],
    mode: "append" | "replace",
  ) => {
    if (mode === "replace") {
      setQuestions(imported);
      setSelected(0);
    } else {
      setQuestions([...questions, ...imported]);
      setSelected(questions.length);
    }
    setMobileTab("editor");
  };

  // Apply bulk defaults to all questions
  const handleApplyBulkToAll = () => {
    setQuestions(
      questions.map((item) => ({
        ...item,
        seconds: bulkSeconds,
        points: bulkPoints,
      })),
    );
  };

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#090d16] text-white safe-pt safe-pb select-none">
      {/* 1. ÜST HEADER BAR: Logo, Başlık, Aksiyon Butonları */}
      <header className="h-16 px-3 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 max-w-xl">
          <Logo />
          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {/* Soru Başlığı Düzenleme */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-colors">
            <Edit3 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-white focus:outline-none placeholder:text-slate-600"
              placeholder="Yarışma Başlığı…"
            />
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* İçe Aktar Butonu */}
          <button
            onClick={() => {
              playClick();
              setIsImportOpen(true);
            }}
            className="btn-3d btn-3d-surface px-2.5 sm:px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 text-indigo-300"
            title="CSV, Excel veya JSON'dan Soru Yükle"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">İçe Aktar</span>
          </button>

          {/* Kütüphane Butonu */}
          <button
            onClick={() => {
              playClick();
              setIsLibraryOpen(true);
            }}
            className="btn-3d btn-3d-surface px-2.5 sm:px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 text-slate-300"
            title="Kayıtlı Yarışmalarım"
          >
            <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Kütüphane</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono">
              {savedQuizzes.length}
            </span>
          </button>

          {/* Kaydet Butonu */}
          <button
            onClick={saveQuiz}
            disabled={busy}
            className="btn-3d btn-3d-surface px-3 py-1.5 text-xs font-bold text-emerald-400"
          >
            {activeQuizId ? "Güncelle" : "Kaydet"}
          </button>

          {/* Odayı Başlat Butonu */}
          <button
            onClick={create}
            disabled={busy || !questions.length}
            className="btn-3d btn-3d-green px-3.5 sm:px-4 py-1.5 text-xs font-black shadow-lg"
          >
            {busy ? "Hazırlanıyor…" : "Oda Başlat →"}
          </button>

          {/* Çıkış */}
          <button
            onClick={logout}
            className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            title="Çıkış Yap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MOBİL GÖRÜNÜM SEKME DEĞİŞTİRİCİSİ */}
      <div className="md:hidden h-11 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 w-full gap-1">
          <button
            onClick={() => {
              playClick();
              setMobileTab("questions");
            }}
            className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === "questions"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400"
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Sorular ({questions.length})</span>
          </button>
          <button
            onClick={() => {
              playClick();
              setMobileTab("editor");
            }}
            className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === "editor"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Soru #{selected + 1} Düzenle</span>
          </button>
        </div>
      </div>

      {/* 2. ANA ÇALIŞMA ALANI: SOL FİLMSTRİP + SAĞ SORU DÜZENLEYİCİ */}
      <div className="flex-1 flex overflow-hidden">
        {/* SOL PANEL: SORULAR LİSTESİ (SÜRÜKLE-BIRAK & OKLARLA SIRALAMA) */}
        <aside
          className={`w-full md:w-80 lg:w-96 bg-slate-950/95 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden ${
            mobileTab === "questions" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Sol Panel Üst Araç Çubuğu */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                Sorular
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300 font-mono text-[11px] font-bold">
                {questions.length}
              </span>
            </div>

            <button
              onClick={add}
              className="btn-3d btn-3d-primary py-1.5 px-3 text-xs font-black flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Soru</span>
            </button>
          </div>

          <div className="px-3 py-1.5 bg-slate-900/30 border-b border-slate-800/60 text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>↕ Sürükleyerek veya oklarla sırayı değiştir</span>
            <span className="text-indigo-400 font-bold">Sürükle & Bırak</span>
          </div>

          {/* Kaydırılabilir Soru Kartları */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2">
            {questions.map((item, i) => {
              const isSelected = i === selected;
              const isDragging = draggedIndex === i;
              const isOver = dragOverIndex === i;
              const correctText =
                item.options[item.correctIndex]?.trim() ||
                `Seçenek ${shapeLetters[item.correctIndex]}`;

              return (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(i));
                    setDraggedIndex(i);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIndex !== i) setDragOverIndex(i);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === i) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== i) {
                      moveQuestion(draggedIndex, i);
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onClick={() => {
                    playClick();
                    setSelected(i);
                    if (mobileTab === "questions") setMobileTab("editor");
                  }}
                  className={`group relative p-2.5 sm:p-3 rounded-2xl border cursor-pointer transition-all ${
                    isOver
                      ? "border-indigo-400 bg-indigo-500/20 scale-[1.02] shadow-lg"
                      : isSelected
                        ? "bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/50"
                        : "bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300"
                  } ${isDragging ? "opacity-40" : ""}`}
                >
                  {/* Üst Satır: Tutamaç, Sıralama Okları, No, Meta & Butonlar */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* Sürükleme Tutamacı */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-600 group-hover:text-slate-400 p-0.5"
                        title="Sırayı değiştirmek için sürükle"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Yukarı / Aşağı Taşıma Okları (Mobilde ve tıkla sıralamada süper rahat) */}
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveQuestion(i, i - 1);
                          }}
                          title="Yukarı Taşı"
                          className="w-5 h-5 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-20 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={i === questions.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveQuestion(i, i + 1);
                          }}
                          title="Aşağı Taşı"
                          className="w-5 h-5 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-20 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Soru Sıra No */}
                      <span
                        className={`w-5 h-5 rounded-md font-black text-[11px] flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        #{i + 1}
                      </span>

                      {/* Süre & Puan Rozeti */}
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {item.seconds || 20}s · {item.points || 1000}p
                      </span>
                    </div>

                    {/* Çoğalt & Sil Butonları */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => duplicateAt(i, e)}
                        title="Soruyu Kopyala"
                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => removeAt(i, e)}
                        disabled={questions.length === 1}
                        title="Soruyu Sil"
                        className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 flex items-center justify-center disabled:opacity-20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Soru Metni Özeti */}
                  <p className="text-xs font-bold text-white line-clamp-2 leading-relaxed min-h-[1.5rem] pl-6">
                    {item.prompt?.trim() || (
                      <span className="text-slate-500 font-normal italic">
                        (Soru metni yazılmadı)
                      </span>
                    )}
                  </p>

                  {/* Alt Bilgi: Doğru Cevap & Görsel */}
                  <div className="mt-2 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[11px] pl-6">
                    <span className="text-emerald-400 font-semibold truncate flex items-center gap-1.5 max-w-[200px]">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-black shrink-0">
                        {shapes[item.correctIndex] || "✓"}
                      </span>
                      <span className="truncate">{correctText}</span>
                    </span>
                    {item.imageUrl && (
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1 rounded font-mono">
                        Görsel
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sol Panel Alt Kısım: Hızlı Dosya Yükle */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/40 shrink-0">
            <button
              onClick={() => {
                playClick();
                setIsImportOpen(true);
              }}
              className="btn-3d btn-3d-surface w-full py-2 px-3 text-xs font-bold text-indigo-300 flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dosyadan Toplu Yükle (Excel/CSV/JSON)</span>
            </button>
          </div>
        </aside>

        {/* SAĞ PANEL: ODAKLI VE SADE SORU DÜZENLEME ALANI (HER ŞEY BURADA!) */}
        <section
          className={`flex-1 flex flex-col overflow-hidden bg-[#070b14] ${
            mobileTab === "editor" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Üst Navigasyon & Hızlı Ayar Şeridi */}
          <div className="h-14 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 gap-2 flex-wrap">
            {/* Sol: Soru Sırası Navigasyonu */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={selected === 0}
                onClick={() => {
                  playClick();
                  setSelected(Math.max(0, selected - 1));
                }}
                title="Önceki Soru"
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-xs font-black text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
                Soru <span className="text-indigo-400">#{selected + 1}</span> / {questions.length}
              </div>

              <button
                type="button"
                disabled={selected >= questions.length - 1}
                onClick={() => {
                  playClick();
                  setSelected(Math.min(questions.length - 1, selected + 1));
                }}
                title="Sonraki Soru"
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Sağ: Hızlı Süre & Puan & Görsel Ayarları (Yan panel yerine direkt burada!) */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Süre Hap Butonları */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
                {[10, 20, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      playClick();
                      update({ seconds: sec });
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-all ${
                      (q?.seconds || 20) === sec
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              {/* Puan Hap Butonları */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1" />
                {[1000, 2000, 0].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => {
                      playClick();
                      update({ points: pts });
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-all ${
                      (q?.points ?? 1000) === pts
                        ? "bg-amber-500 text-slate-950 font-black shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {pts === 0 ? "Isınma" : `${pts}p`}
                  </button>
                ))}
              </div>

              {/* Görsel Butonu Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowImageInput(!showImageInput);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  showImageInput || q?.imageUrl
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
                title="Soruya Görsel Ekle"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Görsel</span>
              </button>
            </div>
          </div>

          {/* Soru Düzenleme Gövdesi */}
          {q && (
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-center gap-3 sm:gap-4">
              {/* Soru Başlık & Metin Alanı */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Soru Metni</span>
                  </div>
                  <span className="text-emerald-400 font-semibold normal-case text-xs hidden sm:inline">
                    💡 Doğru cevabı belirlemek için aşağıdaki şıkkın &ldquo;Doğru Cevap&rdquo; butonuna tıkla
                  </span>
                </div>

                <textarea
                  value={q.prompt}
                  onChange={(e) => update({ prompt: e.target.value })}
                  placeholder="Sorunu buraya yaz…"
                  rows={3}
                  className="w-full bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-2xl p-3 sm:p-4 text-base sm:text-xl font-bold text-white focus:outline-none resize-none transition-colors"
                />

                {/* Görsel URL Girişi & Canlı Önizleme */}
                {(showImageInput || q.imageUrl) && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        value={q.imageUrl || ""}
                        onChange={(e) => update({ imageUrl: e.target.value })}
                        placeholder="Görsel bağlantısı (https://...jpg, png)"
                        className="flex-1 bg-transparent text-xs text-white focus:outline-none font-mono"
                      />
                      {q.imageUrl && (
                        <button
                          type="button"
                          onClick={() => update({ imageUrl: "" })}
                          className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded bg-red-500/10"
                        >
                          Kaldır
                        </button>
                      )}
                    </div>

                    {q.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-800 bg-black/40 max-h-36 flex items-center justify-center p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.imageUrl}
                          alt="Önizleme"
                          className="max-h-32 object-contain rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 4 Seçenek Kartları (2x2 Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 pt-2">
                  {q.options.map((optionText: string, i: number) => {
                    const isCorrect = q.correctIndex === i;
                    const borderColors = [
                      "hover:border-red-500/60",
                      "hover:border-blue-500/60",
                      "hover:border-amber-500/60",
                      "hover:border-emerald-500/60",
                    ];
                    const shapeColors = [
                      "text-red-400 bg-red-500/20",
                      "text-blue-400 bg-blue-500/20",
                      "text-amber-400 bg-amber-500/20",
                      "text-emerald-400 bg-emerald-500/20",
                    ];

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all ${
                          isCorrect
                            ? "bg-emerald-950/30 border-emerald-500 shadow-lg ring-2 ring-emerald-500/30"
                            : `bg-slate-950 border-slate-800 ${borderColors[i]}`
                        }`}
                      >
                        <span
                          className={`w-9 h-9 rounded-xl font-black text-base flex items-center justify-center shrink-0 shadow-inner ${shapeColors[i]}`}
                        >
                          {shapes[i]}
                        </span>

                        <input
                          value={optionText}
                          onChange={(e) => {
                            const opts = [...q.options];
                            opts[i] = e.target.value;
                            update({ options: opts });
                          }}
                          placeholder={`${shapeLetters[i]} Seçeneği…`}
                          className="flex-1 bg-transparent text-sm sm:text-base font-bold text-white focus:outline-none min-w-0"
                        />

                        {/* Doğru Seçenek Butonu */}
                        <button
                          type="button"
                          onClick={() => {
                            playSelect();
                            update({ correctIndex: i });
                          }}
                          className={`px-2.5 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1 shrink-0 ${
                            isCorrect
                              ? "bg-emerald-500 text-slate-950 shadow-md scale-105"
                              : "bg-slate-900 text-slate-500 hover:text-slate-200 border border-slate-800"
                          }`}
                          title="Bu seçeneği doğru cevap olarak belirle"
                        >
                          {isCorrect ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Doğru</span>
                            </>
                          ) : (
                            <span>Doğru Yap</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Alt Hızlı Navigasyon Butonları */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => duplicateAt(selected)}
                  className="btn-3d btn-3d-surface h-11 px-3 text-xs font-bold flex items-center gap-1.5 text-slate-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Soruyu Çoğalt</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => removeAt(selected)}
                    disabled={questions.length === 1}
                    className="h-11 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold disabled:opacity-30 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Soruyu Sil</span>
                  </button>

                  <button
                    type="button"
                    onClick={add}
                    className="btn-3d btn-3d-primary h-11 px-4 text-xs font-black flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Soru Ekle</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* TOPLU İÇE AKTARMA MODALI (CSV / EXCEL / JSON) */}
      <ImportQuizModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportQuestions}
      />

      {/* KAYITLI YARIŞMALAR & AYARLAR MODALI */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedQuizzes={savedQuizzes}
        activeQuizId={activeQuizId}
        onSelectQuiz={(item) => {
          setActiveQuizId(item.id);
          setTitle(item.title);
          setQuestions(item.questions);
          setRiskEnabled(!!item.riskEnabled);
          setSelected(0);
          setMobileTab("editor");
        }}
        onStartSaved={startSaved}
        onCopyQuiz={copyQuiz}
        onDeleteQuiz={deleteQuiz}
        bulkPoints={bulkPoints}
        setBulkPoints={setBulkPoints}
        bulkSeconds={bulkSeconds}
        setBulkSeconds={setBulkSeconds}
        riskEnabled={riskEnabled}
        setRiskEnabled={setRiskEnabled}
        onApplyBulkToAll={handleApplyBulkToAll}
      />

      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl z-50 animate-bounce"
        >
          {error}
        </div>
      )}
    </main>
  );
}
