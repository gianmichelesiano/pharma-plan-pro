import React, { createContext, useContext, useEffect, useState } from "react";
import { Language } from "../i18n/translations";

const STORAGE_KEY = "pharma-plan-pro-lang";

const LanguageContext = createContext<{ lang: Language; setLang: (l: Language) => void }>({
  lang: "de" as Language,
  setLang: () => {},
});

function load(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ["de", "it", "fr", "en"].includes(v)) return v as Language;
  } catch {}
  return "de";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export { LanguageContext };
