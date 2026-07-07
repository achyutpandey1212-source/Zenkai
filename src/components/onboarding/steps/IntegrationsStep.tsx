"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Link2, Check, RefreshCw, AlertCircle } from "lucide-react";
import StepLayout from "../layouts/StepLayout";

interface IntegrationsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export default function IntegrationsStep({ onNext, onBack }: IntegrationsStepProps) {
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [calendarEmail, setCalendarEmail] = useState("");
  const [checking, setChecking] = useState(true);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          const cs = data.settings.googleCalendarSettings;
          setCalendarConnected(!!cs?.connected);
          setCalendarEmail(cs?.email || "");
        }
      }
    } catch (e) {
      console.error("Failed to check settings status:", e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Failed to fetch Google URL:", err);
    }
  };

  const upcomingIntegrations = [
    { name: "Notion", icon: "/assets/icons/notion.svg", monochrome: false },
    { name: "GitHub", icon: "/assets/icons/github.svg", monochrome: true },
    { name: "Gmail", icon: "/assets/icons/gmail.svg", monochrome: false },
    { name: "Google Tasks", icon: "/assets/icons/google-calendar.svg", monochrome: false },
    { name: "Claude MCP", icon: "/assets/icons/claude.svg", monochrome: true },
    { name: "Filesystem MCP", icon: "/assets/icons/browser.svg", monochrome: true },
    { name: "Memory MCP", icon: "/assets/icons/browser.svg", monochrome: true },
    { name: "Browser MCP", icon: "/assets/icons/browser.svg", monochrome: true },
  ];

  return (
    <StepLayout
      title="MCPs & Integrations"
      subtitle="Connect your calendar and preview future productivity sync options."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="w-full max-w-lg mx-auto space-y-6 text-left animate-in fade-in duration-300">
        
        {/* Google Calendar Section */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center gap-2 text-accent">
            <Link2 size={16} />
            <span className="text-[10px] uppercase font-bold tracking-widest">Active Connections</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-secondary/50 border border-border shrink-0">
                <Image
                  src="/assets/icons/google-calendar.svg"
                  alt="Google Calendar"
                  width={20}
                  height={20}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <h4 className="font-heading text-sm font-medium text-foreground">Google Calendar</h4>
                <p className="font-sans text-[11px] text-muted-foreground leading-relaxed max-w-xs">
                  Mirror scheduled Zenkai tasks to your Google Calendar.
                </p>
              </div>
            </div>

            {checking ? (
              <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center">
                <RefreshCw size={12} className="animate-spin text-muted-foreground" />
              </div>
            ) : calendarConnected ? (
              <div className="flex flex-col items-end gap-1.5">
                <span className="font-sans text-[10px] text-green-500 font-semibold flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                  <Check size={10} /> Connected
                </span>
                <span className="font-sans text-[9px] text-muted-foreground max-w-[120px] truncate">
                  {calendarEmail}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                className="font-sans text-xs font-semibold bg-accent text-background hover:bg-accent/90 px-4 py-2 rounded-xl transition-all shadow-sm tracking-wide cursor-pointer text-center whitespace-nowrap"
              >
                Connect Calendar
              </button>
            )}
          </div>
        </div>

        {/* MCPs & Integrations Section */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle size={14} />
            <span className="text-[10px] uppercase font-bold tracking-widest">MCPs & Integrations (Coming Soon)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {upcomingIntegrations.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 bg-secondary/20 opacity-60 hover:opacity-80 transition-all select-none"
              >
                <div className="shrink-0 p-1.5 rounded-lg bg-secondary/50 border border-border/40">
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={14}
                    height={14}
                    className={item.monochrome ? "dark:invert" : ""}
                    onError={(e) => {
                      // Fallback if image doesn't exist
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-sans text-[11px] font-medium text-foreground">{item.name}</span>
                  <span className="font-sans text-[8px] text-accent font-bold uppercase tracking-wider">Soon</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </StepLayout>
  );
}
