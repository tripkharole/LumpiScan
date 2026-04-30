import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { Reveal } from "../hooks/useScrollReveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function ConfidenceBar({ value, infected }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 120);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>Confidence</span><span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ease-out ${infected ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function Detection() {
  const { user } = useAuth();
  const { t } = useLang();
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f));
    setResult(null); setError("");
  };
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const predict = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    const form = new FormData();
    form.append("image", file);
    form.append("user_id", user?.id || "anonymous");
    try {
      const res  = await fetch(`${API}/predict`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prediction failed");
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 sm:py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">{t("detect_title")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">{t("detect_subtitle")}</p>
        </Reveal>

        <div className="cc-detect-grid grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">

          {/* ── Upload Panel ── */}
          <Reveal className="space-y-3 sm:space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current.click()}
              className={`cc-scan-container border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-300 ${
                dragOver
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 scale-[1.02]"
                  : "border-emerald-400 dark:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-500"
              }`}
            >
              {loading && <div className="cc-scan-line" />}
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview"
                    className={`max-h-44 sm:max-h-48 mx-auto rounded-xl object-cover w-full transition-all duration-300 ${loading ? "opacity-60" : "opacity-100"}`} />
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/40 rounded-xl px-3 py-1 text-white text-xs font-medium">Scanning...</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-4xl sm:text-5xl transition-transform hover:scale-110 duration-200">📤</div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm sm:text-base">{t("detect_upload_title")}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">{t("detect_upload_hint")}</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e.target.files[0])} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={() => fileRef.current.click()}
                className="cc-btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 text-sm">
                📁 {t("detect_btn_select")}
              </button>
              {/* Camera button with pulse */}
              <div className="relative flex-1">
                <button onClick={() => alert("Camera capture — use a mobile browser for best results.")}
                  className="cc-btn-outline w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 rounded-xl font-medium text-sm relative overflow-hidden">
                  <span className="cc-pulse-ring" style={{ animationDuration: "2s" }} />
                  📷 {t("detect_btn_camera")}
                </button>
              </div>
            </div>

            {/* Run button */}
            {file && (
              <button onClick={predict} disabled={loading}
                className="cc-btn-primary w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-base sm:text-lg disabled:cursor-not-allowed">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                    {t("detect_btn_running")}
                  </span>
                ) : `🔬 ${t("detect_btn_run")}`}
              </button>
            )}

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm cc-fade-zoom">
                ⚠️ {error}
              </div>
            )}
          </Reveal>

          {/* ── Result Panel ── */}
          <Reveal delay={80} className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 shadow min-h-[280px] sm:min-h-[300px] flex flex-col">
            {!result && !loading && (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-center">
                <div>
                  <div className="text-4xl sm:text-5xl mb-3">🐄</div>
                  <p className="text-sm sm:text-base">{t("detect_placeholder")}</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                {/* Animated DNA helix-style loader */}
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-900" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 border-r-emerald-300 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-b-emerald-500 border-l-emerald-300 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.9s" }} />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm animate-pulse">{t("detect_btn_running")}</p>
                {/* shimmer bars */}
                <div className="w-full space-y-2 px-4">
                  {[80, 60, 40].map((w) => (
                    <div key={w} className="cc-shimmer h-3 rounded-full" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="cc-fade-zoom space-y-4 flex-1 flex flex-col">
                {/* Status badge */}
                <div className={`flex items-center justify-between p-3 sm:p-4 rounded-xl ${
                  result.is_infected
                    ? "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700"
                    : "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700"
                }`}>
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${result.is_infected ? "text-red-500" : "text-green-500"}`}>
                      {result.is_infected ? `⚠️ ${t("detect_alert")}` : `✅ ${t("detect_clear")}`}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{result.prediction}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl sm:text-3xl font-bold ${result.is_infected ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {result.confidence}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t("detect_confidence")}</div>
                  </div>
                </div>

                {/* Animated confidence bar */}
                <ConfidenceBar value={result.confidence} infected={result.is_infected} />

                <div className="text-xs text-gray-400">{t("detect_case_id")}: {result.case_id?.slice(0, 8).toUpperCase()}</div>

                {/* Recommendations */}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2 text-xs sm:text-sm uppercase tracking-wide">
                    {t("detect_recommendations")}
                  </h3>
                  <ul className="space-y-1.5">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400"
                        style={{ opacity: 0, animation: `cc-fade-zoom 0.3s ease ${i * 0.08 + 0.2}s both` }}>
                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{rec}
                      </li>
                    ))}
                  </ul>
                </div>

                {result.is_infected && (
                  <a href="/veterinary"
                    className="cc-btn-primary block w-full text-center py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 text-sm sm:text-base">
                    {t("detect_connect_vet")}
                  </a>
                )}
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </div>
  );
}
