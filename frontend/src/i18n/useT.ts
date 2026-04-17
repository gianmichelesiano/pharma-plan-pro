import { useLanguage } from "../contexts/LanguageContext";
import { translations } from "./translations";
import type { Namespace, Translations } from "./translations";

export function useT<N extends Namespace>(ns: N): Translations[N] {
  const { lang } = useLanguage();
  return translations[lang][ns] as Translations[N];
}
