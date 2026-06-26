"use client";

import React, { useState, useEffect } from "react";
import Sidebar, { ScreenType } from "./sidebar";
import Home from "./screens/home";
import Chat from "./screens/chat";
import Tasks from "./screens/tasks";
import Identity from "./screens/identity";
import Reflection from "./screens/reflection";
import Settings from "./screens/settings";
import Onboarding, { OnboardingData } from "./onboarding";

export default function Shell() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // On mount: read onboardingCompleted from MongoDB (via /api/auth/me)
  // This ensures each Firebase account has its own onboarding status —
  // not shared via localStorage across accounts on the same browser.
  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setOnboardingCompleted(data.user?.onboardingCompleted === true);
        } else {
          // If not authenticated, the layout already redirected — default to false
          setOnboardingCompleted(false);
        }
      } catch {
        setOnboardingCompleted(false);
      }
    }

    checkOnboardingStatus();

    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      setIsDarkMode(root.classList.contains("dark"));

      const handleThemeChange = () => {
        setIsDarkMode(root.classList.contains("dark"));
      };

      window.addEventListener("theme-change", handleThemeChange);
      return () => window.removeEventListener("theme-change", handleThemeChange);
    }
  }, []);

  const handleOnboardingComplete = async (onboardingData: OnboardingData) => {
    try {
      // Persist onboarding data to MongoDB
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingData),
      });

      if (!res.ok) {
        console.error("Failed to save onboarding data:", await res.text());
      }
    } catch (err) {
      console.error("Onboarding persistence error:", err);
    }

    // Update state regardless so the user isn't blocked if a network error occurs
    setOnboardingCompleted(true);
  };

  // Sync theme with DOM and localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (isDarkMode) {
        root.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        root.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return <Home onNavigateToChat={() => setCurrentScreen("chat")} />;
      case "chat":
        return <Chat />;
      case "tasks":
        return <Tasks />;
      case "identity":
        return <Identity />;
      case "reflection":
        return <Reflection />;
      case "settings":
        return <Settings />;
      default:
        return <Home onNavigateToChat={() => setCurrentScreen("chat")} />;
    }
  };

  if (onboardingCompleted === null) {
    return <div className="h-screen w-full bg-background" />;
  }

  if (!onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-background flex text-foreground transition-colors duration-300">
      {/* Navigation Left Sidebar */}
      <Sidebar 
        currentScreen={currentScreen} 
        onScreenChange={setCurrentScreen} 
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 h-screen max-h-screen overflow-hidden pl-16 md:pl-20 transition-all duration-300">
        <div className="w-full h-full relative overflow-hidden">
          {renderScreen()}
        </div>
      </main>
    </div>
  );
}
