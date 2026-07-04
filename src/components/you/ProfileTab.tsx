"use client";

import React, { useState } from "react";
import { User, Clock, Compass, Activity, ShieldAlert, Sparkles, X, Edit3, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { IProfile } from "@/models/Profile";

// Onboarding form imports
import IdentityForm, { IdentityFormValues } from "../profile/IdentityForm";
import RoutineForm, { RoutineFormValues } from "../profile/RoutineForm";
import GoalsForm, { GoalItem } from "../profile/GoalsForm";
import ChallengesForm from "../profile/ChallengesForm";
import FocusForm, { FocusFormValues } from "../profile/FocusForm";
import { IDENTITY_OPTIONS } from "@/config/onboarding-options";

interface ProfileTabProps {
  profile: IProfile | null;
  onUpdate: (updatedFields: Partial<IProfile>) => Promise<void>;
}

export default function ProfileTab({ profile, onUpdate }: ProfileTabProps) {
  const [editingSection, setEditingSection] = useState<
    "identity" | "routine" | "goals" | "challenges" | "focus" | null
  >(null);

  const [saving, setSaving] = useState(false);

  // Temporary edit states
  const [tempIdentity, setTempIdentity] = useState<IdentityFormValues>({
    primaryIdentity: "",
    country: "India",
    state: "",
    branchContext: {},
  });

  const [tempRoutine, setTempRoutine] = useState<RoutineFormValues>({
    wakeTime: "06:00",
    sleepTime: "23:00",
    deepWorkTime: "Morning",
    dailyAvailability: "2-4 Hours",
  });

  const [tempGoals, setTempGoals] = useState<GoalItem[]>([]);
  const [tempChallenges, setTempChallenges] = useState<string[]>([]);
  
  const [tempFocus, setTempFocus] = useState<FocusFormValues>({
    schedulingStyle: "Balanced",
    focusDuration: 45,
  });

  // Open editor and fill temp states
  const handleOpenEdit = (section: typeof editingSection) => {
    if (!profile) return;
    setEditingSection(section);

    if (section === "identity") {
      setTempIdentity({
        primaryIdentity: profile.primaryIdentity || "",
        country: profile.country || "India",
        state: profile.state || "",
        branchContext: profile.branchContext || {},
      });
    } else if (section === "routine") {
      // Map availability hours back to option text if possible
      const mapHoursToOption = (hrs: string) => {
        if (hrs === "1.0") return "Less than 1 hour";
        if (hrs === "2.0") return "1-2 Hours";
        if (hrs === "4.0") return "2-4 Hours";
        if (hrs === "6.0") return "4-6 Hours";
        if (hrs === "8.0") return "6+ Hours";
        return "2-4 Hours";
      };
      setTempRoutine({
        wakeTime: profile.wakeUpTime || "06:00",
        sleepTime: profile.sleepTime || "23:00",
        deepWorkTime: profile.deepWorkTime || "Morning",
        dailyAvailability: mapHoursToOption(profile.dailyAvailability || "4.0"),
      });
    } else if (section === "goals") {
      setTempGoals(profile.goals || []);
    } else if (section === "challenges") {
      setTempChallenges(profile.productivityChallenges || []);
    } else if (section === "focus") {
      setTempFocus({
        schedulingStyle: profile.schedulingStyle || "Balanced",
        focusDuration: profile.focusDuration || 45,
      });
    }
  };

  // Map hours before save
  const mapAvailabilityToHours = (avail: string) => {
    switch (avail) {
      case "Less than 1 hour": return "1.0";
      case "1-2 Hours": return "2.0";
      case "2-4 Hours": return "4.0";
      case "4-6 Hours": return "6.0";
      case "6+ Hours": return "8.0";
      default: return "8.0";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingSection === "identity") {
        await onUpdate({
          primaryIdentity: tempIdentity.primaryIdentity,
          country: tempIdentity.country,
          state: tempIdentity.state,
          branchContext: tempIdentity.branchContext,
        });
      } else if (editingSection === "routine") {
        await onUpdate({
          wakeUpTime: tempRoutine.wakeTime,
          sleepTime: tempRoutine.sleepTime,
          deepWorkTime: tempRoutine.deepWorkTime,
          dailyAvailability: mapAvailabilityToHours(tempRoutine.dailyAvailability),
        });
      } else if (editingSection === "goals") {
        await onUpdate({
          goals: tempGoals,
        });
      } else if (editingSection === "challenges") {
        await onUpdate({
          productivityChallenges: tempChallenges,
        });
      } else if (editingSection === "focus") {
        await onUpdate({
          schedulingStyle: tempFocus.schedulingStyle,
          focusDuration: tempFocus.focusDuration,
        });
      }
      setEditingSection(null);
    } catch (e) {
      console.error("Save profile error:", e);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "Not set";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      
      {/* Cards list summary of profile sections (Apple Health style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        
        {/* Section 1: Identity Card */}
        <div className="bg-card border border-border/75 rounded-3xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-accent">
                <User size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Identity Details</span>
              </div>
              <button
                onClick={() => handleOpenEdit("identity")}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Primary Identity</span>
                <span className="font-semibold text-foreground capitalize">
                  {IDENTITY_OPTIONS.find((o) => o.id === profile?.primaryIdentity)?.label || profile?.primaryIdentity || "Not configured"}
                </span>
              </div>
              {profile?.branchContext && Object.keys(profile.branchContext).length > 0 && (
                <div className="space-y-1.5 border-b border-border/40 pb-2">
                  <span className="text-muted-foreground block">Branch Information</span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.entries(profile.branchContext).map(([k, v]) => (
                      <span key={k} className="bg-secondary/40 border border-border/60 px-2 py-0.5 rounded-lg text-[10px] font-medium text-foreground">
                        <span className="text-muted-foreground mr-1 capitalize">{k}:</span>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Location</span>
                <span className="font-semibold text-foreground">{profile?.country || "Not specified"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Routine rhythm Card */}
        <div className="bg-card border border-border/75 rounded-3xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-accent">
                <Clock size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Sleep & Schedule</span>
              </div>
              <button
                onClick={() => handleOpenEdit("routine")}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Sleep Time</span>
                <span className="font-semibold text-foreground">{formatTime(profile?.sleepTime)}</span>
              </div>
              <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Wake Up Time</span>
                <span className="font-semibold text-foreground">{formatTime(profile?.wakeUpTime)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Daily Availability</span>
                <span className="font-semibold text-foreground">
                  {profile?.dailyAvailability ? `${profile.dailyAvailability} hrs` : "Not specified"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Goals Card */}
        <div className="bg-card border border-border/75 rounded-3xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-accent">
                <Activity size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Active Milestones</span>
              </div>
              <button
                onClick={() => handleOpenEdit("goals")}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
            <div className="space-y-2 font-sans text-xs">
              {profile?.goals && profile.goals.length > 0 ? (
                profile.goals.map((g, idx) => (
                  <div key={idx} className="flex justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <span className="text-foreground font-semibold">{g.title}</span>
                    <span className="text-[10px] text-accent font-bold">Priority {g.priority}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground py-2">No active goals configured.</div>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Challenges Card */}
        <div className="bg-card border border-border/75 rounded-3xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-300">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-accent">
                <ShieldAlert size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Productivity Obstacles</span>
              </div>
              <button
                onClick={() => handleOpenEdit("challenges")}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
            {profile?.productivityChallenges && profile.productivityChallenges.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile.productivityChallenges.map((challenge, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-semibold"
                  >
                    {challenge}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/60 py-2">
                No distractions configured.
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Focus style Card */}
        <div className="bg-card border border-border/75 rounded-3xl p-6 flex flex-col justify-between hover:shadow-sm transition-all duration-300 md:col-span-2">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-accent">
                <Compass size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Focus Preferences</span>
              </div>
              <button
                onClick={() => handleOpenEdit("focus")}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Planning Autonomy Style</span>
                <span className="font-semibold text-foreground">{profile?.schedulingStyle || "Balanced"}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Focus Window Duration</span>
                <span className="font-semibold text-foreground">{profile?.focusDuration || 45} minutes</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Editor slide-up overlay/drawer modal */}
      {editingSection !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-border/45 pb-4">
              <div className="flex items-center gap-2 text-accent font-bold">
                <Sparkles size={16} />
                <span className="text-xs uppercase tracking-wider capitalize">
                  Edit {editingSection}
                </span>
              </div>
              <button
                onClick={() => setEditingSection(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable forms viewport */}
            <div className="flex-1 overflow-y-auto pr-1 py-2 scrollbar-none">
              {editingSection === "identity" && (
                <IdentityForm value={tempIdentity} onChange={setTempIdentity} />
              )}
              {editingSection === "routine" && (
                <RoutineForm value={tempRoutine} onChange={setTempRoutine} />
              )}
              {editingSection === "goals" && (
                <GoalsForm value={tempGoals} onChange={setTempGoals} />
              )}
              {editingSection === "challenges" && (
                <ChallengesForm value={tempChallenges} onChange={setTempChallenges} />
              )}
              {editingSection === "focus" && (
                <FocusForm value={tempFocus} onChange={setTempFocus} />
              )}
            </div>

            {/* Bottom action buttons */}
            <div className="flex gap-3.5 border-t border-border/45 pt-4">
              <button
                onClick={() => setEditingSection(null)}
                className="flex-1 py-3 border border-border hover:bg-secondary/40 rounded-xl text-xs font-semibold uppercase tracking-wider font-sans cursor-pointer transition-colors text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-primary hover:bg-accent text-primary-foreground hover:text-accent-foreground rounded-xl text-xs font-semibold uppercase tracking-wider font-sans cursor-pointer transition-colors flex items-center justify-center gap-1 text-center"
              >
                <Save size={14} />
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
