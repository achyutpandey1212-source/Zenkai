"use client";

import React from "react";
import { Settings, Sparkles, Link2, CreditCard, User, Hammer } from "lucide-react";

export type SettingsTabType =
  | "general"
  | "companion"
  | "integrations"
  | "billing"
  | "account"
  | "about";

interface SettingsSidebarProps {
  activeTab: SettingsTabType;
  onTabChange: (tab: SettingsTabType) => void;
}

export default function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const tabs = [
    { id: "general" as const, label: "General", icon: Settings },
    { id: "companion" as const, label: "Companion", icon: Sparkles },
    { id: "integrations" as const, label: "Integrations & MCPs", icon: Link2 },
    { id: "billing" as const, label: "Billing & Plans", icon: CreditCard },
    { id: "account" as const, label: "Account", icon: User },
    { id: "about" as const, label: "Build with Me", icon: Hammer },
  ];

  return (
    <div className="w-full md:w-56 shrink-0 flex flex-col gap-1 border-b md:border-b-0 md:border-r border-border/40 pb-4 md:pb-0 md:pr-4">
      <span className="hidden md:block font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase mb-4 px-2 select-none">
        Settings
      </span>
      <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-sans font-medium tracking-wide transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-secondary text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              }`}
            >
              <Icon
                size={14}
                className={isActive ? "text-accent" : "text-muted-foreground"}
              />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
