"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { type Locale, translations, type T } from "@/lib/i18n";

interface LocaleCtx {
  locale: Locale;
  t: T;
  toggle: () => void;
}

const LocaleContext = createContext<LocaleCtx>({
  locale: "ja",
  t: translations.ja,
  toggle: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ja");

  useEffect(() => {
    const saved = localStorage.getItem("pep_locale") as Locale | null;
    if (saved === "ja" || saved === "en") setLocale(saved);
  }, []);

  function toggle() {
    const next: Locale = locale === "ja" ? "en" : "ja";
    setLocale(next);
    localStorage.setItem("pep_locale", next);
  }

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale], toggle }}>
      {children}
    </LocaleContext.Provider>
  );
}
