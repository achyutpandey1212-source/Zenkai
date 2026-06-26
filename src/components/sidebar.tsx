"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Home, 
  MessageSquare, 
  CheckSquare, 
  Compass, 
  BookOpen, 
  Settings,
  Sun,
  Moon,
  Brain,
  Check,
  X
} from "lucide-react";

export type ScreenType = "home" | "chat" | "tasks" | "identity" | "reflection" | "settings" | "memory";

interface SidebarProps {
  currentScreen: ScreenType;
  onScreenChange: (screen: ScreenType) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({ 
  currentScreen, 
  onScreenChange, 
  isDarkMode, 
  onToggleTheme,
  activeConversationId,
  onSelectConversation,
  onNewChat
}: SidebarProps) {
  interface SidebarConversation {
    _id: string;
    title?: string;
    startedAt?: string;
    createdAt?: string;
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Load conversation history on mount and when activeConversationId changes
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setConversations(data.conversations || []);
          }
        }
      } catch (err) {
        console.error("Failed to load conversations in Sidebar:", err);
      }
    }
    loadConversations();
  }, [activeConversationId]);

  const baseMenuItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "chat" as const, label: "Companion Chat", icon: MessageSquare },
    { id: "tasks" as const, label: "Tasks", icon: CheckSquare },
    { id: "identity" as const, label: "Identity", icon: Compass },
    { id: "reflection" as const, label: "Reflection", icon: BookOpen },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  const menuItems = [
    ...baseMenuItems,
    ...(process.env.NODE_ENV === "development"
      ? [{ id: "memory" as const, label: "Memory Inspector", icon: Brain }]
      : []),
  ];

  // Helper to group conversations by relative date
  const groupConversations = (items: SidebarConversation[]) => {
    const todayList: SidebarConversation[] = [];
    const yesterdayList: SidebarConversation[] = [];
    const olderList: SidebarConversation[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    items.forEach((c) => {
      const date = new Date(c.startedAt || c.createdAt || "");
      if (date >= startOfToday) {
        todayList.push(c);
      } else if (date >= startOfYesterday) {
        yesterdayList.push(c);
      } else {
        olderList.push(c);
      }
    });

    return { today: todayList, yesterday: yesterdayList, older: olderList };
  };

  const { today, yesterday, older } = groupConversations(conversations);

  const handleStartEdit = (e: React.MouseEvent, c: SidebarConversation) => {
    e.stopPropagation();
    setEditingId(c._id.toString());
    setEditingTitle(c.title || "Untitled Conversation");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingTitle.trim()) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: editingTitle.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConversations((prev) =>
            prev.map((c) =>
              c._id === id ? { ...c, title: editingTitle.trim() } : c
            )
          );
        }
      }
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    } finally {
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const renderConvItem = (c: SidebarConversation) => {
    const isActive = activeConversationId === c._id.toString();
    const isEditing = editingId === c._id.toString();

    if (isEditing) {
      return (
        <div key={c._id} className="flex items-center gap-1 px-1 py-0.5 w-full bg-background/25 rounded">
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit(c._id);
              if (e.key === "Escape") handleCancelEdit();
            }}
            className="w-full text-[10px] font-sans px-1 py-0.5 rounded border border-accent bg-background text-foreground outline-none shrink min-w-0"
            autoFocus
          />
          <button
            onClick={() => handleSaveEdit(c._id)}
            className="text-accent hover:text-accent/80 p-0.5 shrink-0"
          >
            <Check size={10} />
          </button>
          <button
            onClick={handleCancelEdit}
            className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
          >
            <X size={10} />
          </button>
        </div>
      );
    }

    return (
      <div 
        key={c._id} 
        className="group/item flex items-center justify-between w-full rounded hover:bg-background/20"
      >
        <button
          onClick={() => onSelectConversation(c._id.toString())}
          className={`flex-1 text-left px-2 py-1 text-[11px] font-sans truncate transition-colors block ${
            isActive
              ? "text-accent font-semibold border-l-2 border-accent pl-1.5"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={c.title || "Untitled Conversation"}
        >
          {c.title || "Untitled Conversation"}
        </button>
        <button
          onClick={(e) => handleStartEdit(e, c)}
          className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-accent p-0.5 transition-opacity shrink-0 mr-1"
          title="Rename Chat"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={2} 
            stroke="currentColor" 
            className="w-3 h-3"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-secondary border-r border-border flex flex-col justify-between py-8 transition-all duration-300 ease-in-out overflow-x-hidden ${
        isExpanded ? "w-48 md:w-60" : "w-16 md:w-20"
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Top Section - Logo */}
      <div className="flex flex-col items-center px-2 md:px-4 shrink-0">
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
      <nav className="flex-1 mt-12 px-3 space-y-2 overflow-y-auto">
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className={`w-full flex items-center rounded-lg p-3 text-sm font-medium transition-all duration-200 bg-accent/15 border border-accent/25 hover:bg-accent/25 hover:text-foreground text-accent shadow-sm mb-4 justify-center ${
            isExpanded ? "gap-2" : "h-10 w-10 p-0"
          }`}
          title="New Chat"
        >
          <span className="text-base font-bold">+</span>
          {isExpanded && <span className="font-sans tracking-wide">New Chat</span>}
        </button>

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
                className={`ml-3 md:ml-4 font-sans tracking-wide whitespace-nowrap transition-opacity duration-200 ${
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {item.label}
              </span>

              {/* Tooltip for collapsed state */}
              {!isExpanded && (
                <div className="absolute left-14 md:left-16 scale-0 rounded-md bg-foreground text-background p-2 text-xs font-semibold shadow-md transition-all duration-100 origin-left group-hover:scale-100 z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}

        {/* Conversation History List */}
        {isExpanded && conversations.length > 0 && (
          <div className="pt-4 border-t border-border/40 space-y-3">
            <span className="text-[10px] font-sans font-bold tracking-wider text-muted-foreground uppercase block px-1">
              History
            </span>
            <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
              {today.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground/60 font-semibold px-1 font-mono uppercase block">Today</span>
                  {today.map(renderConvItem)}
                </div>
              )}
              {yesterday.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground/60 font-semibold px-1 font-mono uppercase block">Yesterday</span>
                  {yesterday.map(renderConvItem)}
                </div>
              )}
              {older.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground/60 font-semibold px-1 font-mono uppercase block">Older</span>
                  {older.map(renderConvItem)}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Section - Theme Toggle & User Info */}
      <div className="px-3 space-y-4 shrink-0">
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center rounded-lg p-3 text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-background/50 hover:text-foreground group relative"
        >
          <div className="flex items-center justify-center">
            {isDarkMode ? (
              <Sun size={20} className="text-accent group-hover:scale-110 transition-transform duration-200" />
            ) : (
              <Moon size={20} className="text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-transform duration-200" />
            )}
          </div>
          <span
            className={`ml-3 md:ml-4 font-sans tracking-wide whitespace-nowrap transition-opacity duration-200 ${
              isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
          >
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </span>

          {/* Tooltip for collapsed state */}
          {!isExpanded && (
            <div className="absolute left-14 md:left-16 scale-0 rounded-md bg-foreground text-background p-2 text-xs font-semibold shadow-md transition-all duration-100 origin-left group-hover:scale-100 z-50">
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </div>
          )}
        </button>

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
