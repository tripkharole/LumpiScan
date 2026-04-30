import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { Reveal, useInView } from "../hooks/useScrollReveal";

const stats = [
  { value: "< 3s",    label: "Inference Time" },
  { value: "2-Class", label: "Classification" },
  { value: "224px",   label: "Input Size" },
  { value: "MBNetV2", label: "Architecture" },
];

export default function Home() {
  const { t } = useLang();
  const [featRef, featInView] = useInView();
  const [ctaRef, ctaInView]   = useInView();

  const features = [
    { icon: "🔬", title: t("feature_ai_title"),       desc: t("feature_ai_desc") },
    { icon: "⚡", title: t("feature_realtime_title"), desc: t("feature_realtime_desc") },
    { icon: "📋", title: t("feature_history_title"),  desc: t("feature_history_desc") },
    { icon: "👨‍⚕️", title: t("feature_vet_title"),   desc: t("feature_vet_desc") },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 pt-12 sm:pt-16 pb-12 flex flex-col md:flex-row items-center gap-10 sm:gap-12">
        <Reveal className="flex-1 space-y-5 sm:space-y-6 w-full">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("hero_badge")}
          </span>

          <h1 className="cc-hero-title text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
            {t("hero_title")}
          </h1>

          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-lg">
            {t("hero_subtitle")}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/detect"
              className="cc-btn-primary px-5 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md text-sm sm:text-base">
              📸 {t("hero_btn_detect")}
            </Link>
            <Link to="/veterinary"
              className="cc-btn-outline px-5 sm:px-6 py-2.5 sm:py-3 border-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-semibold rounded-xl text-sm sm:text-base">
              {t("hero_btn_vets")}
            </Link>
          </div>
        </Reveal>

        {/* Stats card — floats */}
        <Reveal delay={120} className="flex-1 flex justify-center w-full">
          <div className="cc-float cc-card bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-xs sm:max-w-sm">
            <div className="text-center mb-4">
              <div className="text-4xl sm:text-5xl font-bold text-emerald-600 dark:text-emerald-400">98.4%</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">Model Accuracy</div>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-6">
              <div className="bg-emerald-500 h-2 rounded-full cc-bar-fill" style={{ width: "98.4%" }} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              {stats.map(({ value, label }) => (
                <div key={label} className="text-center p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">{value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-10">
            Intelligent Livestock Monitoring
          </h2>
        </Reveal>
        <div
          ref={featRef}
          className={`cc-stagger${featInView ? " revealed" : ""} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6`}
        >
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="cc-card bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 shadow">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm sm:text-base">{title}</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        <div ref={ctaRef}
          className="rounded-2xl p-8 sm:p-10 text-white text-center transition-all duration-700 bg-emerald-600 dark:bg-emerald-700"
          style={{ opacity: ctaInView ? 1 : 0, transform: ctaInView ? "none" : "translateY(24px)" }}>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{t("cta_title")}</h2>
          <p className="mb-5 sm:mb-6 text-emerald-100 text-sm sm:text-base">{t("cta_subtitle")}</p>
          <Link to="/detect"
            className="cc-btn-primary inline-block px-6 sm:px-8 py-2.5 sm:py-3 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 text-sm sm:text-base">
            {t("cta_btn")}
          </Link>
        </div>
      </section>
    </div>
  );
}
