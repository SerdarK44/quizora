"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Maximize2, X, QrCode } from "lucide-react";
import { playClick } from "@/lib/audio";

interface QRCodeCardProps {
  url: string;
  code: string;
  className?: string;
}

export function QRCodeCard({ url, code, className = "" }: QRCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 380,
      margin: 1.5,
      color: {
        dark: "#0b0f19",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((res) => {
        if (active) setDataUrl(res);
      })
      .catch((err) => {
        console.error("QR Code error:", err);
      });

    return () => {
      active = false;
    };
  }, [url]);

  const copyLink = async () => {
    playClick();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  return (
    <>
      <div
        className={`bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center backdrop-blur-xl ${className}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <QrCode className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">
            Kameranla Tara & Katıl
          </span>
        </div>

        {/* High-contrast QR Container */}
        <div
          onClick={() => setEnlarged(true)}
          title="QR Kodu Büyüt"
          className="group relative bg-white p-3.5 rounded-2xl shadow-xl cursor-pointer hover:ring-4 hover:ring-indigo-500/40 transition-all"
        >
          {dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dataUrl}
              alt={`Oda PIN ${code} için QR Kod`}
              className="w-44 h-44 sm:w-52 sm:h-52 object-contain rounded-lg"
            />
          ) : (
            <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center text-slate-400 text-xs">
              QR Hazırlanıyor…
            </div>
          )}

          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center gap-1.5 text-white font-bold text-xs transition-opacity">
            <Maximize2 className="w-4 h-4" />
            <span>Büyüt</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-3 max-w-[220px] leading-relaxed">
          Telefonunun kamerasını doğrult, takma adını yazıp anında yarışmaya başla.
        </p>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={copyLink}
          className={`mt-3 w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            copied
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
              : "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bağlantı Kopyalandı!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Bağlantıyı Kopyala</span>
            </>
          )}
        </button>
      </div>

      {/* Enlarged Modal for Projectors & TV Screens */}
      {enlarged && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center relative"
          >
            <button
              onClick={() => setEnlarged(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-1">
              Yarışmaya Katıl
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              Kameranla Tara
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Telefonun kamerasını ekrana tut veya PIN kodunu gir.
            </p>

            <div className="bg-white p-4 rounded-2xl shadow-2xl mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`Oda PIN ${code} için QR Kod`}
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 w-full mb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Oyun Kodu (PIN)
              </span>
              <span className="font-mono font-black text-3xl sm:text-4xl text-white tracking-[0.2em]">
                {code}
              </span>
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="btn-3d btn-3d-surface w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Katılım Bağlantısını Kopyala</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
