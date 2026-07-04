"use client";

import React from "react";
import Image from "next/image";
import { RefreshCw, Loader2, Link2, Unlink, AlertCircle, CheckCircle2 } from "lucide-react";
import SectionHeader from "./SectionHeader";
import SettingsCard from "./SettingsCard";

interface IntegrationsSettingsProps {
  // Google Calendar Integration states
  calendarConnected: boolean;
  calendarEmail: string;
  lastSync: string;
  syncedCount: number;
  syncHealth: "healthy" | "reconnect_required";
  syncPending: boolean;
  syncingCalendar: boolean;
  
  syncNewTasks: boolean;
  setSyncNewTasks: (val: boolean) => void;
  updateTasks: boolean;
  setUpdateTasks: (val: boolean) => void;
  deleteTasksAutomatically: boolean;
  setDeleteTasksAutomatically: (val: boolean) => void;

  disappearedTasks: any[];
  conflicts: any[];

  // Action Handlers
  onConnectCalendar: () => Promise<void>;
  onDisconnectCalendar: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onDeleteDisappeared: (taskId: string) => Promise<void>;
  onResolveConflict: (taskId: string, resolution: "keep_google" | "replace_with_zenkai") => Promise<void>;
  onSaveSettings: (updates: any) => Promise<void>;
}

