"use client";

import React, { useState } from "react";
import Sidebar, { ScreenType } from "./sidebar";
import Home from "./screens/home";
import Chat from "./screens/chat";
import Tasks from "./screens/tasks";
import Identity from "./screens/identity";
import Reflection from "./screens/reflection";
import Settings from "./screens/settings";

export default function Shell() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");

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

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Navigation Left Sidebar */}
      <Sidebar currentScreen={currentScreen} onScreenChange={setCurrentScreen} />
      
      {/* Main Content Area */}
      <main className="flex-1 min-h-screen pl-20 transition-all duration-300">
        <div className="w-full h-full min-h-screen relative">
          {renderScreen()}
        </div>
      </main>
    </div>
  );
}
