import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { Reveal } from "../hooks/useScrollReveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function History() {
  const { user } = useAuth();
  const { t } = useLang();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetch(`${API}/history/${user.id}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <Reveal className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t("history_login_required")}</h2>
        <p className="text-gray-500 mb-4 text-sm">{t("history_login_msg")}</p>
        <a href="/auth" className="cc-btn-primary px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 inline-block">
          {t("nav_login")}
        </a>
      </Reveal>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <Reveal>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">{t("history_title")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">{t("history_subtitle")}</p>
        </Reveal>

        {/* Skeleton loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow flex items-center gap-4">
                <div className="cc-shimmer w-3 h-3 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="cc-shimmer h-4 rounded w-1/3" />
                  <div className="cc-shimmer h-3 rounded w-1/2" />
                </div>
                <div className="cc-shimmer h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && history.length === 0 && (
          <Reveal>
            <div className="text-center py-16 sm:py-20 text-gray-400">
              <div className="text-4xl sm:text-5xl mb-4">📋</div>
              <p className="text-sm sm:text-base">{t("history_empty")}</p>
              <a href="/detect"
                className="cc-btn-primary inline-block mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
                {t("hero_btn_detect")}
              </a>
            </div>
          </Reveal>
        )}

        <div className="space-y-2 sm:space-y-3">
          {history.map((item, i) => (
            <div
              key={item.id}
              className="cc-card bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow flex items-center gap-3 sm:gap-4"
              style={{ opacity: 0, animation: `cc-fade-zoom 0.35s ease ${i * 0.06}s both` }}
            >
              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${item.is_infected ? "bg-red-500" : "bg-green-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">{item.label}</div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {t("history_confidence")}: <span className="font-medium">{item.confidence}%</span>
                  <span className="hidden sm:inline"> · {new Date(item.timestamp).toLocaleString()}</span>
                  <span className="sm:hidden block">{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                item.is_infected
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              }`}>
                {item.is_infected ? t("history_infected") : t("history_healthy")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
