"use client";

import React, { useState, useEffect } from "react";
import { Shield, Sparkles, Bell, Calendar, Link2, Unlink, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Settings() {
  const [autonomy, setAutonomy] = useState<"minimal" | "balanced" | "proactive">("balanced");
  const [commStyle, setCommStyle] = useState<"quiet" | "direct" | "collaborative">("collaborative");
  
  // Settings loaded from MongoDB
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [morningBrief, setMorningBrief] = useState(true);
  const [nightReflection, setNightReflection] = useState(true);
  const [timezone, setTimezone] = useState("UTC");
  
  // Google Calendar Integration states
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState("");
  const [lastSync, setLastSync] = useState<string>("");
  const [syncedCount, setSyncedCount] = useState(0);
  const [syncHealth, setSyncHealth] = useState<"healthy" | "reconnect_required">("healthy");
  const [syncPending, setSyncPending] = useState(false);

  const [syncNewTasks, setSyncNewTasks] = useState(true);
  const [updateTasks, setUpdateTasks] = useState(true);
  const [deleteTasksAutomatically, setDeleteTasksAutomatically] = useState(false);

  // Lists for conflict and deletion prompts
  const [disappearedTasks, setDisappearedTasks] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);

  // Action states
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch all user settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          const bs = data.settings.briefSettings;
          const cs = data.settings.googleCalendarSettings;

          setMorningBrief(bs.morningBriefEnabled);
          setNightReflection(bs.eveningBriefEnabled);
          setTimezone(bs.timezone || "UTC");

          setCalendarConnected(cs.connected);
          setCalendarEmail(cs.email || "");
          setSyncedCount(cs.syncedEventsCount || 0);
          setSyncHealth(cs.syncHealth || "healthy");
          setSyncPending(cs.calendarSyncPending || false);

          setSyncNewTasks(cs.syncNewTasks);
          setUpdateTasks(cs.updateTasks);
          setDeleteTasksAutomatically(cs.deleteTasksAutomatically);

          if (cs.lastSuccessfulSync) {
            const timeDiff = Date.now() - new Date(cs.lastSuccessfulSync).getTime();
            const minsAgo = Math.floor(timeDiff / 60000);
            if (minsAgo < 1) setLastSync("Just now");
            else if (minsAgo === 1) setLastSync("1 minute ago");
            else if (minsAgo < 60) setLastSync(`${minsAgo} minutes ago`);
            else setLastSync(new Date(cs.lastSuccessfulSync).toLocaleString());
          } else {
            setLastSync("Never synced");
          }
        }
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setSettingsLoaded(true);
    }
  };

  // Fetch disappeared tasks
  const fetchDisappearedTasks = async () => {
    try {
      const res = await fetch("/api/user/calendar/disappeared-tasks");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDisappearedTasks(data.tasks || []);
        }
      }
    } catch (err) {
      console.error("Error loading disappeared tasks:", err);
    }
  };

  // Fetch conflicted tasks
  const fetchConflicts = async () => {
    try {
      const res = await fetch("/api/user/calendar/conflicts");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConflicts(data.conflicts || []);
        }
      }
    } catch (err) {
      console.error("Error loading conflicts:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchDisappearedTasks();
    fetchConflicts();
  }, []);

  // Save general and automation settings
  const handleSaveSettings = async (updates: any) => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Sync state back
          fetchSettings();
        }
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await signOut(auth);
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setSignOutLoading(false);
    }
  };

  // Connect Google Calendar
  const handleConnectCalendar = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          // Redirect user to OAuth authorize page (mock or real)
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Failed to fetch Google OAuth URL:", err);
    }
  };

  // Disconnect Google Calendar
  const handleDisconnectCalendar = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar integration?")) return;
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      if (res.ok) {
        setCalendarConnected(false);
        setCalendarEmail("");
        setSyncedCount(0);
        setLastSync("Never synced");
        setSyncHealth("healthy");
        alert("Google Calendar successfully disconnected.");
        fetchSettings();
        fetchDisappearedTasks();
        fetchConflicts();
      }
    } catch (err) {
      console.error("Failed to disconnect calendar:", err);
    }
  };

  // Trigger manual synchronization
  const handleSyncNow = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch("/api/auth/google/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Calendar synced successfully!\nCreated: ${data.stats.eventsCreated}\nUpdated: ${data.stats.eventsUpdated}\nDeleted: ${data.stats.eventsDeleted}\nSkipped: ${data.stats.eventsSkipped}`);
        fetchSettings();
        fetchDisappearedTasks();
        fetchConflicts();
      } else {
        alert(`Calendar sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error triggering sync:", err);
      alert("Network error triggering calendar sync.");
    } finally {
      setSyncingCalendar(false);
    }
  };

  // Delete disappeared task manually
  const handleDeleteDisappeared = async (taskId: string) => {
    try {
      const res = await fetch("/api/user/calendar/delete-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      if (res.ok) {
        // Refresh disappeared lists
        fetchDisappearedTasks();
        fetchSettings();
      }
    } catch (err) {
      console.error("Failed to delete event manually:", err);
    }
  };

  // Resolve task conflict
  const handleResolveConflict = async (taskId: string, resolution: "keep_google" | "replace_with_zenkai") => {
    try {
      const res = await fetch("/api/user/calendar/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, resolution })
      });
      if (res.ok) {
        // Refresh conflicts list
        fetchConflicts();
        fetchSettings();
      }
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-8 md:p-16 flex flex-col items-center bg-background">
      
      <div className="max-w-2xl w-full flex flex-col gap-12 mt-8 pb-16">
        
        {/* Header Section */}
        <header className="flex flex-col gap-3">
          <span className="font-sans text-xs tracking-[0.25em] text-accent font-semibold uppercase">
            Control Panel
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground">
            Settings
          </h1>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Customize Zenkai's behavior, communication style, notifications, and external integrations.
          </p>
        </header>

        {/* Companion Settings */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent" />
            Companion Parameters
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-6">
            
            {/* Autonomy Level */}
            <div className="space-y-3">
              <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
                Autonomy Preference
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {(["minimal", "balanced", "proactive"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAutonomy(level)}
                    className={`py-3 px-4 rounded-lg font-sans text-xs font-medium border capitalize transition-all duration-200 ${
                      autonomy === level
                        ? "bg-primary border-primary text-primary-foreground shadow"
                        : "border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
                {autonomy === "minimal" && "Zenkai only acts on direct requests."}
                {autonomy === "balanced" && "Zenkai proactively suggests daily schedules and highlights potential clashes."}
                {autonomy === "proactive" && "Zenkai automatically reschedules conflicting items and checks in frequently."}
              </p>
            </div>

            {/* Communication Style */}
            <div className="space-y-3">
              <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
                Communication Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {(["quiet", "direct", "collaborative"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setCommStyle(style)}
                    className={`py-3 px-4 rounded-lg font-sans text-xs font-medium border capitalize transition-all duration-200 ${
                      commStyle === style
                        ? "bg-primary border-primary text-primary-foreground shadow"
                        : "border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Google Calendar Integration */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Calendar size={12} className="text-accent" />
            Integrations
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent">
                  <Calendar size={22} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-sm font-semibold text-foreground">
                    Google Calendar
                  </span>
                  <span className="font-sans text-[10px] text-muted-foreground leading-relaxed max-w-sm">
                    {calendarConnected 
                      ? `Projecting your roadmap to Google Calendar. Connected as ${calendarEmail}`
                      : "Mirror scheduled Zenkai tasks to your Google Calendar. Zenkai handles scheduling; Google Calendar tracks your time."
                    }
                  </span>
                </div>
              </div>

              {!calendarConnected ? (
                <button
                  type="button"
                  onClick={handleConnectCalendar}
                  className="py-2 px-4 rounded-lg font-sans text-xs font-semibold bg-accent text-white hover:bg-accent/80 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Link2 size={13} />
                  Connect Google Calendar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncNow}
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
                    onClick={handleDisconnectCalendar}
                    className="py-2 px-3 rounded-lg font-sans text-xs font-medium border border-red-500/20 hover:bg-red-500/10 text-red-500 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Unlink size={12} />
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {calendarConnected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Integration Details */}
                <div className="space-y-4">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold block">
                    Sync Status & Health
                  </span>
                  <div className="bg-secondary/20 border border-border/30 p-4 rounded-lg space-y-3 font-sans text-xs">
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
                <div className="space-y-4">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold block">
                    Automation Parameters
                  </span>
                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncNewTasks}
                        onChange={(e) => {
                          setSyncNewTasks(e.target.checked);
                          handleSaveSettings({ googleCalendarSettings: { syncNewTasks: e.target.checked } });
                        }}
                        className="mt-0.5 rounded border-border"
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
                          handleSaveSettings({ googleCalendarSettings: { updateTasks: e.target.checked } });
                        }}
                        className="mt-0.5 rounded border-border"
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
                          handleSaveSettings({ googleCalendarSettings: { deleteTasksAutomatically: e.target.checked } });
                        }}
                        className="mt-0.5 rounded border-border"
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
            {conflicts.length > 0 && (
              <div className="border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl space-y-3">
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
                          onClick={() => handleResolveConflict(task._id, "keep_google")}
                          className="px-3 py-1 rounded bg-secondary hover:bg-secondary-foreground hover:text-secondary text-[9px] font-sans font-semibold transition"
                        >
                          Keep Google Version
                        </button>
                        <button
                          onClick={() => handleResolveConflict(task._id, "replace_with_zenkai")}
                          className="px-3 py-1 rounded bg-accent/20 hover:bg-accent text-accent hover:text-white text-[9px] font-sans font-semibold transition"
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
            {disappearedTasks.length > 0 && (
              <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-xl space-y-3">
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
                        onClick={() => handleDeleteDisappeared(task._id)}
                        className="px-3 py-1 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-[9px] font-sans font-semibold transition cursor-pointer"
                      >
                        Remove Event
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notifications (Email-based) */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Bell size={12} className="text-accent" />
            Notifications & Digests
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-4">
            
            {/* Morning Brief */}
            <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 last:pb-0">
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-xs font-semibold text-foreground tracking-wide">
                  Morning Briefing Email
                </span>
                <span className="font-sans text-[10px] text-muted-foreground">
                  Receive a daily focus roadmap at 7:00 AM.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMorningBrief(!morningBrief);
                  handleSaveSettings({ briefSettings: { morningBriefEnabled: !morningBrief } });
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  morningBrief ? "bg-accent" : "bg-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    morningBrief ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Night Reflection */}
            <div className="flex items-center justify-between py-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-xs font-semibold text-foreground tracking-wide">
                  Nightly Reflection Reminder
                </span>
                <span className="font-sans text-[10px] text-muted-foreground">
                  Receive a review email at 9:00 PM to log daily wins.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNightReflection(!nightReflection);
                  handleSaveSettings({ briefSettings: { eveningBriefEnabled: !nightReflection } });
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  nightReflection ? "bg-accent" : "bg-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    nightReflection ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

          </div>
        </section>

        {/* Privacy & Account Controls */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Shield size={12} className="text-accent" />
            Privacy & Account
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signOutLoading}
                className="flex-1 py-3 px-4 rounded-lg font-sans text-xs font-semibold border border-transparent bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {signOutLoading ? "Signing Out..." : "Sign Out"}
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-lg font-sans text-xs font-medium border border-border/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
              >
                Export My Data
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-lg font-sans text-xs font-medium border border-red-500/20 dark:border-red-500/40 hover:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 dark:shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:text-red-700 transition-all duration-200 cursor-pointer"
              >
                Delete Memories
              </button>
            </div>
            <p className="font-sans text-[9px] text-muted-foreground text-center">
              Zenkai stores memory using local and mongoDB layers. Deleting memory cannot be undone.
            </p>
          </div>
        </section>

      </div>

    </div>
  );
}
