"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    setIsDarkMode(root.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
      // Dispatch a custom event to sync with other components like Shell
      window.dispatchEvent(new Event("theme-change"));
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
      window.dispatchEvent(new Event("theme-change"));
    }
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="p-2.5 rounded-full border border-border/85 hover:border-accent/40 bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm flex items-center justify-center cursor-pointer"
      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDarkMode ? (
        <Sun size={16} className="text-accent" />
      ) : (
        <Moon size={16} className="text-muted-foreground" />
      )}
    </button>
  );
}
