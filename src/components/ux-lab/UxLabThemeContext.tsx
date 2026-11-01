import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type UxLabTheme = "light" | "dark";

interface UxLabThemeContextValue {
  theme: UxLabTheme;
  setTheme: (theme: UxLabTheme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const THEME_STORAGE_KEY = "esc-log-theme";

const UxLabThemeContext = createContext<UxLabThemeContextValue | undefined>(undefined);

export const UxLabThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const existing = useContext(UxLabThemeContext);
  if (existing) {
    return <>{children}</>;
  }

  const [theme, setThemeState] = useState<UxLabTheme>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        return stored;
      }
    } catch (e) {
      console.warn("[UX LAB] Falha ao ler preferência de tema do localStorage:", e);
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.warn("[UX LAB] Falha ao persistir preferência de tema:", e);
    }
  }, [theme]);

  const setTheme = (newTheme: UxLabTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <UxLabThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === "dark",
      }}
    >
      {children}
    </UxLabThemeContext.Provider>
  );
};

export const useUxLabTheme = (): UxLabThemeContextValue => {
  const context = useContext(UxLabThemeContext);
  if (!context) {
    // Fallback seguro caso um componente do UX LAB seja montado sem o Provider direto
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    return {
      theme: isDark ? "dark" : "light",
      setTheme: (t) => {
        if (typeof document !== "undefined") {
          if (t === "dark") document.documentElement.classList.add("dark");
          else document.documentElement.classList.remove("dark");
          try {
            localStorage.setItem(THEME_STORAGE_KEY, t);
          } catch {}
        }
      },
      toggleTheme: () => {
        if (typeof document !== "undefined") {
          const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
          if (next === "dark") document.documentElement.classList.add("dark");
          else document.documentElement.classList.remove("dark");
          try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
          } catch {}
        }
      },
      isDark,
    };
  }
  return context;
};
