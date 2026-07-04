"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import SettingsSidebar, { SettingsTabType } from "./SettingsSidebar";
import GeneralSettings from "./GeneralSettings";
import CompanionSettings from "./CompanionSettings";
import IntegrationsSettings from "./IntegrationsSettings";
import BillingSettings from "./BillingSettings";
import AccountSettings from "./AccountSettings";
import AboutSettings from "./AboutSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTabType;
  setActiveTab: (tab: SettingsTabType) => void;
  // Theme & User Props
  isDarkMode: boolean;
  onToggleTheme: () => void;
  userName: string;
  userEmail: string;
  onRefreshUser?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  isDarkMode,
  onToggleTheme,
  userName,
  userEmail,
  onRefreshUser,
}: SettingsModalProps) {
  // Companion Preferences
  const [autonomy, setAutonomy] = useState<"minimal" | "balanced" | "proactive">("balanced");
  const [commStyle, setCommStyle] = useState<"quiet" | "direct" | "collaborative" | "balanced">("collaborative");

  // MongoDB Settings
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

  // Local/UI Settings (Cursor styling features)
  const [reduceMotion, setReduceMotion] = useState(false);
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const [autoOpenAgenda, setAutoOpenAgenda] = useState(true);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setReduceMotion(localStorage.getItem("reduce_motion") === "true");
      setDesktopNotifications(localStorage.getItem("desktop_notifications") === "true");
      setIs24Hour(localStorage.getItem("is_24_hour") === "true");
      setAutoOpenAgenda(localStorage.getItem("auto_open_agenda") !== "false");
    }
  }, []);

  const handleSetReduceMotion = (val: boolean) => {
    setReduceMotion(val);
    localStorage.setItem("reduce_motion", String(val));
  };

  const handleSetDesktopNotifications = (val: boolean) => {
    setDesktopNotifications(val);
    localStorage.setItem("desktop_notifications", String(val));
  };

  const handleSetIs24Hour = (val: boolean) => {
    setIs24Hour(val);
    localStorage.setItem("is_24_hour", String(val));
  };

  const handleSetAutoOpenAgenda = (val: boolean) => {
    setAutoOpenAgenda(val);
    localStorage.setItem("auto_open_agenda", String(val));
  };

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

          let tz = bs.timezone || "UTC";
          if (tz === "UTC" || !tz) {
            const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (detectedTz && detectedTz !== "UTC") {
              tz = detectedTz;
              fetch("/api/user/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ briefSettings: { ...bs, timezone: detectedTz } }),
              }).catch((err) => console.error("[Settings] Auto-timezone update failed:", err));
            }
          }
          setTimezone(tz);

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
    if (isOpen) {
      fetchSettings();
      fetchDisappearedTasks();
      fetchConflicts();
    }
  }, [isOpen]);

  const handleSaveSettings = async (updates: any) => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          fetchSettings();
          if (onRefreshUser) {
            onRefreshUser();
          }
        }
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("zenkai_onboarding_draft");
        localStorage.removeItem("has_seen_tour");
        localStorage.removeItem("show_first_draft_card");
      }
      const { signOut: firebaseSignOut } = await import("firebase/auth");
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      await firebaseSignOut(firebaseAuth);
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setSignOutLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Failed to fetch Google OAuth URL:", err);
    }
  };

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

  const handleSyncNow = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch("/api/auth/google/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(
          `Calendar synced successfully!\nCreated: ${data.stats.eventsCreated}\nUpdated: ${data.stats.eventsUpdated}\nDeleted: ${data.stats.eventsDeleted}\nSkipped: ${data.stats.eventsSkipped}`
        );
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

  const handleDeleteDisappeared = async (taskId: string) => {
    try {
      const res = await fetch("/api/user/calendar/delete-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        fetchDisappearedTasks();
        fetchSettings();
      }
    } catch (err) {
      console.error("Failed to delete event manually:", err);
    }
  };

  const handleResolveConflict = async (
    taskId: string,
    resolution: "keep_google" | "replace_with_zenkai"
  ) => {
    try {
      const res = await fetch("/api/user/calendar/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, resolution }),
      });
      if (res.ok) {
        fetchConflicts();
        fetchSettings();
      }
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Main Settings Modal Box */}
      <div className="relative bg-card border border-border/50 max-w-5xl w-[86vw] h-[90vh] max-h-[90vh] rounded-3xl flex flex-col md:flex-row shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors cursor-pointer z-20"
          title="Close Settings"
        >
          <X size={18} />
        </button>

        {/* Left Section: Sidebar navigation inside modal */}
        <div className="p-6 bg-secondary/15 md:w-60 border-b md:border-b-0 md:border-r border-border/40 shrink-0">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Right Section: Scrollable dynamic tab content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 md:px-10 scrollbar-custom relative">
          
          {!settingsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/65 z-30">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-accent" size={24} />
                <span className="font-sans text-[10px] tracking-wider text-muted-foreground uppercase">
                  Loading preferences...
                </span>
              </div>
            </div>
          )}

          <div className="w-full pb-20 md:pb-24">
            {activeTab === "general" && (
              <GeneralSettings
                isDarkMode={isDarkMode}
                onToggleTheme={onToggleTheme}
                morningBrief={morningBrief}
                setMorningBrief={setMorningBrief}
                nightReflection={nightReflection}
                setNightReflection={setNightReflection}
                timezone={timezone}
                setTimezone={setTimezone}
                onSaveSettings={handleSaveSettings}
                reduceMotion={reduceMotion}
                setReduceMotion={handleSetReduceMotion}
                desktopNotifications={desktopNotifications}
                setDesktopNotifications={handleSetDesktopNotifications}
                is24Hour={is24Hour}
                setIs24Hour={handleSetIs24Hour}
                autoOpenAgenda={autoOpenAgenda}
                setAutoOpenAgenda={handleSetAutoOpenAgenda}
              />
            )}

            {activeTab === "companion" && (
              <CompanionSettings
                autonomy={autonomy}
                setAutonomy={(val) => {
                  setAutonomy(val);
                  handleSaveSettings({ briefSettings: { autonomyPreference: val } });
                }}
                commStyle={commStyle}
                setCommStyle={(val) => {
                  setCommStyle(val);
                  handleSaveSettings({ briefSettings: { communicationStyle: val } });
                }}
              />
            )}

            {activeTab === "integrations" && (
              <IntegrationsSettings
                calendarConnected={calendarConnected}
                calendarEmail={calendarEmail}
                lastSync={lastSync}
                syncedCount={syncedCount}
                syncHealth={syncHealth}
                syncPending={syncPending}
                syncingCalendar={syncingCalendar}
                syncNewTasks={syncNewTasks}
                setSyncNewTasks={setSyncNewTasks}
                updateTasks={updateTasks}
                setUpdateTasks={setUpdateTasks}
                deleteTasksAutomatically={deleteTasksAutomatically}
                setDeleteTasksAutomatically={setDeleteTasksAutomatically}
                disappearedTasks={disappearedTasks}
                conflicts={conflicts}
                onConnectCalendar={handleConnectCalendar}
                onDisconnectCalendar={handleDisconnectCalendar}
                onSyncNow={handleSyncNow}
                onDeleteDisappeared={handleDeleteDisappeared}
                onResolveConflict={handleResolveConflict}
                onSaveSettings={handleSaveSettings}
              />
            )}

            {activeTab === "billing" && <BillingSettings />}

            {activeTab === "account" && (
              <AccountSettings
                userEmail={userEmail}
                userName={userName}
                signOutLoading={signOutLoading}
                onSignOut={handleSignOut}
                onSaveSettings={handleSaveSettings}
              />
            )}

            {activeTab === "about" && <AboutSettings />}
          </div>
        </div>

      </div>
    </div>
  );
}
