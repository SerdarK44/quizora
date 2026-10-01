"use client";

import { useState } from "react";
import {
  X,
  FolderKanban,
  Search,
  Play,
  Copy,
  Trash2,
  Sliders,
  Check,
} from "lucide-react";
import { playClick } from "@/lib/audio";

export interface SavedQuiz {
  id: string;
  title: string;
  riskEnabled: boolean;
  questions: Array<{
    id?: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    seconds: number;
    points?: number;
    imageUrl?: string;
  }>;
}

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedQuizzes: SavedQuiz[];
  activeQuizId: string;
  onSelectQuiz: (quiz: SavedQuiz) => void;
  onStartSaved: (id: string) => void;
  onCopyQuiz: (id: string) => void;
  onDeleteQuiz: (id: string) => void;
  bulkPoints: number;
  setBulkPoints: (p: number) => void;
  bulkSeconds: number;
  setBulkSeconds: (s: number) => void;
  riskEnabled: boolean;
  setRiskEnabled: (r: boolean) => void;
  onApplyBulkToAll: () => void;
}

export function LibraryModal({
  isOpen,
  onClose,
  savedQuizzes,
  activeQuizId,
  onSelectQuiz,
  onStartSaved,
  onCopyQuiz,
  onDeleteQuiz,
  bulkPoints,
  setBulkPoints,
  bulkSeconds,
  setBulkSeconds,
  riskEnabled,
  setRiskEnabled,
  onApplyBulkToAll,
}: LibraryModalProps) {
  const [search, setSearch] = useState("");
  const [appliedNotice, setAppliedNotice] = useState(false);

  if (!isOpen) return null;

  const filtered = savedQuizzes.filter((x) =>
    x.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleApplyBulk = () => {
    playClick();
    onApplyBulkToAll();
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-modal-title"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="h-16 px-5 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="library-modal-title"
                className="text-base sm:text-lg font-black text-white"
              >
                Kayıtlı Yarışmalarım ({savedQuizzes.length})
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Daha önce oluşturduğun yarışmaları yönet ve başlat
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Arama Barı */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Yarışma başlığına göre ara…"
              className="w-full h-11 pl-10 pr-4 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-sm font-semibold text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Yarışma Listesi */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-2xl">
                Henüz kayıtlı bir yarışma bulunamadı.
              </div>
            ) : (
              filtered.map((item) => {
                const isActive = activeQuizId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                      isActive
                        ? "bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/40"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <button
                      onClick={() => {
                        playClick();
                        onSelectQuiz(item);
                        onClose();
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-black uppercase">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{item.questions.length} Soru</span>
                        {item.riskEnabled && (
                          <span className="text-amber-400 font-bold">⚡ Risk Modu</span>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          playClick();
                          onStartSaved(item.id);
                        }}
                        title="Odayı Hemen Başlat"
                        className="btn-3d btn-3d-green h-9 px-3 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Başlat</span>
                      </button>
                      <button
                        onClick={() => {
                          playClick();
                          onCopyQuiz(item.id);
                        }}
                        title="Kopyala / Çoğalt"
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          playClick();
                          onDeleteQuiz(item.id);
                        }}
                        title="Sil"
                        className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Varsayılan Ayarlar & Toplu Uygulama Alanı */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Varsayılan Ayarlar & Toplu Güncelleme</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  Varsayılan Soru Süresi
                </label>
                <select
                  value={bulkSeconds}
                  onChange={(e) => setBulkSeconds(+e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none"
                >
                  <option value="10">10 saniye (Hızlı)</option>
                  <option value="20">20 saniye (Standart)</option>
                  <option value="30">30 saniye</option>
                  <option value="60">60 saniye (Düşünmeli)</option>
                  <option value="90">90 saniye</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  Varsayılan Puan Değeri
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  max="5000"
                  value={bulkPoints}
                  onChange={(e) => setBulkPoints(+e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={riskEnabled}
                  onChange={(e) => setRiskEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Risk Modu İzni (Doğruysa 2×, Yanlışsa -Puan)</span>
              </label>

              <button
                type="button"
                onClick={handleApplyBulk}
                className="btn-3d btn-3d-surface h-9 px-3.5 text-xs font-bold text-indigo-300 flex items-center gap-1.5 shrink-0"
              >
                {appliedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Uygulandı!</span>
                  </>
                ) : (
                  <span>Tüm Sorulara Uygula</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