export default function IntegrationsSettings({
  calendarConnected,
  calendarEmail,
  lastSync,
  syncedCount,
  syncHealth,
  syncPending,
  syncingCalendar,
  syncNewTasks,
  setSyncNewTasks,
  updateTasks,
  setUpdateTasks,
  deleteTasksAutomatically,
  setDeleteTasksAutomatically,
  disappearedTasks,
  conflicts,
  onConnectCalendar,
  onDisconnectCalendar,
  onSyncNow,
  onDeleteDisappeared,
  onResolveConflict,
  onSaveSettings,
}: IntegrationsSettingsProps) {

  // List of other upcoming integrations
  const upcomingIntegrations = [
    { name: "Notion", icon: "notion.svg", monochrome: false },
    { name: "GitHub", icon: "github.svg", monochrome: true },
    { name: "Gmail", icon: "gmail.svg", monochrome: false },
    { name: "Google Tasks", icon: "google-calendar.svg", monochrome: false },
    { name: "Google Drive", icon: "google-calendar.svg", monochrome: false },
    { name: "Spotify", icon: "spotify.svg", monochrome: false },
    { name: "Slack", icon: "slack.svg", monochrome: false },
    { name: "Discord", icon: "discord.svg", monochrome: false },
    { name: "Apple Calendar", icon: "browser.svg", monochrome: true },
    { name: "Apple Reminders", icon: "browser.svg", monochrome: true },
    { name: "Linear", icon: "browser.svg", monochrome: true },
    { name: "ClickUp", icon: "browser.svg", monochrome: true },
    { name: "Todoist", icon: "todoist.svg", monochrome: false },
    { name: "Obsidian", icon: "obsidian.svg", monochrome: true },
    // MCPs
    { name: "Claude MCP", icon: "claude.svg", monochrome: true },
    { name: "Sequential Thinking MCP", icon: "browser.svg", monochrome: true },
    { name: "Filesystem MCP", icon: "browser.svg", monochrome: true },
    { name: "Memory MCP", icon: "browser.svg", monochrome: true },
    { name: "Browser MCP", icon: "browser.svg", monochrome: true },
    { name: "Playwright MCP", icon: "browser.svg", monochrome: true },
    { name: "GitHub MCP", icon: "github.svg", monochrome: true },
    { name: "Brave Search MCP", icon: "browser.svg", monochrome: true },
  ];

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl animate-in fade-in duration-200">
      <SectionHeader
        title="MCPs & Integrations"
        description="Connect Zen with the tools and servers you already use to orchestrate your workflow."
      />

      {/* Google Calendar Card */}
      <div className="flex flex-col gap-5">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Active Connections
        </span>

        <SettingsCard className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/25 text-accent shrink-0">
                <Image
                  src="/assets/icons/google-calendar.svg"
                  alt="Google Calendar"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-sm font-semibold text-foreground">
                    Google Calendar
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                    calendarConnected 
                      ? "bg-green-500/10 border border-green-500/20 text-green-500" 
                      : "bg-red-500/10 border border-red-500/25 text-red-500"
                  }`}>
                    {calendarConnected ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <span className="font-sans text-[11px] text-muted-foreground leading-relaxed max-w-md">
                  {calendarConnected
                    ? `Projecting roadmap blocks to Google Calendar. Connected as ${calendarEmail}`
                    : "Mirror scheduled Zenkai tasks to your Google Calendar. Zenkai handles scheduling; Google Calendar tracks your time."}
                </span>
              </div>
            </div>

            {!calendarConnected ? (
              <button
                type="button"
                onClick={onConnectCalendar}
                className="py-2 px-4 rounded-lg font-sans text-xs font-semibold bg-accent text-white hover:bg-accent/80 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Link2 size={13} />
                Connect Calendar
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={syncingCalendar}
                  className="py-2 px-3 rounded-lg font-sans text-xs font-medium border border-border/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                >
                  {syncingCalendar ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={onDisconnectCalendar}
                  className="py-2 px-3 rounded-lg font-sans text-xs font-medium border border-red-500/20 hover:bg-red-500/10 text-red-500 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Unlink size={12} />
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {calendarConnected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
              {/* Integration Details */}
              <div className="space-y-3.5">
                <span className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold block select-none">
                  Sync Status & Health
                </span>
                <div className="bg-secondary/20 border border-border/30 p-4 rounded-xl space-y-2.5 font-sans text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Connected Account</span>
                    <span className="font-medium text-foreground">{calendarEmail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sync Health</span>
                    {syncHealth === "healthy" ? (
                      <span className="inline-flex items-center gap-1 text-green-500 font-semibold">
                        <CheckCircle2 size={12} />
                        Healthy
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500 font-semibold animate-pulse">
                        <AlertCircle size={12} />
                        Reconnect Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Successful Sync</span>
                    <span className="font-medium text-foreground">{lastSync}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Synced Events Count</span>
                    <span className="font-semibold text-accent">{syncedCount} tasks</span>
                  </div>
                  {syncPending && (
                    <div className="text-[10px] text-accent/80 flex items-center gap-1 mt-1 border-t border-border/10 pt-2">
                      <Loader2 size={10} className="animate-spin" />
                      Background sync scheduled (debouncing...)
                    </div>
                  )}
                </div>
              </div>

              {/* Automation Rules */}
              <div className="space-y-3.5">
                <span className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold block select-none">
                  Automation Parameters
                </span>
                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncNewTasks}
                      onChange={(e) => {
                        setSyncNewTasks(e.target.checked);
                        onSaveSettings({ googleCalendarSettings: { syncNewTasks: e.target.checked } });
                      }}
                      className="mt-0.5 rounded border-border focus:ring-accent"
                    />
                    <div className="flex flex-col">
                      <span className="font-sans text-xs font-semibold text-foreground/90">Sync New Tasks</span>
                      <span className="font-sans text-[10px] text-muted-foreground">Automatically push newly scheduled tasks.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateTasks}
                      onChange={(e) => {
                        setUpdateTasks(e.target.checked);
                        onSaveSettings({ googleCalendarSettings: { updateTasks: e.target.checked } });
                      }}
                      className="mt-0.5 rounded border-border focus:ring-accent"
                    />
                    <div className="flex flex-col">
                      <span className="font-sans text-xs font-semibold text-foreground/90">Update Existing Tasks</span>
                      <span className="font-sans text-[10px] text-muted-foreground">Reflect date/time changes on existing events.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteTasksAutomatically}
                      onChange={(e) => {
                        setDeleteTasksAutomatically(e.target.checked);
                        onSaveSettings({ googleCalendarSettings: { deleteTasksAutomatically: e.target.checked } });
                      }}
                      className="mt-0.5 rounded border-border focus:ring-accent"
                    />
                    <div className="flex flex-col">
                      <span className="font-sans text-xs font-semibold text-foreground/90">Delete Calendar Events</span>
                      <span className="font-sans text-[10px] text-muted-foreground">Automatically delete calendar events if tasks are removed.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Conflicts Alert Section */}
          {calendarConnected && conflicts.length > 0 && (
            <div className="mt-5 border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl space-y-3 animate-in fade-in">
              <span className="font-sans text-[9px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={12} /> Google Calendar Conflicts Detected
              </span>
              <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
                The following tasks were manually modified on Google Calendar directly. Choose how Zenkai should proceed:
              </p>
              <div className="space-y-3 pt-1">
                {conflicts.map((task) => (
                  <div key={task._id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/10 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-sans text-xs font-semibold text-foreground/90">
                        {task.title}
                      </span>
                      <span className="font-sans text-[10px] text-muted-foreground">
                        Zenkai: {task.suggestedDate} [{task.timeBlock}] | Google: "{task.googleCalendarConflictDetails?.title}" [{new Date(task.googleCalendarConflictDetails?.start).toLocaleString()}]
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onResolveConflict(task._id, "keep_google")}
                        className="px-3 py-1 rounded bg-secondary hover:bg-secondary-foreground hover:text-secondary text-[9px] font-sans font-semibold transition cursor-pointer"
                      >
                        Keep Google Version
                      </button>
                      <button
                        onClick={() => onResolveConflict(task._id, "replace_with_zenkai")}
                        className="px-3 py-1 rounded bg-accent/20 hover:bg-accent text-accent hover:text-white text-[9px] font-sans font-semibold transition cursor-pointer"
                      >
                        Replace with Zenkai
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disappeared Tasks Alert Section */}
          {calendarConnected && disappearedTasks.length > 0 && (
            <div className="mt-5 border border-red-500/20 bg-red-500/5 p-4 rounded-xl space-y-3 animate-in fade-in">
              <span className="font-sans text-[9px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={12} /> Removed Roadmap Tasks
              </span>
              <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
                The following tasks have been removed from your roadmap, but are still present in your Google Calendar:
              </p>
              <div className="space-y-3 pt-1">
                {disappearedTasks.map((task) => (
                  <div key={task._id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/10 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-sans text-xs font-semibold text-foreground/90">
                        {task.title}
                      </span>
                      <span className="font-sans text-[9px] text-muted-foreground">
                        This task was removed from your roadmap. Would you also like me to remove it from Google Calendar?
                      </span>
                    </div>
                    <button
                      onClick={() => onDeleteDisappeared(task._id)}
                      className="px-3 py-1 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-[9px] font-sans font-semibold transition cursor-pointer"
                    >
                      Remove Event
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SettingsCard>
      </div>

      {/* Upcoming / MCP Connections */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Integrations & MCPs
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {upcomingIntegrations.map((item) => (
            <div
              key={item.name}
              className="bg-card/30 border border-border/40 rounded-xl p-4 flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(201,168,106,0.04)] hover:border-accent/20"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-secondary/40 border border-border/30 shrink-0">
                  <Image
                    src={`/assets/icons/${item.icon}`}
                    alt={item.name}
                    width={18}
                    height={18}
                    className={`object-contain ${item.monochrome ? "dark:invert transition-all duration-300" : ""}`}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-sans text-xs font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  <span className="font-sans text-[9px] text-accent/70 font-semibold uppercase tracking-wider">
                    Coming Soon
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="py-1 px-2.5 rounded border border-border text-[9px] font-sans text-muted-foreground/60 font-semibold cursor-not-allowed uppercase"
              >
                Coming Soon
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
