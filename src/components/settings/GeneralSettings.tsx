"use client";

import React from "react";
import SectionHeader from "./SectionHeader";
import Toggle from "./Toggle";

interface GeneralSettingsProps {
  // Theme settings
  isDarkMode: boolean;
  onToggleTheme: () => void;
  // MongoDB Settings
  morningBrief: boolean;
  setMorningBrief: (val: boolean) => void;
  nightReflection: boolean;
  setNightReflection: (val: boolean) => void;
  timezone: string;
  setTimezone: (val: string) => void;
  onSaveSettings: (updates: any) => Promise<void>;
  // UI preferences (local states / mock for now, stored in localStorage or local state)
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
  desktopNotifications: boolean;
  setDesktopNotifications: (val: boolean) => void;
  is24Hour: boolean;
  setIs24Hour: (val: boolean) => void;
  autoOpenAgenda: boolean;
  setAutoOpenAgenda: (val: boolean) => void;
}

export default function GeneralSettings({
  isDarkMode,
  onToggleTheme,
  morningBrief,
  setMorningBrief,
  nightReflection,
  setNightReflection,
  timezone,
  setTimezone,
  onSaveSettings,
  reduceMotion,
  setReduceMotion,
  desktopNotifications,
  setDesktopNotifications,
  is24Hour,
  setIs24Hour,
  autoOpenAgenda,
  setAutoOpenAgenda,
}: GeneralSettingsProps) {
  const timezones = [
    "UTC",
    "Asia/Kolkata",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Tokyo",
  ];

  const handleToggleMorningBrief = (val: boolean) => {
    setMorningBrief(val);
    onSaveSettings({ briefSettings: { morningBriefEnabled: val } });
  };

  const handleToggleNightReflection = (val: boolean) => {
    setNightReflection(val);
    onSaveSettings({ briefSettings: { eveningBriefEnabled: val } });
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tz = e.target.value;
    setTimezone(tz);
    onSaveSettings({ briefSettings: { timezone: tz } });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl animate-in fade-in duration-200">
      <SectionHeader
        title="Personal Preferences"
        description="Configure your visual rhythm, alerts, and calendar timezone alignments."
      />

      {/* Theme Section */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Dark Mode
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Switch between light and dark aesthetics.
          </span>
        </div>
        <Toggle checked={isDarkMode} onChange={onToggleTheme} />
      </div>

      {/* 12/24 hour clock */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            24-Hour Time Format
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Display time blocks and suggestions in 24-hour style.
          </span>
        </div>
        <Toggle checked={is24Hour} onChange={setIs24Hour} />
      </div>

      {/* Timezone */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Primary Timezone
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Align agenda generation and daily resets.
          </span>
        </div>
        <select
          value={timezone}
          onChange={handleTimezoneChange}
          className="bg-secondary/40 border border-border/60 rounded-md font-sans text-xs px-2.5 py-1.5 outline-none focus:border-accent/40"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {/* Reduce Motion */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Reduce Motion
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Disable companion orb and transition animations.
          </span>
        </div>
        <Toggle checked={reduceMotion} onChange={setReduceMotion} />
      </div>

      {/* Desktop Notifications */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Desktop Notifications
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Alert me when upcoming work blocks start.
          </span>
        </div>
        <Toggle checked={desktopNotifications} onChange={setDesktopNotifications} />
      </div>

      {/* Email: Morning Brief */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Morning Briefing Email
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Receive a daily focus roadmap at 7:00 AM.
          </span>
        </div>
        <Toggle checked={morningBrief} onChange={handleToggleMorningBrief} />
      </div>

      {/* Email: Evening Reflection */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Nightly Reflection Reminder
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Receive a review email at 9:00 PM to log daily wins.
          </span>
        </div>
        <Toggle checked={nightReflection} onChange={handleToggleNightReflection} />
      </div>

      {/* Auto-open today's agenda */}
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs font-semibold text-foreground">
            Auto-open Today's Agenda
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            Automatically expand today's agenda on startup.
          </span>
        </div>
        <Toggle checked={autoOpenAgenda} onChange={setAutoOpenAgenda} />
      </div>
    </div>
  );
}
