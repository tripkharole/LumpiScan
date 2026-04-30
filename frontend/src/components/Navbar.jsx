import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { t } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const links = [
    { to: "/",           label: t("nav_home") },
    { to: "/detect",     label: t("nav_detection") },
    { to: "/veterinary", label: t("nav_veterinary") },
    { to: "/history",    label: t("nav_history") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const cycleTheme = () => {
    const order = ["light", "dark", "system"];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  };
  const themeIcon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻";

  return (
    <>
      <nav className={`sticky top-0 z-50 cc-nav${scrolled ? " scrolled" : ""} bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700`}>
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">

          <Link to="/" className="font-bold text-xl text-emerald-600 dark:text-emerald-400 flex-shrink-0 transition-transform hover:scale-105">
            🐄 LumpiScan
          </Link>

          <div className="hidden md:flex gap-6">
            {links.map(({ to, label }) => (
              <Link key={to} to={to}
                className={`text-sm font-medium transition-all duration-200 relative py-1 ${
                  pathname === to
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                }`}
              >
                {label}
                <span className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: pathname === to ? "100%" : "0%" }} />
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <button onClick={cycleTheme} title={`Theme: ${theme}`}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200">
              <span className="cc-theme-icon text-lg">{themeIcon}</span>
            </button>
            <div className="hidden sm:flex items-center gap-2">
              {user ? (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-300 hidden lg:block max-w-[100px] truncate">{user.phone}</span>
                  <button onClick={logout}
                    className="text-sm px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all duration-200 font-medium">
                    {t("nav_logout")}
                  </button>
                </>
              ) : (
                <Link to="/auth" className="cc-btn-primary text-sm px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
                  {t("nav_login")}
                </Link>
              )}
            </div>

            {/* Hamburger */}
            <button onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Menu">
              <span className="block h-0.5 w-5 bg-gray-600 dark:bg-gray-300 rounded transition-all duration-300"
                style={{ transform: menuOpen ? "rotate(45deg) translate(2px,6px)" : "none" }} />
              <span className="block h-0.5 w-5 bg-gray-600 dark:bg-gray-300 rounded transition-all duration-300"
                style={{ opacity: menuOpen ? 0 : 1 }} />
              <span className="block h-0.5 w-5 bg-gray-600 dark:bg-gray-300 rounded transition-all duration-300"
                style={{ transform: menuOpen ? "rotate(-45deg) translate(2px,-6px)" : "none" }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className="md:hidden fixed inset-0 z-40 transition-all duration-300"
        style={{ opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? "auto" : "none" }}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
        <div className="absolute top-14 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-xl cc-dropdown">
          <div className="px-4 py-4 space-y-1">
            {links.map(({ to, label }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  pathname === to
                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}>
                {label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              {user ? (
                <button onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  {t("nav_logout")} ({user.phone})
                </button>
              ) : (
                <Link to="/auth" onClick={() => setMenuOpen(false)}
                  className="block text-center px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
                  {t("nav_login")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
