import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { Reveal } from "../hooks/useScrollReveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Reusable input style ──────────────────────────────────────────────────────
const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow duration-200 text-sm";

// ── Feedback banner ───────────────────────────────────────────────────────────
function Msg({ type, text }) {
  if (!text) return null;
  return (
    <div className={`p-3 mb-4 rounded-xl text-sm cc-dropdown flex items-start gap-2 ${
      type === "success"
        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
        : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
    }`}>
      <span>{type === "success" ? "✅" : "⚠️"}</span>
      <span>{text}</span>
    </div>
  );
}

// ── Spinner button ────────────────────────────────────────────────────────────
function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button type="submit" disabled={loading}
      className="cc-btn-primary w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-60 text-sm sm:text-base transition-all">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          {loadingLabel}
        </span>
      ) : label}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// OWNER PANEL  (Login + Register with sub-tabs)
// ════════════════════════════════════════════════════════════════════════════
function OwnerPanel({ t }) {
  const navigate = useNavigate();
  const { loginUser, registerUser } = useAuth();
  const [mode, setMode]     = useState("login");   // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState({ type: "", text: "" });
  const [loginPhone, setLoginPhone]   = useState("");
  const [regForm, setRegForm] = useState({ phone: "", location: "", name: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg({ type: "", text: "" });
    const { ok, data } = await loginUser(loginPhone.trim());
    if (ok) {
      setMsg({ type: "success", text: `Welcome back${data.name ? ", " + data.name : ""}! Redirecting...` });
      setTimeout(() => navigate("/detect"), 1200);
    } else {
      // If not found, nudge user to register
      if (data.error?.includes("not registered")) {
        setMsg({ type: "error", text: "Phone not found. Please register first ↓" });
        setTimeout(() => setMode("register"), 1000);
      } else {
        setMsg({ type: "error", text: data.error || "Login failed" });
      }
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg({ type: "", text: "" });
    const { ok, data } = await registerUser(regForm);
    if (ok) {
      setMsg({ type: "success", text: "Registered successfully! Redirecting..." });
      setTimeout(() => navigate("/detect"), 1200);
    } else {
      // If duplicate phone, nudge to login
      if (data.error?.includes("already registered")) {
        setMsg({ type: "error", text: "Already registered. Please login instead ↑" });
        setTimeout(() => setMode("login"), 1000);
      } else {
        setMsg({ type: "error", text: data.error || "Registration failed" });
      }
    }
    setLoading(false);
  };

  return (
    <div className="cc-fade-zoom bg-white dark:bg-gray-800 rounded-2xl shadow p-5 sm:p-6 space-y-4">

      {/* Login / Register sub-toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
        {[
          { key: "login",    label: "🔑 Login" },
          { key: "register", label: "📝 Register" },
        ].map(({ key, label }) => (
          <button key={key} type="button"
            onClick={() => { setMode(key); setMsg({ type: "", text: "" }); }}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
              mode === key
                ? "bg-white dark:bg-gray-600 text-emerald-700 dark:text-emerald-300 shadow"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <Msg type={msg.type} text={msg.text} />

      {/* ── LOGIN ── */}
      {mode === "login" && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg">Welcome Back</h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">Enter your registered phone number to continue.</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number *
            </label>
            <input className={inp} type="tel" required placeholder="+91 XXXXX XXXXX"
              value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} />
          </div>
          <SubmitBtn loading={loading} label="Login →" loadingLabel="Logging in..." />
          <p className="text-center text-xs text-gray-400">
            New user?{" "}
            <button type="button" onClick={() => { setMode("register"); setMsg({ type: "", text: "" }); }}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Register here
            </button>
          </p>
        </form>
      )}

      {/* ── REGISTER ── */}
      {mode === "register" && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg">Create Account</h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">Register to access AI detection and veterinary tools.</p>
          </div>
          {[
            { label: "Name (optional)", key: "name",     placeholder: "Your name",         required: false, type: "text" },
            { label: "Phone Number *",  key: "phone",    placeholder: "+91 XXXXX XXXXX",   required: true,  type: "tel" },
            { label: "Location *",      key: "location", placeholder: "Village / District / State", required: true, type: "text" },
          ].map(({ label, key, placeholder, required, type }) => (
            <div key={key}>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
              <input className={inp} type={type} required={required} placeholder={placeholder}
                value={regForm[key]}
                onChange={(e) => setRegForm({ ...regForm, [key]: e.target.value })} />
            </div>
          ))}
          <SubmitBtn loading={loading} label="Create Account →" loadingLabel="Registering..." />
          <p className="text-center text-xs text-gray-400">
            Already registered?{" "}
            <button type="button" onClick={() => { setMode("login"); setMsg({ type: "", text: "" }); }}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Login here
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VET PANEL  (no lat/lon)
// ════════════════════════════════════════════════════════════════════════════
function VetPanel({ t }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState({ type: "", text: "" });
  const [form, setForm] = useState({
    name: "", phone: "", specialization: "Livestock Health", clinic_address: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg({ type: "", text: "" });
    try {
      const res  = await fetch(`${API}/register-vet`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: "Registered successfully! Patients near your location can now find you." });
        setForm({ name: "", phone: "", specialization: "Livestock Health", clinic_address: "" });
      } else {
        setMsg({ type: "error", text: data.error || "Registration failed" });
      }
    } catch {
      setMsg({ type: "error", text: "Server error. Is the backend running?" });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="cc-fade-zoom bg-white dark:bg-gray-800 rounded-2xl shadow p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg">Veterinarian Registration</h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Join our network. Cattle owners in your area will be connected to you automatically.
        </p>
      </div>

      <Msg type={msg.type} text={msg.text} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {[
          { label: "Full Name *",      key: "name",           placeholder: "Dr. John Smith",    type: "text", required: true },
          { label: "Phone Number *",   key: "phone",          placeholder: "+91 XXXXX XXXXX",   type: "tel",  required: true },
        ].map(({ label, key, placeholder, type, required }) => (
          <div key={key}>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <input className={inp} type={type} required={required} placeholder={placeholder}
              value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Clinic Address *
            <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400 font-normal">
              (include city/town so patients can find you)
            </span>
          </label>
          <input className={inp} type="text" required
            placeholder="e.g. 123 Main Road, Ujjain, Madhya Pradesh"
            value={form.clinic_address}
            onChange={(e) => setForm({ ...form, clinic_address: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">
            💡 Include your city name — patients are matched to you based on their location matching your address.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Specialization *</label>
          <select className={inp} value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}>
            {["Livestock Health", "Bovine Medicine", "Animal Surgery", "General Veterinary"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <SubmitBtn loading={loading} label="Register as Veterinarian ✓" loadingLabel="Registering..." />
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN AUTH PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function Auth() {
  const { t } = useLang();
  const [tab, setTab] = useState("owner");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-10 sm:py-12">
      <Reveal className="w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-6 sm:mb-8">
          {t("auth_title")}
        </h1>

        {/* Main tab switcher */}
        <div className="flex bg-white dark:bg-gray-800 rounded-2xl shadow p-1 mb-5 sm:mb-6">
          {[
            { key: "owner", label: "🐄 Cattle Owner" },
            { key: "vet",   label: "👨‍⚕️ Veterinarian" },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 ${
                tab === key
                  ? "bg-emerald-600 text-white shadow scale-[1.02]"
                  : "text-gray-600 dark:text-gray-400 hover:text-emerald-600"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "owner" && <OwnerPanel t={t} />}
        {tab === "vet"   && <VetPanel   t={t} />}
      </Reveal>
    </div>
  );
}
