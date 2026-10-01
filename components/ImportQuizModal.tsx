"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  FileCode,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import {
  parseQuestionsFile,
  downloadSampleTemplate,
  SAMPLE_QUESTIONS,
  Question,
} from "@/lib/quizImport";
import { playClick, playSelect } from "@/lib/audio";

interface ImportQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: Question[], mode: "append" | "replace") => void;
}

export function ImportQuizModal({
  isOpen,
  onClose,
  onImport,
}: ImportQuizModalProps) {
  const [tab, setTab] = useState<"upload" | "template">("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Question[] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const questions = await parseQuestionsFile(file);
      setParsed(questions);
      playSelect();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || "Dosya okunurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleApply = (mode: "append" | "replace") => {
    if (!parsed || parsed.length === 0) return;
    playClick();
    onImport(parsed, mode);
    onClose();
    setParsed(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="h-16 px-5 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="import-modal-title"
                className="text-base sm:text-lg font-black text-white"
              >
                Toplu Soru Yükleme
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                CSV, Excel (.xlsx, .xls) veya JSON dosyaları
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800 flex gap-2 shrink-0 bg-slate-950/30">
          <button
            onClick={() => {
              playClick();
              setTab("upload");
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              tab === "upload"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                : "bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Dosya Yükle</span>
          </button>
          <button
            onClick={() => {
              playClick();
              setTab("template");
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              tab === "template"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                : "bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Format & Şablon İndir</span>
          </button>
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {tab === "upload" ? (
            <>
              {/* Drag & Drop Alanı */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
                    : "border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={onFileInputChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg">
                  <Upload className="w-7 h-7" />
                </div>

                <div>
                  <span className="text-sm sm:text-base font-black text-white block mb-1">
                    Dosyanı buraya sürükle veya seçmek için tıkla
                  </span>
                  <span className="text-xs text-slate-400 block font-medium">
                    Desteklenen formatlar: <b>.xlsx</b>, <b>.xls</b>, <b>.csv</b>, <b>.json</b>
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Excel</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">CSV</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">JSON</span>
                </div>
              </div>

              {loading && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center flex items-center justify-center gap-2 text-indigo-300 text-xs font-bold animate-pulse">
                  <span>Dosya işleniyor ve sorular ayrıştırılıyor…</span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-300 text-xs font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <span className="block font-black text-red-400 mb-0.5">Yükleme Hatası</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {parsed && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{parsed.length} adet soru başarıyla okundu!</span>
                    </div>
                  </div>

                  {/* Önizleme Kartları */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                      Önizleme (İlk {Math.min(3, parsed.length)} Soru):
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {parsed.slice(0, 3).map((q, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-left space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-indigo-400 font-bold">
                              #{idx + 1}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {q.seconds}s · {q.points}p
                            </span>
                          </div>
                          <p className="font-bold text-white truncate">{q.prompt}</p>
                          <div className="flex flex-wrap gap-1 text-[11px] text-slate-400">
                            {q.options.map((opt, oi) => (
                              <span
                                key={oi}
                                className={`px-2 py-0.5 rounded ${
                                  oi === q.correctIndex
                                    ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                                    : "bg-slate-900 border border-slate-800"
                                }`}
                              >
                                {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* İçe Aktarma Aksiyonları */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleApply("append")}
                      className="btn-3d btn-3d-primary h-12 text-xs sm:text-sm font-black flex items-center justify-center gap-2"
                    >
                      <span>Mevcut Sorulara Ekle</span>
                      <span className="text-xs opacity-80">(+{parsed.length})</span>
                    </button>
                    <button
                      onClick={() => handleApply("replace")}
                      className="btn-3d btn-3d-green h-12 text-xs sm:text-sm font-black flex items-center justify-center gap-2"
                    >
                      <span>Mevcutları Değiştir (Sıfırla)</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* FORMAT & ŞABLON REHBERİ */
            <div className="space-y-5 text-left">
              <div>
                <h3 className="text-sm font-black text-white mb-1">
                  1. Hazır Şablon Dosyaları
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Aşağıdaki butonlara tıklayarak örnek sorular içeren hazır şablon dosyasını indirip kendi sorularınızla doldurabilirsiniz:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => {
                      playClick();
                      downloadSampleTemplate("xlsx");
                    }}
                    className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-white">Excel (.xlsx)</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Download className="w-3 h-3" /> İndir
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      playClick();
                      downloadSampleTemplate("csv");
                    }}
                    className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                  >
                    <FileText className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-white">CSV (.csv)</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Download className="w-3 h-3" /> İndir
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      playClick();
                      downloadSampleTemplate("json");
                    }}
                    className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                  >
                    <FileCode className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-white">JSON (.json)</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Download className="w-3 h-3" /> İndir
                    </span>
                  </button>
                </div>
              </div>

              {/* Sütun Düzeni Açıklaması */}
              <div className="space-y-2">
                <h3 className="text-sm font-black text-white">
                  2. Excel & CSV Sütun Formatı
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-950 text-slate-400 font-mono uppercase">
                      <tr>
                        <th className="p-2 border-b border-slate-800">Sütun 1</th>
                        <th className="p-2 border-b border-slate-800">Sütun 2-5</th>
                        <th className="p-2 border-b border-slate-800">Sütun 6</th>
                        <th className="p-2 border-b border-slate-800">Sütun 7-8</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      <tr>
                        <td className="p-2 font-bold text-white">Soru</td>
                        <td className="p-2">Seçenek A, B, C, D</td>
                        <td className="p-2 font-bold text-emerald-400">Doğru Cevap (A / B / C / D)</td>
                        <td className="p-2 text-slate-400">Süre (sn), Puan</td>
                      </tr>
                      <tr className="bg-slate-950/40 text-[10px] text-slate-400">
                        <td className="p-2 italic">Türkiye&apos;nin başkenti?</td>
                        <td className="p-2 italic">Ankara, İstanbul, İzmir, Bursa</td>
                        <td className="p-2 font-bold text-emerald-400">A</td>
                        <td className="p-2">20, 1000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500">
                  * Doğru cevap sütununa doğrudan şık harfi (A, B, C, D) veya şık numarası (1, 2, 3, 4) yazabilirsiniz.
                </p>
              </div>

              {/* JSON Format Örneği */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-white">
                  3. JSON Formatı Örneği
                </h3>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-indigo-300 overflow-x-auto">
{JSON.stringify(SAMPLE_QUESTIONS.slice(0, 1), null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
