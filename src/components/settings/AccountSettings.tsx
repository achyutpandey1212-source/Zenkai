"use client";

import React, { useState } from "react";
import SectionHeader from "./SectionHeader";
import SettingsCard from "./SettingsCard";

interface AccountSettingsProps {
  userEmail: string;
  userName: string;
  signOutLoading: boolean;
  onSignOut: () => Promise<void>;
  onSaveSettings: (updates: any) => Promise<void>;
}

export default function AccountSettings({
  userEmail,
  userName,
  signOutLoading,
  onSignOut,
  onSaveSettings,
}: AccountSettingsProps) {
  const [name, setName] = useState(userName);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setUpdating(true);
    try {
      // Fire name update call to user endpoint
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      if (res.ok) {
        setIsEditing(false);
        // Fire updates callback or rely on user updating parent states
        await onSaveSettings({ name: name.trim() });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const handleExportData = () => {
    alert("Preparing your data archive... You will receive a secure download link shortly. (Mock event)");
  };

  const handleDeleteMemories = () => {
    if (confirm("Are you absolutely sure you want to delete all historical memories? Zenkai will lose all learned traits and custom context. This cannot be undone.")) {
      alert("Memories purged successfully. (Mock event)");
    }
  };

  const handleDeleteAccount = () => {
    if (confirm("WARNING: This will permanently delete your Zenkai account and all database records. Do you wish to continue?")) {
      alert("Account deletion initiated. (Mock event)");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-xl animate-in fade-in duration-200">
      <SectionHeader
        title="Account Parameters"
        description="Manage your profile settings, data archives, and deletion preferences."
      />

      {/* Account Info Card */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          General Details
        </span>

        <SettingsCard className="space-y-4">
          <div className="flex flex-col gap-1 border-b border-border/20 pb-3">
            <span className="font-sans text-[10px] text-muted-foreground uppercase font-medium">Email Address</span>
            <span className="font-sans text-xs text-foreground font-semibold">{userEmail || "No email available"}</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-sans text-[10px] text-muted-foreground uppercase font-medium">Display Name</span>
            {!isEditing ? (
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs text-foreground font-semibold">{name || "User"}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="font-sans text-[10px] text-accent hover:text-accent/80 font-semibold uppercase cursor-pointer"
                >
                  Edit Name
                </button>
              </div>
            ) : (
              <form onSubmit={handleUpdateName} className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  className="flex-1 bg-secondary/40 border border-border/60 rounded-md font-sans text-xs px-2.5 py-1.5 outline-none focus:border-accent/40 text-foreground"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-accent hover:bg-accent/85 disabled:opacity-50 text-white rounded-md text-[10px] font-sans px-3 font-semibold uppercase cursor-pointer"
                >
                  {updating ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setName(userName);
                    setIsEditing(false);
                  }}
                  className="border border-border/80 hover:bg-secondary/40 text-muted-foreground rounded-md text-[10px] font-sans px-3 font-semibold uppercase cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </SettingsCard>
      </div>

      {/* Account actions */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Data Export & Logouts
        </span>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={onSignOut}
            disabled={signOutLoading}
            className="flex-1 py-2.5 px-4 rounded-lg font-sans text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 cursor-pointer disabled:opacity-50 uppercase tracking-wider"
          >
            {signOutLoading ? "Signing Out..." : "Sign Out"}
          </button>
          <button
            type="button"
            onClick={handleExportData}
            className="flex-1 py-2.5 px-4 rounded-lg font-sans text-[11px] font-semibold border border-border/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer uppercase tracking-wider"
          >
            Export My Data
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4 pt-4 border-t border-border/20">
        <span className="font-sans text-[10px] tracking-[0.2em] text-red-500 font-bold uppercase block select-none">
          Danger Zone
        </span>

        <div className="border border-red-500/25 bg-red-500/5 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-red-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-xs font-semibold text-foreground">Delete Historical Memories</span>
              <span className="font-sans text-[10px] text-muted-foreground">Purges all learned psychology, traits, and context.</span>
            </div>
            <button
              onClick={handleDeleteMemories}
              className="py-1.5 px-3 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-[10px] font-sans font-semibold transition cursor-pointer uppercase"
            >
              Delete Memories
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-xs font-semibold text-foreground">Delete Zenkai Account</span>
              <span className="font-sans text-[10px] text-muted-foreground">Permanently delete account, roadmap goals, and preferences.</span>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="py-1.5 px-3 rounded bg-red-500/15 hover:bg-red-600 hover:text-white text-red-500 text-[10px] font-sans font-semibold transition cursor-pointer uppercase"
            >
              Delete Account
            </button>
          </div>
        </div>
        <p className="font-sans text-[9px] text-muted-foreground text-center select-none leading-relaxed">
          Zenkai stores memory using local and MongoDB layers. Deleting memory or your account is permanent and cannot be undone.
        </p>
      </div>
    </div>
  );
}
