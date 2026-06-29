"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Search,
  LogOut,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  Users,
  Database,
  Calendar,
  Check
} from "lucide-react";

interface AdminUser {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  googleConnected: boolean;
  activePlan: string;
  memoryCount: number;
}

interface AdminConsoleProps {
  initialAuthenticated: boolean;
}

export default function AdminConsole({ initialAuthenticated }: AdminConsoleProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Dashboard states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Deletion Modal states
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load users when authenticated
  const loadUsers = async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const res = await fetch("/api/internal/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        if (res.status === 401) {
          setAuthenticated(false);
        } else {
          console.error("Failed to load users:", data.error);
        }
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/internal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        router.refresh();
      } else {
        setAuthError(data.error || "Authentication failed.");
      }
    } catch (err: any) {
      setAuthError("Failed to authenticate with server.");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/internal/auth", { method: "DELETE" });
      setAuthenticated(false);
      setUsers([]);
      setPassword("");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || deleteConfirmationText !== "DELETE") return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/internal/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: deletingUser.uid }),
      });
      const data = await res.json();
      if (data.success) {
        // Success
        setDeletingUser(null);
        setDeleteConfirmationText("");
        loadUsers();
      } else {
        setDeleteError(data.error || "Failed to delete user.");
      }
    } catch (err: any) {
      setDeleteError("Network error occurred during user deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUid(text);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const search = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.uid.toLowerCase().includes(search)
      );
    });
  }, [users, searchQuery]);

  const stats = useMemo(() => {
    return {
      totalUsers: users.length,
      activePlans: users.filter((u) => u.activePlan !== "None").length,
      totalMemories: users.reduce((sum, u) => sum + u.memoryCount, 0),
    };
  }, [users]);

  // LOGIN SCREEN UI
  if (!authenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center p-8 bg-background relative overflow-hidden select-none">
        {/* Subtle background glow */}
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

        <div className="max-w-md w-full flex flex-col items-center gap-8 z-10 text-center">
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
              Developer Portal
            </span>
            <h1 className="font-heading text-4xl font-light text-foreground">
              Internal Admin Console
            </h1>
            <p className="font-sans text-xs text-muted-foreground max-w-xs leading-relaxed">
              Enter the administration password to configure the environment and manage records.
            </p>
          </div>

          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1 relative">
              <label className="font-sans text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Admin Key Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={verifying}
                  className="w-full bg-secondary/45 hover:bg-secondary/70 focus:bg-secondary text-foreground font-sans placeholder:text-muted-foreground/35 rounded-lg py-3 pl-10 pr-4 border border-border/80 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 outline-none text-sm transition-all duration-300"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying || !password}
              className="w-full py-3.5 px-6 rounded-full font-sans text-xs font-semibold tracking-wider uppercase bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground border border-transparent transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
            >
              {verifying ? "Verifying Access..." : "Authenticate"}
            </button>
          </form>

          {authError && (
            <p className="font-sans text-xs text-red-500 animate-pulse mt-1">
              {authError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD UI
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-border/40 shrink-0">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-accent font-semibold">
            DEVELOPMENT & TESTING
          </span>
          <h1 className="font-heading text-3xl font-light tracking-wide text-foreground">
            Internal Admin Console
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/35 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-all cursor-pointer"
          >
            <LogOut size={13} />
            Exit Console
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-secondary/25 border border-border/45 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent/10 text-accent">
            <Users size={20} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Total Users
            </div>
            <div className="text-2xl font-light text-foreground mt-0.5">
              {stats.totalUsers}
            </div>
          </div>
        </div>

        <div className="bg-secondary/25 border border-border/45 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent/10 text-accent">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Active Plans
            </div>
            <div className="text-2xl font-light text-foreground mt-0.5">
              {stats.activePlans}
            </div>
          </div>
        </div>

        <div className="bg-secondary/25 border border-border/45 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent/10 text-accent">
            <Database size={20} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Total Memories
            </div>
            <div className="text-2xl font-light text-foreground mt-0.5">
              {stats.totalMemories}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search users by name, email, or UID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-secondary/35 text-foreground font-sans placeholder:text-muted-foreground/35 rounded-lg py-2.5 pl-10 pr-4 border border-border/80 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 outline-none text-sm transition-all duration-300"
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/45" />
      </div>

      {/* Users Table */}
      <div className="flex-1 bg-secondary/10 border border-border/45 rounded-xl overflow-hidden flex flex-col min-h-[300px]">
        {loading && users.length === 0 ? (
          <div className="flex-grow flex flex-col justify-center items-center text-muted-foreground py-16 gap-2">
            <RefreshCw size={24} className="animate-spin text-accent" />
            <span className="text-xs">Fetching users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex-grow flex flex-col justify-center items-center text-muted-foreground py-16 text-xs">
            {users.length === 0 ? "No users found in database." : "No users match your search criteria."}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-secondary/20 font-sans text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">UID</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-center">Google Sync</th>
                  <th className="py-3 px-4">Active Plan</th>
                  <th className="py-3 px-4 text-center">Memories</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 text-xs font-sans text-muted-foreground">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-secondary/15 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{user.name}</td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]" title={user.uid}>
                          {user.uid}
                        </span>
                        <button
                          onClick={() => copyToClipboard(user.uid)}
                          className="hover:text-foreground text-muted-foreground/45 transition-colors p-0.5 cursor-pointer"
                          title="Copy UID"
                        >
                          {copiedUid === user.uid ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">
                        {user.googleConnected ? (
                          <CheckCircle size={15} className="text-green-500" />
                        ) : (
                          <XCircle size={15} className="text-muted-foreground/35" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.activePlan !== "None" ? (
                        <span className="text-accent font-medium">{user.activePlan}</span>
                      ) : (
                        <span className="text-muted-foreground/45">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-secondary text-[11px] font-medium text-foreground">
                        {user.memoryCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDeletingUser(user)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-secondary/95 border border-border/80 rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-5 text-left">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-xl font-light text-foreground">
                  Confirm User Deletion
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are about to permanently delete <strong className="text-foreground">{deletingUser.name}</strong> ({deletingUser.email}).
                </p>
              </div>
            </div>

            <div className="bg-background/40 border border-destructive/20 rounded-lg p-3.5 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-destructive uppercase tracking-wide">
                Warning: IRREVERSIBLE OPERATION
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This will permanently delete this user's:
              </p>
              <ul className="text-[10px] text-muted-foreground/85 grid grid-cols-2 gap-x-3 gap-y-1 list-disc pl-4 mt-1 font-sans">
                <li>Profile & Settings</li>
                <li>Memories & Context</li>
                <li>Identity Traits & Proposals</li>
                <li>Reflections & Logs</li>
                <li>Plans & Milestones</li>
                <li>Goals & Tasks</li>
                <li>Weekly Schedules</li>
                <li>Daily Agendas</li>
                <li>Calendar Sync Logs</li>
                <li>Intelligence & Risk Data</li>
                <li>Conversation & Chat History</li>
                <li>Firebase Authentication Account</li>
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Type <strong className="text-foreground">DELETE</strong> to confirm
              </label>
              <input
                type="text"
                placeholder="Type DELETE"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                disabled={isDeleting}
                className="w-full bg-background border border-border/80 focus:border-destructive/40 focus:ring-1 focus:ring-destructive/40 outline-none text-xs rounded-lg py-2.5 px-3 text-foreground transition-all font-sans"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-red-500 font-sans leading-normal">
                Error: {deleteError}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => {
                  setDeletingUser(null);
                  setDeleteConfirmationText("");
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting || deleteConfirmationText !== "DELETE"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive text-primary-foreground text-xs font-semibold hover:bg-destructive/90 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
