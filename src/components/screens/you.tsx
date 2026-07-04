"use client";

import React, { useState, useEffect } from "react";
import { User, Clock, Compass, Activity, Brain, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { IProfile } from "@/models/Profile";

import OverviewTab from "../you/OverviewTab";
import ProfileTab from "../you/ProfileTab";
import IdentityTab from "../you/IdentityTab";
import ReflectionTab from "../you/ReflectionTab";

interface YouProps {
  userName: string;
  initialTab?: "overview" | "profile" | "identity" | "reflection";
  onNavigate?: (screen: any) => void;
}

export default function You({ userName, initialTab = "overview", onNavigate }: YouProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "profile" | "identity" | "reflection">(initialTab);
  const [profile, setProfile] = useState<IProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestTrait, setLatestTrait] = useState<{ trait: string; reason: string } | null>(null);
  const [latestReflection, setLatestReflection] = useState<{ title: string; summary: string } | null>(null);

  // Sync tab state when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          setProfile(data.profile);
        }
      }
    } catch (e) {
      console.error("Failed to fetch user profile inside You screen:", e);
    }
  };

  const fetchEvolvingInsights = async () => {
    try {
      // 1. Fetch Trait Preview
      const traitRes = await fetch("/api/identity");
      if (traitRes.ok) {
        const data = await traitRes.json();
        if (data.success && data.profile) {
          const core = data.profile.coreIdentity || [];
          const candidate = data.profile.emergingTraits || [];
          if (core.length > 0) {
            const sortedCore = [...core].sort((a, b) => b.confidence - a.confidence);
            setLatestTrait({ trait: sortedCore[0].trait, reason: sortedCore[0].description });
          } else if (candidate.length > 0) {
            setLatestTrait({ trait: candidate[0].trait, reason: candidate[0].description });
          }
        }
      }

      // 2. Fetch Reflection Preview
      const refRes = await fetch("/api/reflections");
      if (refRes.ok) {
        const data = await refRes.json();
        if (data.success && data.activeReflections && data.activeReflections.length > 0) {
          const sortedRef = [...data.activeReflections].sort((a, b) => b.confidence - a.confidence);
          setLatestReflection({ title: sortedRef[0].title, summary: sortedRef[0].summary });
        }
      }
    } catch (e) {
      console.error("Failed to load evolving insights preview:", e);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchEvolvingInsights()]);
      setLoading(false);
    };
    initData();
  }, []);

  const handleUpdateProfile = async (updatedFields: Partial<IProfile>) => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProfile(data.profile);
        }
      }
    } catch (e) {
      console.error("Failed to update profile:", e);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-sans text-xs tracking-wider text-muted-foreground uppercase">
            Loading your digital twin...
          </span>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "profile" as const, label: "Profile" },
    { id: "identity" as const, label: "Identity" },
    { id: "reflection" as const, label: "Reflections" },
  ];

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 lg:p-16 flex flex-col items-center bg-background scrollbar-none">
      <div className="max-w-4xl w-full flex flex-col gap-8 mt-4 pb-20">
        
        {/* Style block to completely hide scrollbar tracks */}
        <style dangerouslySetInnerHTML={{ __html: `
          ::-webkit-scrollbar {
            display: none !important;
          }
          * {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
        `}} />

        {/* You Hub Header */}
        <header className="flex flex-col gap-2 text-left">
          <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
            Personal Blueprint
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground tracking-wide">
            You
          </h1>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            Everything Zen Kai understands about your rhythm, core traits, and behavior.
          </p>
        </header>

        {/* Tab Selection Header bar */}
        <div className="flex border-b border-border/45 gap-1 text-xs select-none overflow-x-auto whitespace-nowrap scrollbar-none py-1 w-full max-w-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 font-sans font-semibold border-b-2 tracking-wider uppercase transition-all duration-200 cursor-pointer outline-none inline-block whitespace-nowrap shrink-0",
                  isActive
                    ? "border-accent text-foreground font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents Viewport */}
        <div className="w-full">
          {activeTab === "overview" && (
            <OverviewTab
              profile={profile}
              latestTrait={latestTrait}
              latestReflection={latestReflection}
              onSwitchTab={setActiveTab}
            />
          )}
          {activeTab === "profile" && (
            <ProfileTab profile={profile} onUpdate={handleUpdateProfile} />
          )}
          {activeTab === "identity" && <IdentityTab />}
          {activeTab === "reflection" && <ReflectionTab userName={userName} />}
        </div>

      </div>
    </div>
  );
}
