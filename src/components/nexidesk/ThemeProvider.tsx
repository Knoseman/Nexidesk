"use client";

import { useEffect } from "react";
import type { AgentTheme } from "@/lib/schema";

export function ThemeProvider({
  theme,
  children,
}: {
  theme: AgentTheme;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else if (theme === "light") {
      html.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => html.classList.toggle("dark", mq.matches);
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  return <>{children}</>;
}
