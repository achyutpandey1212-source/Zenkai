"use client";

import React, { useState } from "react";
import Image from "next/image";
import { 
  Home, 
  MessageSquare, 
  CheckSquare, 
  Compass, 
  BookOpen, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export type ScreenType = "home" | "chat" | "tasks" | "identity" | "reflection" | "settings";

interface SidebarProps {
  currentScreen: ScreenType;
  onScreenChange: (screen: ScreenType) => void;
}

export default function Sidebar({ currentScreen, onScreenChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "chat", label: "Companion Chat", icon: MessageSquare },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "identity", label: "Identity", icon: Compass },
    { id: "reflection", label: "Reflection", icon: BookOpen },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-secondary border-r border-border flex flex-col justify-between py-8 transition-all duration-300 ease-in-out ${
        isExpanded ? "w-60" : "w-20"
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Top Section - Logo */}
      <div className="flex flex-col items-center px-4">
        <div className="h-10 w-full relative flex items-center justify-center">
          {isExpanded ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <Image 
                src="/assets/logo/logo_1.png" 
                alt="Zenkai Logo" 
                width={32} 
                height={32} 
                className="object-contain"
              />
              <span className="font-heading text-xl font-bold tracking-widest text-foreground">
                ZENKAI
              </span>
            </div>
          ) : (
            <Image 
              src="/assets/logo/logo_1.png" 
              alt="Zenkai Logo" 
              width={32} 
              height={32} 
              className="object-contain"
            />
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 mt-16 px-3 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onScreenChange(item.id)}
              className={`w-full flex items-center rounded-lg p-3 text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              <div className="flex items-center justify-center">
                <Icon 
                  size={20} 
                  className={`transition-transform duration-200 ${
                    isActive ? "scale-105" : "group-hover:scale-105"
                  } ${isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground"}`}
                />
              </div>
              
              <span
                className={`ml-4 font-sans tracking-wide whitespace-nowrap transition-opacity duration-200 ${
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {item.label}
              </span>

              {/* Tooltip for collapsed state */}
              {!isExpanded && (
                <div className="absolute left-16 scale-0 rounded-md bg-foreground text-background p-2 text-xs font-semibold shadow-md transition-all duration-100 origin-left group-hover:scale-100">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section - User Info / Collapsed indicator */}
      <div className="px-4">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-background/30 overflow-hidden">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-heading font-bold text-sm shrink-0">
            A
          </div>
          {isExpanded && (
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-xs font-medium text-foreground truncate">
                Achyut Pandey
              </span>
              <span className="font-sans text-[10px] text-muted-foreground truncate">
                User Profile
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
