import { useState, useRef, useEffect } from "react";
import { useLang } from "../context/LanguageContext";

export default function LanguageSwitcher() {
  const { currentLang, changeLang, LANGUAGES, t } = useLang();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => { setOpen(!open); setSearch(""); }}
        title={t("language_select")}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="hidden sm:inline">{currentLang.native}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              🌐 {t("language_select")}
            </p>
            {/* Search */}
            <input
              type="text"
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Language List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No language found</p>
            ) : (
              filtered.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { changeLang(lang.code); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left ${
                    currentLang.code === lang.code
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="text-xl w-7 text-center">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{lang.native}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{lang.name}</div>
                  </div>
                  {currentLang.code === lang.code && (
                    <span className="text-emerald-500 text-base">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
