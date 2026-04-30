import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { Reveal } from "../hooks/useScrollReveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Auth() {
  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const { t } = useLang();
  const [tab, setTab]     = useState("owner");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]     = useState({ type: "", text: "" });
  const [ownerForm, setOwnerForm] = useState({ phone: "", location: "", name: "" });
  const [vetForm, setVetForm]     = useState({
    name: "", phone: "", specialization: "Livestock Health",
    clinic_address: "", lat: "", lon: ""
  });

  const handleOwnerSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await registerUser(ownerForm);
      if (data.user_id) { setMsg({ type: "success", text: "Registered! Redirecting..." }); setTimeout(() => navigate("/detect"), 1500); }
      else setMsg({ type: "error", text: data.error || "Registration failed" });
    } catch { setMsg({ type: "error", text: t("error_server") }); }
    finally { setLoading(false); }
  };

  const handleVetSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res  = await fetch(`${API}/register-vet`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vetForm, lat: parseFloat(vetForm.lat), lon: parseFloat(vetForm.lon) })
      });
      const data = await res.json();
      if (res.ok) setMsg({ type: "success", text: "Veterinarian registered successfully!" });
      else setMsg({ type: "error", text: data.error || "Registration failed" });
    } catch { setMsg({ type: "error", text: t("error_server") }); }
    finally { setLoading(false); }
  };

  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow duration-200 text-sm";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-10 sm:py-12">
      <Reveal className="w-full max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-6 sm:mb-8">{t("auth_title")}</h1>

        {/* Animated tabs */}
        <div className="flex bg-white dark:bg-gray-800 rounded-2xl shadow p-1 mb-5 sm:mb-6">
          {[
            { key: "owner", label: `🐄 ${t("auth_owner_tab")}` },
            { key: "vet",   label: `👨‍⚕️ ${t("auth_vet_tab")}` },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => { setTab(key); setMsg({ type: "", text: "" }); }}
              className={`flex-1 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 ${
                tab === key ? "bg-emerald-600 text-white shadow scale-[1.02]" : "text-gray-600 dark:text-gray-400 hover:text-emerald-600"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Feedback message */}
        {msg.text && (
          <div className={`p-3 mb-4 rounded-xl text-sm cc-dropdown ${
            msg.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          }`}>
            {msg.type === "success" ? "✅" : "⚠️"} {msg.text}
          </div>
        )}

        {/* Owner Form */}
        {tab === "owner" && (
          <form onSubmit={handleOwnerSubmit} className="cc-fade-zoom bg-white dark:bg-gray-800 rounded-2xl shadow p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg">{t("auth_owner_title")}</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("auth_owner_subtitle")}</p>
            </div>
            {[
              { label: t("auth_name"),     key: "name",     placeholder: "Your name",        required: false, type: "text" },
              { label: t("auth_phone"),    key: "phone",    placeholder: "+91 XXXXX XXXXX",  required: true,  type: "tel" },
              { label: t("auth_location"), key: "location", placeholder: t("auth_location_placeholder"), required: true, type: "text" },
            ].map(({ label, key, placeholder, required, type }) => (
              <div key={key}>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {label}{required && " *"}
                </label>
                <input className={inp} type={type} required={required} placeholder={placeholder}
                  value={ownerForm[key]}
                  onChange={(e) => setOwnerForm({ ...ownerForm, [key]: e.target.value })} />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="cc-btn-primary w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-60 text-sm sm:text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t("auth_registering")}
                </span>
              ) : t("auth_get_started")}
            </button>
          </form>
        )}

        {/* Vet Form */}
        {tab === "vet" && (
          <form onSubmit={handleVetSubmit} className="cc-fade-zoom bg-white dark:bg-gray-800 rounded-2xl shadow p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg">{t("auth_vet_title")}</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("auth_vet_subtitle")}</p>
            </div>
            <div className="cc-auth-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: t("auth_full_name"),      key: "name",           placeholder: "Dr. John Smith",      type: "text", required: true },
                { label: t("auth_phone"),           key: "phone",          placeholder: "+91 XXXXX XXXXX",     type: "tel",  required: true },
                { label: t("auth_clinic_address"),  key: "clinic_address", placeholder: "123 Clinical Way",    type: "text", required: true },
                { label: t("auth_latitude"),        key: "lat",            placeholder: "e.g. 23.1815",        type: "number",required: true },
                { label: t("auth_longitude"),       key: "lon",            placeholder: "e.g. 79.9864",        type: "number",required: true },
              ].map(({ label, key, placeholder, type, required }) => (
                <div key={key}>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label} *</label>
                  <input className={inp} type={type} required={required} placeholder={placeholder} step="any"
                    value={vetForm[key]}
                    onChange={(e) => setVetForm({ ...vetForm, [key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auth_specialization")} *</label>
                <select className={inp} value={vetForm.specialization}
                  onChange={(e) => setVetForm({ ...vetForm, specialization: e.target.value })}>
                  {["Livestock Health","Bovine Medicine","Animal Surgery","General Veterinary"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              💡 Find coordinates at{" "}
              <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="text-emerald-500 underline hover:text-emerald-600 transition-colors">
                maps.google.com
              </a>{" "}→ right-click → copy coordinates.
            </p>
            <button type="submit" disabled={loading}
              className="cc-btn-primary w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-60 text-sm sm:text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t("auth_registering")}
                </span>
              ) : t("auth_register_vet_btn")}
            </button>
          </form>
        )}
      </Reveal>
    </div>
  );
}
