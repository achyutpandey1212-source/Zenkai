"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInAnonymously 
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import ThemeToggle from "@/components/theme-toggle";

export default function SignupForm() {
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("zenkai_onboarding_draft");
      localStorage.removeItem("has_seen_tour");
      localStorage.removeItem("show_first_draft_card");
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchAuthToken = async (idToken: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    const data = await res.json();
    if (data.success) {
      router.push("/app");
      router.refresh();
    } else {
      throw new Error(data.error || "Authentication failed on the server.");
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all credentials.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      await handleFetchAuthToken(idToken);
    } catch (err: any) {
      console.error("Email signup error:", err);
      setError(err.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await handleFetchAuthToken(idToken);
    } catch (err: any) {
      console.error("Google signup error:", err);
      setError(err.message || "An error occurred during Google sign-up.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignUp = async () => {
    setGuestLoading(true);
    setError(null);
    try {
      const result = await signInAnonymously(auth);
      const idToken = await result.user.getIdToken();
      await handleFetchAuthToken(idToken);
    } catch (err: any) {
      console.error("Guest signup error:", err);
      setError(err.message || "An error occurred during Guest registration.");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-8 bg-background relative overflow-hidden select-none">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-8 z-20">
        <ThemeToggle />
      </div>

      {/* Subtle background glow */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full flex flex-col items-center gap-8 z-10 text-center">
        {/* Companion Orb Mini-Visual */}
        <div className="relative w-16 h-16 animate-float">
          <Image
            src="/assets/orbs/companion_orb.png"
            alt="Companion Orb"
            fill
            sizes="64px"
            className="object-contain drop-shadow-[0_4px_12px_rgba(201,168,106,0.1)]"
          />
        </div>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
            Initiation Portal
          </span>
          <h1 className="font-heading text-4xl font-light text-foreground">
            Begin Your Journey
          </h1>
          <p className="font-sans text-xs text-muted-foreground max-w-xs leading-relaxed">
            Create your personal growth space and meet your companion.
          </p>
        </div>

        {/* Auth Forms */}
        <div className="w-full flex flex-col gap-5">
          {/* Email/Password Signup Form */}
          <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || guestLoading}
                className="w-full bg-secondary/45 hover:bg-secondary/70 focus:bg-secondary text-foreground font-sans placeholder:text-muted-foreground/35 rounded-lg py-3 px-4 border border-border/80 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 outline-none text-sm transition-all duration-300"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Password
              </label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || guestLoading}
                className="w-full bg-secondary/45 hover:bg-secondary/70 focus:bg-secondary text-foreground font-sans placeholder:text-muted-foreground/35 rounded-lg py-3 px-4 border border-border/80 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 outline-none text-sm transition-all duration-300"
              />
            </div>

            <button
              type="submit"
              disabled={loading || guestLoading}
              className="w-full py-3.5 px-6 rounded-full font-sans text-xs font-semibold tracking-wider uppercase bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground border border-transparent transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
            >
              {loading ? "Registering..." : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full">
            <div className="h-[1px] flex-1 bg-border/60" />
            <span className="font-sans text-[10px] text-muted-foreground/60 uppercase tracking-widest">or</span>
            <div className="h-[1px] flex-1 bg-border/60" />
          </div>

          {/* Google & Guest Auth Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogleSignUp}
              disabled={loading || guestLoading}
              className="flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-full font-sans text-xs font-semibold tracking-wider uppercase border border-border/85 hover:border-accent/40 bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {/* Google Icon Custom SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              onClick={handleAnonymousSignUp}
              disabled={loading || guestLoading}
              className="w-full py-3.5 px-6 rounded-full font-sans text-xs font-semibold tracking-wider uppercase border border-dashed border-accent/40 hover:border-accent bg-transparent text-accent hover:text-accent/80 transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
            >
              {guestLoading ? "Entering..." : "Continue as Guest"}
            </button>
          </div>

          {error && (
            <p className="font-sans text-xs text-red-500 animate-pulse mt-1">
              {error}
            </p>
          )}
        </div>

        {/* Footer Link */}
        <div className="font-sans text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent hover:text-accent/80 font-medium underline underline-offset-4 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
