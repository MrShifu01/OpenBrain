import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { loadPersistedTheme, persistTheme, resolveTheme } from "./lib/themeToggle";

// Single source of truth for token values is index.css (@theme + light-mode overrides).
// This context only manages the dark/light class on <html> and exposes the toggle.
// Components must use CSS variables (var(--color-*)) — not JS color values.

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeCtx = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => resolveTheme(loadPersistedTheme()) === "dark");

  useEffect(() => {
    const root = document.documentElement;
    const theme = isDark ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
    persistTheme(theme);
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return <ThemeCtx.Provider value={{ isDark, toggleTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
