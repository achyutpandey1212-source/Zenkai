"use client";

import React, { useState, useEffect, useRef } from "react";
import { COMMAND_REGISTRY, CommandDefinition } from "@/lib/command-registry";
import { ChevronRight, Sparkles, Check, X, Calendar, PlusCircle, ArrowLeft } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (commandText: string) => void;
  inputValue: string;
  setInputValue: (val: string) => void;
}

type MenuLevel = 
  | "categories" 
  | "commands" 
  | "task_search" 
  | "add_block_form" 
  | "edit_task_form" 
  | "create_task_form" 
  | "search_memory_form" 
  | "difficulty_form" 
  | "goal_status_form" 
  | "clear_schedule_form" 
  | "success_screen";

interface CategoryItem {
  name: string;
  icon: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: "Schedule", icon: "📅" },
  { name: "Tasks", icon: "✅" },
  { name: "Roadmap", icon: "🧠" },
  { name: "Calendar", icon: "📆" },
  { name: "Memory", icon: "📝" },
  { name: "Workspace", icon: "📊" },
  { name: "Identity", icon: "🪞" },
  { name: "Reflection", icon: "💭" },
];

export default function CommandPalette({
  isOpen,
  onClose,
  onExecute,
  inputValue,
  setInputValue,
}: CommandPaletteProps) {
  const [menuLevel, setMenuLevel] = useState<MenuLevel>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandDefinition | null>(null);
  
  // Fuzzy Search Tasks State
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Single-Step Form States
  // Add Block Form
  const [blockTitle, setBlockTitle] = useState("");
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("10:00");
  const [blockDesc, setBlockDesc] = useState("");

  // Edit/Create Task Form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState(3);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskStart, setTaskStart] = useState("");
  const [taskEnd, setTaskEnd] = useState("");
  const [taskDuration, setTaskDuration] = useState<number | "">("");

  // Memory Search Form
  const [memorySearchQuery, setMemorySearchQuery] = useState("");

  // Roadmap Difficulty Form
  const [roadmapDifficultyLevel, setRoadmapDifficultyLevel] = useState("medium");

  // Goal Status Form (Pause/Resume)
  const [goalTitleInput, setGoalTitleInput] = useState("");

  // Clear Schedule Form
  const [clearScheduleDate, setClearScheduleDate] = useState("");

  // Success Feedback
  const [successMessage, setSuccessMessage] = useState("");

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const taskSearchInputRef = useRef<HTMLInputElement>(null);

  // Load user tasks when menu changes to task operations
  useEffect(() => {
    async function fetchTasks() {
      setLoadingTasks(true);
      try {
        const res = await fetch("/api/tasks", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setTasks(data.tasks || []);
          }
        }
      } catch (err) {
        console.error("Failed to load tasks:", err);
      } finally {
        setLoadingTasks(false);
      }
    }
    if (isOpen && (selectedCategory === "Tasks" || menuLevel === "task_search")) {
      fetchTasks();
    }
  }, [isOpen, selectedCategory, menuLevel]);

  // Parse unified input search text
  let activeCategory = selectedCategory;
  let subQuery = "";

  const trimmedInput = inputValue.trim();
  if (trimmedInput.startsWith("/")) {
    const parts = trimmedInput.slice(1).split(/\s+/);
    const firstWord = parts[0].toLowerCase();
    
    const matchedCat = CATEGORIES.find(c => c.name.toLowerCase() === firstWord);
    if (matchedCat) {
      activeCategory = matchedCat.name;
      subQuery = parts.slice(1).join(" ");
    } else {
      subQuery = parts.join(" ");
    }
  }

  // Filter Categories
  const filteredCategories = CATEGORIES.filter(cat => 
    cat.name.toLowerCase().includes(subQuery.toLowerCase())
  );

  // Filter Commands under selected category or globally
  const filteredCommands = COMMAND_REGISTRY.filter(cmd => {
    const matchesQuery = cmd.title.toLowerCase().includes(subQuery.toLowerCase()) || 
                         cmd.description.toLowerCase().includes(subQuery.toLowerCase());
    if (activeCategory) {
      return cmd.category === activeCategory && matchesQuery;
    }
    return matchesQuery;
  });

  // Filter Tasks fuzzy query
  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(taskSearchQuery.toLowerCase()))
  );

  const isFormOrSuccessMode = [
    "add_block_form", 
    "edit_task_form", 
    "create_task_form", 
    "search_memory_form", 
    "difficulty_form", 
    "goal_status_form", 
    "clear_schedule_form", 
    "success_screen"
  ].includes(menuLevel);

  // Unified items count for key navigation
  let itemsCount = 0;
  const isBrowsingCategories = !activeCategory && subQuery.length === 0;
  
  if (menuLevel === "categories") {
    itemsCount = isBrowsingCategories ? filteredCategories.length : (filteredCategories.length + filteredCommands.length);
  } else if (menuLevel === "commands") {
    itemsCount = filteredCommands.length;
  } else if (menuLevel === "task_search") {
    itemsCount = filteredTasks.length;
  } else if (menuLevel === "success_screen") {
    itemsCount = 3; // Add another, Modify, Close
  }

  // Keyboard navigation from parent input
  useEffect(() => {
    function handleGlobalKeys(e: Event) {
      const key = (e as CustomEvent).detail;
      if (!isOpen) return;

      // In form mode, ignore global key listeners so input elements work naturally
      if (isFormOrSuccessMode && menuLevel !== "success_screen") {
        return;
      }

      if (key === "Escape") {
        if (menuLevel === "task_search") {
          setMenuLevel("commands");
        } else if (selectedCategory) {
          setSelectedCategory(null);
          setMenuLevel("categories");
          setInputValue("/");
        } else {
          onClose();
        }
        document.querySelector("textarea")?.focus();
        return;
      }

      if (key === "ArrowDown") {
        setActiveIndex(prev => (itemsCount > 0 ? (prev + 1) % itemsCount : 0));
      } else if (key === "ArrowUp") {
        setActiveIndex(prev => (itemsCount > 0 ? (prev - 1 + itemsCount) % itemsCount : 0));
      } else if (key === "Enter") {
        if (itemsCount === 0) return;
        
        if (menuLevel === "categories") {
          if (isBrowsingCategories) {
            handleCategorySelect(filteredCategories[activeIndex].name);
          } else {
            if (activeIndex < filteredCategories.length) {
              handleCategorySelect(filteredCategories[activeIndex].name);
            } else {
              handleCommandSelect(filteredCommands[activeIndex - filteredCategories.length]);
            }
          }
        } else if (menuLevel === "commands") {
          handleCommandSelect(filteredCommands[activeIndex]);
        } else if (menuLevel === "task_search") {
          handleTaskSelect(filteredTasks[activeIndex]);
        } else if (menuLevel === "success_screen") {
          handleSuccessAction(activeIndex);
        }
      }
    }

    window.addEventListener("command-palette-key", handleGlobalKeys);
    return () => {
      window.removeEventListener("command-palette-key", handleGlobalKeys);
    };
  }, [isOpen, menuLevel, selectedCategory, activeIndex, itemsCount, isBrowsingCategories, subQuery, filteredCategories, filteredCommands, filteredTasks, isFormOrSuccessMode]);

  // Adjust active index when lists filter
  useEffect(() => {
    setActiveIndex(0);
  }, [selectedCategory, subQuery, taskSearchQuery]);

  // Focus fuzzy task search
  useEffect(() => {
    if (menuLevel === "task_search") {
      taskSearchInputRef.current?.focus();
    }
  }, [menuLevel]);

  if (!isOpen) return null;

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setMenuLevel("commands");
    setInputValue(`/${category.toLowerCase()} `);
  };

  const handleCommandSelect = (cmd: CommandDefinition) => {
    setSelectedCommand(cmd);
    
    // Check if task ID target selection is required
    const needsTaskId = cmd.parameters.some(p => p.name === "id");
    
    if (cmd.id === "schedule.add") {
      setMenuLevel("add_block_form");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setBlockDate(tomorrow.toISOString().split("T")[0]);
      setBlockTitle("");
      setBlockStart("09:00");
      setBlockEnd("10:00");
      setBlockDesc("");
    } else if (needsTaskId) {
      setMenuLevel("task_search");
      setTaskSearchQuery("");
    } else if (cmd.id === "task.create") {
      setMenuLevel("create_task_form");
      setTaskTitle("");
      setTaskDesc("");
      setTaskDate("");
      setTaskStart("");
      setTaskEnd("");
      setTaskDuration("");
      setTaskPriority(3);
    } else if (cmd.id === "memory.search") {
      setMenuLevel("search_memory_form");
      setMemorySearchQuery("");
    } else if (cmd.id === "roadmap.difficulty") {
      setMenuLevel("difficulty_form");
      setRoadmapDifficultyLevel("medium");
    } else if (cmd.id === "roadmap.pause" || cmd.id === "roadmap.resume") {
      setMenuLevel("goal_status_form");
      setGoalTitleInput("");
    } else if (cmd.id === "schedule.clear") {
      setMenuLevel("clear_schedule_form");
      const today = new Date();
      setClearScheduleDate(today.toISOString().split("T")[0]);
    } else if (cmd.parameters.length > 0) {
      const categoryMapping = cmd.category.toLowerCase();
      const titleMapping = cmd.title.toLowerCase();
      onExecute(`/${categoryMapping} ${titleMapping}`);
      onClose();
    } else {
      const categoryMapping = cmd.category.toLowerCase();
      const titleMapping = cmd.title.toLowerCase();
      onExecute(`/${categoryMapping} ${titleMapping}`);
      onSuccessExecute(`Executed **"${cmd.title}"** successfully.`);
    }
  };

  const handleTaskSelect = (task: any) => {
    setSelectedTask(task);
    if (selectedCommand?.id === "task.edit") {
      setMenuLevel("edit_task_form");
      setTaskTitle(task.title);
      setTaskDesc(task.description || "");
      setTaskPriority(task.priority || 3);
      setTaskDate(task.suggestedDate || "");
      if (task.timeBlock) {
        const [s, e] = task.timeBlock.split(" - ");
        setTaskStart(s || "");
        setTaskEnd(e || "");
      } else {
        setTaskStart("");
        setTaskEnd("");
      }
      setTaskDuration(task.estimatedMinutes || "");
    } else {
      // Complete, delete, reopen, or archive - send title directly as identifier
      const categoryMapping = selectedCommand!.category.toLowerCase();
      const titleMapping = selectedCommand!.title.toLowerCase();
      onExecute(`/${categoryMapping} ${titleMapping} --id "${task.title}"`);
      onSuccessExecute(`Marked task **"${task.title}"** action completed.`);
    }
  };

  const handleAddBlockSubmit = () => {
    if (!blockTitle.trim() || !blockDate || !blockStart || !blockEnd) return;
    const cmdText = `/schedule add block --title "${blockTitle}" --date "${blockDate}" --startTime "${blockStart}" --endTime "${blockEnd}"`;
    onExecute(cmdText);
    onSuccessExecute(`Added work block **"${blockTitle}"** to schedule.`);
  };

  const handleCreateTaskSubmit = () => {
    if (!taskTitle.trim()) return;
    let cmdText = `/tasks create task --title "${taskTitle}" --description "${taskDesc}" --priority ${taskPriority}`;
    if (taskDate) cmdText += ` --date "${taskDate}"`;
    if (taskStart) cmdText += ` --startTime "${taskStart}"`;
    if (taskEnd) cmdText += ` --endTime "${taskEnd}"`;
    if (taskDuration) cmdText += ` --estimatedMinutes ${taskDuration}`;

    onExecute(cmdText);
    onSuccessExecute(`Created new task **"${taskTitle}"**.`);
  };

  const handleEditTaskSubmit = () => {
    if (!selectedTask || !taskTitle.trim()) return;
    let cmdText = `/tasks edit task --id "${selectedTask.title}" --title "${taskTitle}" --description "${taskDesc}" --priority ${taskPriority}`;
    if (taskDate !== undefined) cmdText += ` --date "${taskDate}"`;
    if (taskStart) cmdText += ` --startTime "${taskStart}"`;
    if (taskEnd) cmdText += ` --endTime "${taskEnd}"`;
    if (taskDuration) cmdText += ` --estimatedMinutes ${taskDuration}`;

    onExecute(cmdText);
    onSuccessExecute(`Updated task **"${taskTitle}"** details.`);
  };

  const handleMemorySearchSubmit = () => {
    if (!memorySearchQuery.trim()) return;
    const cmdText = `/memory search memory --query "${memorySearchQuery}"`;
    onExecute(cmdText);
    onSuccessExecute(`Searching memories for query **"${memorySearchQuery}"**.`);
  };

  const handleDifficultySubmit = () => {
    const cmdText = `/roadmap adjust difficulty --difficulty "${roadmapDifficultyLevel}"`;
    onExecute(cmdText);
    onSuccessExecute(`Adjusted roadmap intensity to **${roadmapDifficultyLevel}**.`);
  };

  const handleGoalStatusSubmit = () => {
    if (!goalTitleInput.trim()) return;
    const isPause = selectedCommand?.id === "roadmap.pause";
    const cmdText = `/roadmap ${isPause ? "pause" : "resume"} goal --title "${goalTitleInput}"`;
    onExecute(cmdText);
    onSuccessExecute(`${isPause ? "Paused" : "Resumed"} goal **"${goalTitleInput}"**.`);
  };

  const handleClearScheduleSubmit = () => {
    if (!clearScheduleDate) return;
    const cmdText = `/schedule clear day --date "${clearScheduleDate}"`;
    onExecute(cmdText);
    onSuccessExecute(`Cleared schedule for date **${clearScheduleDate}**.`);
  };

  const onSuccessExecute = (msg: string) => {
    setSuccessMessage(msg);
    setMenuLevel("success_screen");
    setActiveIndex(0);
  };

  const handleSuccessAction = (idx: number) => {
    if (idx === 0) {
      if (selectedCommand?.id === "schedule.add") {
        setMenuLevel("add_block_form");
        setBlockTitle("");
      } else if (selectedCommand?.id === "task.create") {
        setMenuLevel("create_task_form");
        setTaskTitle("");
        setTaskDesc("");
      } else if (selectedCategory === "Tasks") {
        setMenuLevel("commands");
        setInputValue("/tasks ");
      } else {
        setMenuLevel("categories");
        setInputValue("/");
      }
    } else if (idx === 1) {
      setMenuLevel("categories");
      setSelectedCategory(null);
      setInputValue("/");
    } else {
      onClose();
    }
    document.querySelector("textarea")?.focus();
  };

  const getSubCommandEmoji = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("add") || t.includes("create")) return "➕";
    if (t.includes("edit")) return "✏️";
    if (t.includes("move")) return "↔";
    if (t.includes("resize")) return "📏";
    if (t.includes("delete") || t.includes("forget")) return "🗑";
    if (t.includes("clear")) return "🧹";
    if (t.includes("today") || t.includes("agenda") || t.includes("view")) return "📋";
    if (t.includes("week") || t.includes("overview")) return "📊";
    if (t.includes("regenerate")) return "🔄";
    if (t.includes("sync")) return "⚡";
    if (t.includes("search")) return "🔍";
    return "🔹";
  };

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-card/95 backdrop-blur-lg border border-accent/25 hover:border-accent/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[340px] transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 z-50 font-sans"
    >
      {/* 1. Add Block Form */}
      {menuLevel === "add_block_form" && (
        <div className="p-5 flex flex-col gap-4 bg-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-2">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              <PlusCircle size={14} /> New Block
            </span>
            <button 
              type="button" 
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Title</label>
              <input
                type="text"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                placeholder="e.g. Study DBMS, Prayer"
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Date</label>
              <input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex gap-2.5">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Starts</label>
                <input
                  type="time"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Ends</label>
                <input
                  type="time"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Description (optional)</label>
              <input
                type="text"
                value={blockDesc}
                onChange={(e) => setBlockDesc(e.target.value)}
                placeholder="Optional description facts..."
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-3 mt-1">
            <button
              type="button"
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="px-4 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddBlockSubmit}
              disabled={!blockTitle.trim() || !blockDate}
              className="px-5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90 disabled:opacity-40"
            >
              Add Block
            </button>
          </div>
        </div>
      )}

      {/* 2. Create Task Form */}
      {menuLevel === "create_task_form" && (
        <div className="p-5 flex flex-col gap-3.5 bg-secondary/5 overflow-y-auto max-h-[330px]">
          <div className="flex justify-between items-center border-b border-border/20 pb-1.5">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              ➕ Create Task
            </span>
            <button 
              type="button" 
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Title</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title..."
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Schedule Date (optional)</label>
              <input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex gap-1.5">
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Starts</label>
                <input
                  type="time"
                  value={taskStart}
                  onChange={(e) => setTaskStart(e.target.value)}
                  className="bg-secondary/40 border border-border/30 rounded-xl px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Ends</label>
                <input
                  type="time"
                  value={taskEnd}
                  onChange={(e) => setTaskEnd(e.target.value)}
                  className="bg-secondary/40 border border-border/30 rounded-xl px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Duration (mins)</label>
              <input
                type="number"
                value={taskDuration}
                onChange={(e) => setTaskDuration(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 45"
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(Number(e.target.value))}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              >
                <option value={1}>1 - Highest</option>
                <option value={2}>2 - High</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - Low</option>
                <option value={5}>5 - Lowest</option>
              </select>
            </div>

            <div className="col-span-2 flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Description</label>
              <input
                type="text"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Optional task details..."
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-2.5">
            <button
              type="button"
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="px-4 py-1 rounded-lg border border-border hover:bg-secondary text-[11px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateTaskSubmit}
              disabled={!taskTitle.trim()}
              className="px-5 py-1 rounded-lg bg-accent text-accent-foreground text-[11px] font-bold hover:bg-accent/90"
            >
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* 3. Edit Task Form */}
      {menuLevel === "edit_task_form" && selectedTask && (
        <div className="p-5 flex flex-col gap-3.5 bg-secondary/5 overflow-y-auto max-h-[330px]">
          <div className="flex justify-between items-center border-b border-border/20 pb-1.5">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              ✏️ Edit Task Details
            </span>
            <button 
              type="button" 
              onClick={() => setMenuLevel("task_search")}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Title</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Schedule Date (optional)</label>
              <input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex gap-1.5">
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Starts</label>
                <input
                  type="time"
                  value={taskStart}
                  onChange={(e) => setTaskStart(e.target.value)}
                  className="bg-secondary/40 border border-border/30 rounded-xl px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Ends</label>
                <input
                  type="time"
                  value={taskEnd}
                  onChange={(e) => setTaskEnd(e.target.value)}
                  className="bg-secondary/40 border border-border/30 rounded-xl px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Duration (mins)</label>
              <input
                type="number"
                value={taskDuration}
                onChange={(e) => setTaskDuration(e.target.value ? Number(e.target.value) : "")}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(Number(e.target.value))}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              >
                <option value={1}>1 - Highest</option>
                <option value={2}>2 - High</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - Low</option>
                <option value={5}>5 - Lowest</option>
              </select>
            </div>

            <div className="col-span-2 flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Description</label>
              <input
                type="text"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-2.5">
            <button
              type="button"
              onClick={() => setMenuLevel("task_search")}
              className="px-4 py-1 rounded-lg border border-border hover:bg-secondary text-[11px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditTaskSubmit}
              disabled={!taskTitle.trim()}
              className="px-5 py-1 rounded-lg bg-accent text-accent-foreground text-[11px] font-bold hover:bg-accent/90"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* 4. Search Memory Form */}
      {menuLevel === "search_memory_form" && (
        <div className="p-5 flex flex-col gap-4 bg-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-2">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              🔍 Search Memories
            </span>
            <button 
              type="button" 
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Query</label>
            <input
              type="text"
              value={memorySearchQuery}
              onChange={(e) => setMemorySearchQuery(e.target.value)}
              placeholder="Search keyword..."
              className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-3 mt-1">
            <button
              type="button"
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="px-4 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMemorySearchSubmit}
              disabled={!memorySearchQuery.trim()}
              className="px-5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90"
            >
              Search
            </button>
          </div>
        </div>
      )}

      {/* 5. Adjust Difficulty Form */}
      {menuLevel === "difficulty_form" && (
        <div className="p-5 flex flex-col gap-4 bg-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-2">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              📈 Adjust Difficulty
            </span>
            <button 
              type="button" 
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Intensity Level</label>
            <select
              value={roadmapDifficultyLevel}
              onChange={(e) => setRoadmapDifficultyLevel(e.target.value)}
              className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
            >
              <option value="easy">Easy (More breaks, lighter schedule)</option>
              <option value="medium">Medium (Balanced pacing)</option>
              <option value="hard">Hard (Packed schedules, maximum output)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-3 mt-1">
            <button
              type="button"
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="px-4 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDifficultySubmit}
              className="px-5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90"
            >
              Adjust
            </button>
          </div>
        </div>
      )}

      {/* 6. Pause / Resume Goal Form */}
      {menuLevel === "goal_status_form" && (
        <div className="p-5 flex flex-col gap-4 bg-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-2">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              🎯 {selectedCommand?.title}
            </span>
            <button 
              type="button" 
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Goal Title</label>
            <input
              type="text"
              value={goalTitleInput}
              onChange={(e) => setGoalTitleInput(e.target.value)}
              placeholder="e.g. Master DBMS"
              className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-3 mt-1">
            <button
              type="button"
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="px-4 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGoalStatusSubmit}
              disabled={!goalTitleInput.trim()}
              className="px-5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90"
            >
              Confirm Goal Action
            </button>
          </div>
        </div>
      )}

      {/* 7. Clear Schedule Day Form */}
      {menuLevel === "clear_schedule_form" && (
        <div className="p-5 flex flex-col gap-4 bg-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-2">
            <span className="text-xs font-bold text-accent tracking-wider flex items-center gap-1.5 uppercase">
              🧹 Clear Day Schedule
            </span>
            <button 
              type="button" 
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] flex items-center gap-1"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Date to clear</label>
            <input
              type="date"
              value={clearScheduleDate}
              onChange={(e) => setClearScheduleDate(e.target.value)}
              className="bg-secondary/40 border border-border/30 rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/25 pt-3 mt-1">
            <button
              type="button"
              onClick={() => { setMenuLevel("commands"); document.querySelector("textarea")?.focus(); }}
              className="px-4 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearScheduleSubmit}
              disabled={!clearScheduleDate}
              className="px-5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all"
            >
              Clear Schedule Day
            </button>
          </div>
        </div>
      )}

      {/* 8. Task Fuzzy-Search Selector */}
      {menuLevel === "task_search" && (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 bg-secondary/10">
            <span className="text-[9px] font-bold text-accent uppercase tracking-wider select-none">
              Select Target Task
            </span>
            <input
              ref={taskSearchInputRef}
              type="text"
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              placeholder="Search task title..."
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs text-foreground placeholder:text-muted-foreground/45"
            />
            <button 
              type="button"
              onClick={() => setMenuLevel("commands")}
              className="text-[9px] text-muted-foreground/60 hover:text-foreground font-semibold"
            >
              ESC to cancel
            </button>
          </div>

          <div className="overflow-y-auto p-2 flex flex-col gap-0.5 max-h-[220px]">
            {filteredTasks.map((task, idx) => (
              <div
                key={task._id}
                onClick={() => handleTaskSelect(task)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                  activeIndex === idx 
                    ? "bg-secondary text-foreground font-semibold" 
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span>{task.title}</span>
                    {task.priority <= 2 && (
                      <span className="text-[7px] font-semibold text-red-500/90 border border-red-500/25 px-1 py-0.2 rounded uppercase">
                        High Priority
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <div className="text-[10px] text-muted-foreground/80 line-clamp-1">
                      {task.description}
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-mono text-muted-foreground/40 font-normal">
                  {task.status}
                </span>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <div className="text-xs text-muted-foreground/60 text-center py-6">No matching tasks found.</div>
            )}
          </div>
        </div>
      )}

      {/* 9. Success Chain Screen Menu */}
      {menuLevel === "success_screen" && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-green-500">
            <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center font-bold text-sm">
              ✓
            </div>
            <span className="text-xs font-sans font-semibold">
              Action completed successfully!
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground/90 leading-relaxed font-sans px-1">
            {successMessage}
          </p>

          <div className="flex flex-col gap-1 border-t border-border/20 pt-3 mt-1">
            <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest px-2.5 py-1">
              What next?
            </div>
            
            <div
              onClick={() => handleSuccessAction(0)}
              onMouseEnter={() => setActiveIndex(0)}
              className={`px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-all ${
                activeIndex === 0 ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              ➕ Add/Manage another item
            </div>

            <div
              onClick={() => handleSuccessAction(1)}
              onMouseEnter={() => setActiveIndex(1)}
              className={`px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-all ${
                activeIndex === 1 ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              📅 Go back to Main Menu
            </div>

            <div
              onClick={() => handleSuccessAction(2)}
              onMouseEnter={() => setActiveIndex(2)}
              className={`px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-all ${
                activeIndex === 2 ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              ❌ Close palette
            </div>
          </div>
        </div>
      )}

      {/* 10. Categories & Commands Menu */}
      {!isFormOrSuccessMode && menuLevel !== "task_search" && (
        <div className="overflow-y-auto max-h-[300px] p-2 flex flex-col gap-0.5">
          <div className="text-[9px] tracking-widest text-accent uppercase font-bold px-3 py-1.5 flex justify-between select-none">
            <span>⚡ Quick Actions</span>
            {activeCategory && (
              <span className="text-[8px] text-muted-foreground/60 normal-case font-normal">
                Folder: {activeCategory}
              </span>
            )}
          </div>

          {!activeCategory && subQuery.length === 0 ? (
            filteredCategories.map((cat, idx) => (
              <div
                key={cat.name}
                onClick={() => handleCategorySelect(cat.name)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                  activeIndex === idx 
                    ? "bg-secondary text-foreground font-semibold" 
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-xs font-medium">{cat.name}</span>
                </div>
                <ChevronRight size={13} className="opacity-40" />
              </div>
            ))
          ) : (
            <>
              {!activeCategory && filteredCategories.map((cat, idx) => (
                <div
                  key={cat.name}
                  onClick={() => handleCategorySelect(cat.name)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                    activeIndex === idx 
                      ? "bg-secondary text-foreground font-semibold" 
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs font-medium">{cat.name} →</span>
                  </div>
                  <ChevronRight size={13} className="opacity-40" />
                </div>
              ))}

              {filteredCommands.map((cmd, idx) => {
                const globalIdx = !activeCategory ? (filteredCategories.length + idx) : idx;
                return (
                  <div
                    key={cmd.id}
                    onClick={() => handleCommandSelect(cmd)}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeIndex === globalIdx 
                        ? "bg-secondary text-foreground font-semibold" 
                        : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-xs font-medium flex items-center gap-2 text-foreground">
                        <span>{getSubCommandEmoji(cmd.title)}</span>
                        <span>{cmd.title}</span>
                        <span className="text-[9px] font-mono text-muted-foreground/50 font-normal">
                          /{cmd.category.toLowerCase()} {cmd.title.toLowerCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 line-clamp-1">
                        {cmd.description}
                      </div>
                    </div>
                    {cmd.requiresConfirmation && (
                      <span className="text-[7.5px] font-semibold text-accent/80 border border-accent/25 px-1.5 py-0.5 rounded uppercase tracking-wider bg-accent/5">
                        Confirm
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {itemsCount === 0 && (
            <div className="text-xs text-muted-foreground/60 text-center py-6">No matching items found.</div>
          )}
        </div>
      )}
    </div>
  );
}
