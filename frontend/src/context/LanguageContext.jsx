import { createContext, useContext, useState } from "react";
import { translations } from "../i18n/translations";

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: "en",    name: "English",    flag: "🇬🇧", native: "English" },
  { code: "hi",    name: "Hindi",      flag: "🇮🇳", native: "हिन्दी" },
  { code: "mr",    name: "Marathi",    flag: "🇮🇳", native: "मराठी" },
  { code: "gu",    name: "Gujarati",   flag: "🇮🇳", native: "ગુજરાતી" },
  { code: "pa",    name: "Punjabi",    flag: "🇮🇳", native: "ਪੰਜਾਬੀ" },
  { code: "bn",    name: "Bengali",    flag: "🇧🇩", native: "বাংলা" },
  { code: "te",    name: "Telugu",     flag: "🇮🇳", native: "తెలుగు" },
  { code: "ta",    name: "Tamil",      flag: "🇮🇳", native: "தமிழ்" },
  { code: "kn",    name: "Kannada",    flag: "🇮🇳", native: "ಕನ್ನಡ" },
  { code: "ur",    name: "Urdu",       flag: "🇵🇰", native: "اردو" },
  { code: "ne",    name: "Nepali",     flag: "🇳🇵", native: "नेपाली" },
  { code: "ar",    name: "Arabic",     flag: "🇸🇦", native: "العربية" },
  { code: "fr",    name: "French",     flag: "🇫🇷", native: "Français" },
  { code: "es",    name: "Spanish",    flag: "🇪🇸", native: "Español" },
  { code: "pt",    name: "Portuguese", flag: "🇧🇷", native: "Português" },
  { code: "sw",    name: "Swahili",    flag: "🇰🇪", native: "Kiswahili" },
  { code: "tr",    name: "Turkish",    flag: "🇹🇷", native: "Türkçe" },
  { code: "ru",    name: "Russian",    flag: "🇷🇺", native: "Русский" },
  { code: "zh",    name: "Chinese",    flag: "🇨🇳", native: "中文" },
  { code: "id",    name: "Indonesian", flag: "🇮🇩", native: "Bahasa Indonesia" },
];

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem("cc_lang") || "en"
  );

  const changeLang = (code) => {
    setLang(code);
    localStorage.setItem("cc_lang", code);
    // Set RTL for Arabic/Urdu
    document.documentElement.dir = ["ar", "ur"].includes(code) ? "rtl" : "ltr";
  };

  // t() — translate a key, fallback to English
  const t = (key) =>
    translations[lang]?.[key] ?? translations["en"]?.[key] ?? key;

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t, currentLang, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
