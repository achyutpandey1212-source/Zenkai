"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

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
        setError(data.error || "Authentication failed on the server.");
      }
    } catch (err: any) {
      console.error("Sign-up error:", err);
      setError(err.message || "An error occurred during sign-up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-8 bg-background relative overflow-hidden select-none">
      {/* Subtle background glow */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full flex flex-col items-center gap-12 z-10 text-center">
        {/* Companion Orb Mini-Visual */}
        <div className="relative w-20 h-20 animate-float">
          <Image
            src="/assets/orbs/companion_orb.png"
            alt="Companion Orb"
            fill
            sizes="80px"
            className="object-contain drop-shadow-[0_4px_12px_rgba(201,168,106,0.1)]"
          />
        </div>

        {/* Header */}
        <div className="flex flex-col gap-3">
          <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
            Initiation Portal
          </span>
          <h1 className="font-heading text-4xl font-light text-foreground">
            Begin Your Journey
          </h1>
          <p className="font-sans text-sm text-muted-foreground max-w-xs leading-relaxed">
            Create your personal growth space and meet your companion.
          </p>
        </div>

        {/* Action Button & Error */}
        <div className="w-full flex flex-col gap-4">
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-full font-sans text-xs font-semibold tracking-wider uppercase border border-border/85 hover:border-accent/40 bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
            <span>{loading ? "Verifying..." : "Continue with Google"}</span>
          </button>

          {error && (
            <p className="font-sans text-xs text-red-500 animate-pulse mt-2">
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
