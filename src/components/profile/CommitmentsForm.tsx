"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, MapPin, Calendar, Clock } from "lucide-react";
import { ICommitment } from "@/models/Profile";

interface CommitmentsFormProps {
  value: ICommitment[];
  onChange: (newValue: ICommitment[]) => void;
}

const COMMITMENT_TYPES = [
  { id: "college", label: "College", icon: "🎓" },
  { id: "office", label: "Office", icon: "💼" },
  { id: "gym", label: "Gym", icon: "💪" },
  { id: "coaching", label: "Coaching", icon: "🧠" },
  { id: "internship", label: "Internship", icon: "🚀" },
  { id: "classes", label: "Classes", icon: "📚" },
  { id: "meetings", label: "Meetings", icon: "🤝" },
  { id: "other", label: "Other", icon: "➕" },
];

const DAYS_SHORT = [
  { full: "Monday", label: "Mon" },
  { full: "Tuesday", label: "Tue" },
  { full: "Wednesday", label: "Wed" },
  { full: "Thursday", label: "Thu" },
  { full: "Friday", label: "Fri" },
  { full: "Saturday", label: "Sat" },
  { full: "Sunday", label: "Sun" },
];

export default function CommitmentsForm({ value, onChange }: CommitmentsFormProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Temp state for new commitment builder
  const [name, setName] = useState("");
  const [type, setType] = useState("college");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [days, setDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [location, setLocation] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    const typeLabel = COMMITMENT_TYPES.find((t) => t.id === type)?.label || "Other";
    const newCommitment: ICommitment = {
      name: name.trim(),
      startTime,
      endTime,
      days,
      type: typeLabel,
      location: location.trim() || undefined,
    };
    onChange([...value, newCommitment]);
    
    // Reset temp state
    setName("");
    setType("college");
    setStartTime("09:00");
    setEndTime("17:00");
    setDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    setLocation("");
    setShowAddForm(false);
  };

  const handleRemove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const toggleDay = (day: string) => {
    if (days.includes(day)) {
      setDays(days.filter((d) => d !== day));
    } else {
      setDays([...days, day]);
    }
  };

  const selectPresetDays = (preset: "weekdays" | "everyday" | "weekends") => {
    if (preset === "weekdays") {
      setDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    } else if (preset === "everyday") {
      setDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    } else if (preset === "weekends") {
      setDays(["Saturday", "Sunday"]);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-xl mx-auto text-left animate-in fade-in duration-300">
      
      {/* Existing Commitments List */}
      {value.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
            Your Schedule Commitments ({value.length})
          </label>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-custom">
            {value.map((c, idx) => {
              const icon = COMMITMENT_TYPES.find(
                (t) => t.label.toLowerCase() === (c.type || "").toLowerCase()
              )?.icon || "⏳";
              return (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-card border border-border/80 px-4 py-3 rounded-2xl text-xs hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg bg-secondary/50 p-1.5 rounded-xl block shrink-0">
                      {icon}
                    </span>
                    <div>
                      <h5 className="font-semibold text-foreground">{c.name}</h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-0.5"><Clock size={10} /> {c.startTime}–{c.endTime}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Calendar size={10} /> {c.days.length === 7 ? "Every day" : c.days.map(d => d.slice(0, 3)).join(", ")}</span>
                        {c.location && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><MapPin size={10} /> {c.location}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-muted-foreground hover:text-destructive p-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trigger Add Form button */}
      {!showAddForm ? (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full py-4 rounded-2xl border border-dashed border-border hover:border-accent hover:bg-secondary/20 transition-all duration-300 outline-none flex items-center justify-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground font-sans text-xs font-semibold"
        >
          <Plus size={14} /> Add a Commitment
        </button>
      ) : (
        <div className="border border-border/85 bg-card/40 rounded-3xl p-5 md:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Commitment Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. College Classes, Gym session, Office"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent font-sans"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMITMENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={cn(
                    "py-1.5 px-3 rounded-full border text-[10px] font-semibold tracking-wide font-sans transition-all cursor-pointer",
                    type === t.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border/75 text-muted-foreground hover:bg-secondary/40"
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Days</label>
              <div className="flex gap-2 text-[9px] font-bold text-accent">
                <button type="button" onClick={() => selectPresetDays("weekdays")} className="hover:underline">Weekdays</button>
                <span>|</span>
                <button type="button" onClick={() => selectPresetDays("everyday")} className="hover:underline">Everyday</button>
                <span>|</span>
                <button type="button" onClick={() => selectPresetDays("weekends")} className="hover:underline">Weekends</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {DAYS_SHORT.map((d) => {
                const isSelected = days.includes(d.full);
                return (
                  <button
                    key={d.full}
                    type="button"
                    onClick={() => toggleDay(d.full)}
                    className={cn(
                      "py-1.5 px-3 rounded-full border text-[9px] font-sans font-semibold transition-all cursor-pointer flex-1 text-center",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border hover:bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Location (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Block C, Main Gym, Hybrid/Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent font-sans"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2.5 bg-card hover:bg-secondary/40 border border-border rounded-xl text-xs font-semibold tracking-wider font-sans transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!name.trim() || days.length === 0}
              className="flex-1 py-2.5 bg-primary hover:bg-accent text-primary-foreground hover:text-accent-foreground disabled:bg-secondary disabled:text-muted-foreground rounded-xl text-xs font-semibold tracking-wider font-sans transition-all cursor-pointer text-center"
            >
              Save Commitment
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
