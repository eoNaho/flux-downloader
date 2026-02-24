import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LanguageState {
  language: "en" | "pt-br";
  setLanguage: (lang: "en" | "pt-br") => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "en", // Default to English as per request
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: "language-storage",
    }
  )
);
