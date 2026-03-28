import { useLanguageStore } from "../store/languageStore";
import en from "./locales/en.json";
import ptBr from "./locales/pt-br.json";

const translations = {
  en,
  "pt-br": ptBr,
};

export function useTranslation() {
  const { language } = useLanguageStore();
  const t = (key: string, vars?: Record<string, string | number>) => {
    const keys = key.split(".");
    let value: any = translations[language];

    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        return key;
      }
    }

    let result = value as string;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(`{{${k}}}`, String(v));
      }
    }
    return result;
  };

  return { t, language };
}
