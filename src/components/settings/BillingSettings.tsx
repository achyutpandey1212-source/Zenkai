"use client";

import React from "react";
import { Check } from "lucide-react";
import SectionHeader from "./SectionHeader";
import SettingsCard from "./SettingsCard";

export default function BillingSettings() {
  const pricingPlans = [
    {
      name: "Zenkai Flow",
      level: "Basic",
      price: "$0",
      desc: "Essential tools to organize your days and reflect on consistency.",
      current: true,
      features: [
        "1 Active Roadmap Goal",
        "Standard Companion Chat",
        "Daily Availability Slots",
        "Basic Memory Storage",
      ],
      buttonText: "Current Plan",
    },
    {
      name: "Zenkai Ascent",
      level: "Pro",
      price: "$12",
      desc: "Advanced re-balancing, calendar syncing, and cognitive depth.",
      current: false,
      popular: true,
      features: [
        "Unlimited Roadmap Goals",
        "Deep-Logic Companion",
        "Automated Re-balancing",
        "Google Calendar Sync",
        "Evolving Cognitive Profiling",
      ],
      buttonText: "Upgrade to Pro",
    },
    {
      name: "Zenkai Apex",
      level: "Elite",
      price: "$29",
      desc: "Custom cognitive parameters, executive briefs, and priority support.",
      current: false,
      features: [
        "Everything in Ascent Pro",
        "Custom Cognitive Tuning",
        "Proactive SMS Check-ins",
        "Weekly Executive Briefs",
      ],
      buttonText: "Go Elite",
    },
  ];

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl animate-in fade-in duration-200">
      <SectionHeader
        title="Billing & Plans"
        description="Review your active plan tier, system usage metrics, or upgrade your cognitive assistant."
      />

      {/* Usage Analytics */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Resource Utilization
        </span>
        <SettingsCard className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1.5 font-sans">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Roadmap Goals</span>
            <div className="text-xl font-light text-foreground">1 of 1 Goal</div>
            <div className="w-full bg-secondary/80 h-1 rounded-full overflow-hidden">
              <div className="bg-accent h-full rounded-full" style={{ width: "100%" }} />
            </div>
            <span className="text-[9px] text-muted-foreground/60">100% of basic tier capacity</span>
          </div>

          <div className="flex flex-col gap-1.5 font-sans">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Companion Memory</span>
            <div className="text-xl font-light text-foreground">4.2 KB / 50 KB</div>
            <div className="w-full bg-secondary/80 h-1 rounded-full overflow-hidden">
              <div className="bg-accent h-full rounded-full" style={{ width: "8.4%" }} />
            </div>
            <span className="text-[9px] text-muted-foreground/60">8.4% memory storage utilized</span>
          </div>

          <div className="flex flex-col gap-1.5 font-sans">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Daily AI Generation</span>
            <div className="text-xl font-light text-foreground">22 / 50 chats</div>
            <div className="w-full bg-secondary/80 h-1 rounded-full overflow-hidden">
              <div className="bg-accent h-full rounded-full" style={{ width: "44%" }} />
            </div>
            <span className="text-[9px] text-muted-foreground/60">Resets in 14 hours</span>
          </div>
        </SettingsCard>
      </div>

      {/* Pricing Comparison Grid */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Available Subscription Tiers
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col justify-between p-5 border rounded-2xl bg-secondary/10 hover:bg-secondary/15 transition-all duration-300 relative ${
                plan.popular
                  ? "border-accent shadow-[0_0_20px_rgba(201,168,106,0.1)] md:-translate-y-1"
                  : "border-border/30"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent text-primary-foreground text-[8px] font-bold tracking-widest uppercase shadow">
                  Most Popular
                </span>
              )}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[9px] tracking-wider text-muted-foreground/75 font-bold uppercase">
                    {plan.level}
                  </span>
                  <h3 className="font-heading text-lg font-light text-foreground">{plan.name}</h3>
                </div>

                <div className="flex items-baseline gap-0.5">
                  <span className="font-heading text-2xl font-light text-foreground">{plan.price}</span>
                  <span className="font-sans text-[9px] text-muted-foreground">/ month</span>
                </div>

                <p className="font-sans text-[11px] text-muted-foreground leading-normal">
                  {plan.desc}
                </p>

                <hr className="border-border/10" />

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[10px] text-muted-foreground leading-tight">
                      <Check size={11} className="text-accent shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!plan.current) {
                    alert(`${plan.name} upgrade initiated! (Mock billing)`);
                  }
                }}
                disabled={plan.current}
                className={`w-full mt-6 py-2 rounded-xl text-[10px] font-sans font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                  plan.current
                    ? "border border-border/80 bg-card text-muted-foreground cursor-default"
                    : plan.popular
                    ? "bg-accent hover:bg-accent/90 text-primary-foreground shadow"
                    : "border border-border bg-card hover:bg-secondary/40 text-foreground"
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
