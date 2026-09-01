"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  reduceTransparency: boolean;
  setReduceTransparency: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
  reduceMotion: false,
  setReduceMotion: () => {},
  reduceTransparency: false,
  setReduceTransparency: () => {},
});

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [reduceTransparency, setReduceTransparencyState] = useState(false);

  const apply = useCallback((t: Theme) => {
    const r = t === "system" ? getSystemTheme() : t;
    setResolved(r);
    const root = document.documentElement;
    root.classList.toggle("dark", r === "dark");
    root.style.colorScheme = r;
  }, []);

  useEffect(() => {
    const storedTheme = (localStorage.getItem("cb-theme") as Theme) || "system";
    const storedMotion = localStorage.getItem("cb-motion") === "reduced";
    const storedTransparency = localStorage.getItem("cb-transparency") === "reduced";
    setThemeState(storedTheme);
    setReduceMotionState(storedMotion);
    setReduceTransparencyState(storedTransparency);
    apply(storedTheme);
    document.documentElement.classList.toggle("motion-reduced", storedMotion);
    document.documentElement.classList.toggle("reduce-transparency", storedTransparency);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      setThemeState((prev) => {
        if (prev === "system") apply("system");
        return prev;
      });
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [apply]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      localStorage.setItem("cb-theme", t);
      apply(t);
    },
    [apply]
  );

  const setReduceMotion = useCallback((v: boolean) => {
    setReduceMotionState(v);
    localStorage.setItem("cb-motion", v ? "reduced" : "full");
    document.documentElement.classList.toggle("motion-reduced", v);
  }, []);

  const setReduceTransparency = useCallback((v: boolean) => {
    setReduceTransparencyState(v);
    localStorage.setItem("cb-transparency", v ? "reduced" : "full");
    document.documentElement.classList.toggle("reduce-transparency", v);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolved,
        setTheme,
        reduceMotion,
        setReduceMotion,
        reduceTransparency,
        setReduceTransparency,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}