import { useLanguageStore } from "../store/languageStore";
import en from "./locales/en.json";
import ptBr from "./locales/pt-br.json";

const translations = {
  en,
  "pt-br": ptBr,
};

export function useTranslation() {
  const { language } = useLanguageStore();
  const t = (key: string) => {
    const keys = key.split(".");
    let value: any = translations[language];

    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        return key;
      }
    }
    return value as string;
  };

  return { t, language };
}
