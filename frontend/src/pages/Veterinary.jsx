import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { Reveal } from "../hooks/useScrollReveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function VetCard({ vet, index, t }) {
  return (
    <div className="cc-card bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow"
      style={{ opacity: 0, animation: `cc-fade-zoom 0.4s ease ${index * 0.1}s both` }}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-xl font-bold text-emerald-600 flex-shrink-0 transition-transform hover:scale-110 duration-200">
          {vet.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">{vet.name}</h3>
          <div className="flex items-center gap-1 text-yellow-500 text-xs">
            {"★".repeat(Math.round(vet.rating || 4))}
            <span className="text-gray-500 ml-1">{vet.rating || 4.5} ({vet.reviews || 0})</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">🏥 {vet.specialization}</p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">📍 {vet.clinic_address}</p>
          {vet.distance_km != null && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{vet.distance_km} {t("vet_km_away")}</p>
          )}
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">📞 {vet.phone}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3 sm:mt-4">
        <a href={`tel:${vet.phone}`}
          className="cc-btn-outline flex-1 text-center py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs sm:text-sm font-medium">
          📞 {t("vet_call")}
        </a>
        <button className="cc-btn-primary flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium hover:bg-emerald-700">
          📅 {t("vet_book")}
        </button>
      </div>
    </div>
  );
}

export default function Veterinary() {
  const { t } = useLang();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [vets, setVets]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  // locationQuery is what gets sent to the API
  const [locationQuery, setLocationQuery] = useState("");

  // Build fetch URL using text-based location matching
  const fetchVets = async (locationText) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (locationText) params.set("location", locationText);
      // Also try to get GPS coords for distance display
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            params.set("lat", coords.latitude);
            params.set("lon", coords.longitude);
            doFetch(params);
          },
          () => doFetch(params)   // fallback: no GPS, still use text match
        );
      } else {
        doFetch(params);
      }
    } catch { setError(t("error_server")); setLoading(false); }
  };

  const doFetch = async (params) => {
    try {
      const res  = await fetch(`${API}/search-doctors?${params.toString()}`);
      const data = await res.json();
      setVets(data.vets || []);
      if (!data.vets?.length) setError("No veterinarians found for this location.");
    } catch { setError(t("error_server")); }
    finally { setLoading(false); }
  };

  // On mount: auto-load using URL param (from "Connect with Vet" button) or user's saved location
  useEffect(() => {
    const fromURL  = searchParams.get("location") || "";
    const fromUser = user?.location || "";
    const initial  = fromURL || fromUser;
    setSearch(initial);
    setLocationQuery(initial);
    if (initial) fetchVets(initial);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setLocationQuery(search);
    fetchVets(search);
  };

  const filtered = vets.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.clinic_address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 sm:py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">{t("vet_title")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">{t("vet_subtitle")}</p>
        </Reveal>

        {/* Search bar — location text */}
        <Reveal delay={60}>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
            <input
              type="text"
              placeholder="Enter your city / village / district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            <button type="submit"
              className="cc-btn-primary flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm whitespace-nowrap">
              🔍 Search Vets
            </button>
          </form>

          {locationQuery && (
            <p className="text-xs text-gray-400 mb-4">
              Showing veterinarians matching <span className="font-semibold text-emerald-600 dark:text-emerald-400">"{locationQuery}"</span>
            </p>
          )}
        </Reveal>

        {error && (
          <div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-xl text-sm cc-dropdown">
            ⚠️ {error}
          </div>
        )}

        {/* Skeleton loading */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow space-y-3">
                <div className="flex gap-4">
                  <div className="cc-shimmer w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="cc-shimmer h-4 rounded w-3/4" />
                    <div className="cc-shimmer h-3 rounded w-1/2" />
                    <div className="cc-shimmer h-3 rounded w-2/3" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="cc-shimmer h-9 rounded-xl flex-1" />
                  <div className="cc-shimmer h-9 rounded-xl flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((vet, i) => <VetCard key={vet.id} vet={vet} index={i} t={t} />)}
          </div>
        ) : !error ? (
          <Reveal>
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-4">👨‍⚕️</div>
              <p className="text-sm sm:text-base">Search your city or village to find veterinarians near you.</p>
            </div>
          </Reveal>
        ) : null}

        {/* Register CTA */}
        <Reveal delay={100}>
          <div className="mt-8 sm:mt-10 p-5 sm:p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl text-center cc-card">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm sm:text-base">{t("vet_register_title")}</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3">{t("vet_register_subtitle")}</p>
            <a href="/auth?tab=vet"
              className="cc-btn-primary inline-block px-5 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 text-sm">
              {t("vet_register_btn")}
            </a>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
