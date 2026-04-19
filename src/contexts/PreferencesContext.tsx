import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
type DefaultTab = "ponto" | "operacoes";

interface PreferencesContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  defaultTab: DefaultTab;
  setDefaultTab: (t: DefaultTab) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const THEME_KEY = "esc-log-theme";
const TAB_KEY = "esc-log-default-tab";

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(THEME_KEY) as Theme) || "light";
  });
  const [defaultTab, setDefaultTabState] = useState<DefaultTab>(() => {
    if (typeof window === "undefined") return "ponto";
    return (localStorage.getItem(TAB_KEY) as DefaultTab) || "ponto";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(TAB_KEY, defaultTab);
  }, [defaultTab]);

  return (
    <PreferencesContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggleTheme: () => setThemeState((t) => (t === "light" ? "dark" : "light")),
        defaultTab,
        setDefaultTab: setDefaultTabState,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
};
