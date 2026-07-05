"use client";

import React, { useState, useEffect } from "react";
import Sidebar, { ScreenType } from "./sidebar";
import Home from "./screens/home";
import Chat from "./screens/chat";
import Tasks from "./screens/tasks";
import Identity from "./screens/identity";
import Reflection from "./screens/reflection";
import You from "./screens/you";
import Onboarding from "./onboarding";
import MemoryDebug from "./screens/memory-debug";
import Plans from "./screens/plans";
import SettingsModal from "./settings/SettingsModal";
import { SettingsTabType } from "./settings/SettingsSidebar";

import { OrbState } from "./ui/companion-orb";

interface ShellProps {
  initialUser?: {
    name: string;
    email: string;
    firebaseUid: string;
    onboardingCompleted: boolean;
  } | null;
}

export default function Shell({ initialUser }: ShellProps) {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [themeInitialized, setThemeInitialized] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabType>("general");
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(
    initialUser ? initialUser.onboardingCompleted : null
  );

  const startTour = () => {
    setTourStep(0);
    setCurrentScreen("home");
  };

  const nextTourStep = () => {
    if (tourStep === null) return;
    const nextStep = tourStep + 1;
    if (nextStep > 7) {
      setTourStep(null);
      setCurrentScreen("home");
      if (typeof window !== "undefined") {
        localStorage.setItem("has_seen_tour", "true");
        localStorage.setItem("show_first_draft_card", "true");
      }
    } else {
      setTourStep(nextStep);
      // Navigate screen automatically
      if (nextStep === 1) setCurrentScreen("home");
      else if (nextStep === 2) setCurrentScreen("plans");
      else if (nextStep === 3) setCurrentScreen("tasks");
      else if (nextStep === 4) setCurrentScreen("plans");
      else if (nextStep === 5) setCurrentScreen("identity");
      else if (nextStep === 6) setCurrentScreen("reflection");
      else if (nextStep === 7) setCurrentScreen("home");
    }
  };

  const skipTour = () => {
    setTourStep(null);
    setCurrentScreen("home");
    if (typeof window !== "undefined") {
      localStorage.setItem("has_seen_tour", "true");
      localStorage.setItem("show_first_draft_card", "true");
    }
  };

  const renderTourStep = () => {
    if (tourStep === null) return null;

    const steps = [
      {
        title: "Welcome to Zenkai",
        desc: "Let's take a quick 1-minute walkthrough to introduce your growth space.",
        buttonText: "Start Tour",
      },
      {
        title: "1. Home & Companion Orb",
        desc: "Your primary growth terminal. Interact with the Companion Orb to record thoughts, get updates, or trigger re-scheduling.",
        buttonText: "Next",
      },
      {
        title: "2. Roadmaps & Plans",
        desc: "Here Zenkai projects your long-term goals into structured milestones and tasks, adapting as your deadlines shift.",
        buttonText: "Next",
      },
      {
        title: "3. Backlog & Tasks",
        desc: "A clean interface to review all todo items, adjust details, and organize your backlog.",
        buttonText: "Next",
      },
      {
        title: "4. Calendar & Timelines",
        desc: "Displays daily work blocks and schedules. If connected, Zenkai mirrors these blocks directly to your Google Calendar.",
        buttonText: "Next",
      },
      {
        title: "5. Psychological Identity",
        desc: "A reflection of your evolving character. Zenkai aggregates habits and cognitive styles into active identity traits.",
        buttonText: "Next",
      },
      {
        title: "6. Reflections & Insights",
        desc: "Here Zenkai holds reviews of your consistency and productivity, alongside reflections on your daily progress.",
        buttonText: "Next",
      },
      {
        title: "You're Ready!",
        desc: "Your elite personal executive assistant is set up and aligned. Enjoy your journey of focused growth.",
        buttonText: "Finish",
      },
    ];

    const current = steps[tourStep];

    return (
      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
        {/* Soft highlight overlay for the active tour steps */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-auto" />
        
        <div className="relative bg-card/95 border border-accent/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-accent rounded-full animate-ping" />
            <span className="text-[10px] tracking-widest text-accent uppercase font-bold">Zenkai Tour</span>
          </div>

          <div className="space-y-1.5 text-left">
            <h4 className="font-heading text-lg font-light text-foreground">{current.title}</h4>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">{current.desc}</p>
          </div>

          <div className="flex justify-between items-center pt-2">
            {tourStep > 0 && tourStep < 7 ? (
              <span className="text-[10px] font-mono text-muted-foreground">Step {tourStep} of 6</span>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              {tourStep < 7 && (
                <button
                  onClick={skipTour}
                  className="py-1.5 px-3 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Skip
                </button>
              )}
              <button
                onClick={nextTourStep}
                className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-[10px] font-semibold font-sans tracking-wide transition-colors cursor-pointer"
              >
                {current.buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Lifted User info states
  const [userName, setUserName] = useState(initialUser?.name || "");
  const [userEmail, setUserEmail] = useState(initialUser?.email || "");

  // Lifted Chat & Companion States
  const [activeConversation, setActiveConversation] = useState<{ _id: string; title?: string } | null>(null);
  const [messages, setMessages] = useState<{ _id: string; role: string; content: string; createdAt: Date }[]>([]);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [hasStartedChat, setHasStartedChat] = useState<boolean>(false);
  const [planningCardStats, setPlanningCardStats] = useState<{
    milestonesCreated: number;
    tasksCreated: number;
    agendaBuilt: boolean;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<any | null>(null);

  // Tracks the last plan version the frontend has acknowledged.
  // When the stream emits plan_version: N and N > lastKnownPlanVersion,
  // we increment planDataVersion to trigger re-fetches in Plans/Home screens.
  const [lastKnownPlanVersion, setLastKnownPlanVersion] = useState(0);
  const [planDataVersion, setPlanDataVersion] = useState(0);

  const [workflow, setWorkflow] = useState({
    memory: { status: "idle" as const, message: "Waiting..." },
    planning: { status: "idle" as const, message: "Waiting..." },
    execution: { status: "idle" as const, message: "Waiting..." },
    identity: { status: "idle" as const, message: "Waiting..." },
    reflection: { status: "idle" as const, message: "Waiting..." },
  });

  const onActionRespond = async (decision: "yes" | "no" | "later" | "replace" | "reorganize") => {
    if (!activeConversation) return;
    setOrbState("thinking");
    setStatusMessage("Applying decision...");

    try {
      const res = await fetch("/api/actions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          conversationId: activeConversation._id,
          actionId: pendingAction?._id
        })
      });

      if (!res.ok) {
        throw new Error("Confirmation request failed");
      }

      const data = await res.json();
      
      if (decision === "yes" || decision === "no" || decision === "replace" || decision === "reorganize") {
        setPendingAction(null);
      }

      setOrbState("completion");
      setStatusMessage("Done ✓");
      setTimeout(() => {
        setOrbState("idle");
        setStatusMessage("");
      }, 1000);

      // Re-fetch conversation history
      const historyRes = await fetch(`/api/chat/history?conversationId=${activeConversation._id}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        if (historyData.success) {
          setMessages(historyData.messages || []);
          setPendingAction(historyData.pendingAction || null);
        }
      }
    } catch (err) {
      console.error("Failed to respond to pending action:", err);
      setOrbState("idle");
      setStatusMessage("Response failed.");
    }
  };
  const refreshUserData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user?.name) setUserName(data.user.name);
        if (data.user?.email) setUserEmail(data.user.email);
      }
    } catch (err) {
      console.error("Failed to refresh user details:", err);
    }
  };
  // On mount: read onboardingCompleted from MongoDB (via /api/auth/me)
  // On mount: read onboardingCompleted and initialize theme settings
  useEffect(() => {
    async function checkOnboardingStatus() {
      if (onboardingCompleted !== null) return;
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setOnboardingCompleted(data.user?.onboardingCompleted === true);
          if (data.user?.name) setUserName(data.user.name);
          if (data.user?.email) setUserEmail(data.user.email);
        } else {
          window.location.href = "/login";
        }
      } catch {
        window.location.href = "/login";
      }
    }

    checkOnboardingStatus();

    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      const isDark = root.classList.contains("dark") || localStorage.getItem("theme") === "dark";
      setIsDarkMode(isDark);
      setThemeInitialized(true);

      const handleThemeChange = () => {
        setIsDarkMode(root.classList.contains("dark"));
      };

      window.addEventListener("theme-change", handleThemeChange);
      return () => window.removeEventListener("theme-change", handleThemeChange);
    }
  }, []);

  // Fetch active conversation and messages once onboarding is verified/complete
  useEffect(() => {
    async function loadActiveConversation() {
      try {
        const res = await fetch("/api/chat/history");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.conversation) {
            setActiveConversation(data.conversation);
            const loadedMessages = data.messages || [];
            setMessages(loadedMessages);
            setPendingAction(data.pendingAction || null);
            if (loadedMessages.length > 0) {
              setHasStartedChat(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load active conversation history:", err);
      }
    }

    if (onboardingCompleted) {
      loadActiveConversation();
    }
  }, [onboardingCompleted]);

  const handleOnboardingComplete = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user?.name) setUserName(data.user.name);
        if (data.user?.email) setUserEmail(data.user.email);
      }
    } catch (err) {
      console.error("Failed to fetch fresh user details after onboarding:", err);
    }

    setOnboardingCompleted(true);

    if (typeof window !== "undefined" && !localStorage.getItem("has_seen_tour")) {
      setTourStep(0);
      setCurrentScreen("home");
    }
  };

  // Shared send message handler
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Transition from Home screen to Companion Chat screen seamlessly
    if (currentScreen === "home") {
      setCurrentScreen("chat");
    }

    // 1. Append user's message locally
    const userTempId = `user-temp-${Date.now()}`;
    const userMsg = {
      _id: userTempId,
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setHasStartedChat(true);
    setOrbState("thinking");
    setStatusMessage("Understanding your request...");

    // 2. Append assistant's placeholder message
    const companionTempId = `companion-temp-${Date.now()}`;
    const companionMsg = {
      _id: companionTempId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, companionMsg]);

    try {
      // 3. POST request to endpoint
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          conversationId: activeConversation?._id || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }

      // Check header for updated conversation ID
      const returnedConvId = res.headers.get("x-conversation-id");
      if (returnedConvId && (!activeConversation || activeConversation._id !== returnedConvId)) {
        setActiveConversation({ _id: returnedConvId });
      }

      // 4. Read body stream chunk-by-chunk, parsing null-byte delimited control events
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamFinished = false;
      let accumulatedText = "";
      let rawBuffer = ""; // Buffer for parsing control events

      setOrbState("writing");
      setStatusMessage("Writing response...");

      while (!streamFinished && reader) {
        const { value, done } = await reader.read();
        if (done) {
          streamFinished = true;
          break;
        }

        const rawChunk = decoder.decode(value, { stream: true });
        rawBuffer += rawChunk;

        // Parse null-byte delimited control events out of buffer
        // Protocol: \0{json}\0 = control event; everything else = chat text
        let processedText = "";
        
        while (true) {
          const firstNull = rawBuffer.indexOf("\0");
          if (firstNull === -1) {
            // No control event starts here, the whole buffer is normal text
            processedText += rawBuffer;
            rawBuffer = "";
            break;
          }
          
          // There is a null byte. Text before it is normal text
          if (firstNull > 0) {
            processedText += rawBuffer.slice(0, firstNull);
            rawBuffer = rawBuffer.slice(firstNull);
          }
          
          // Now rawBuffer starts with \0. Look for the next \0
          const secondNull = rawBuffer.indexOf("\0", 1);
          if (secondNull === -1) {
            // The control event is incomplete. Leave it in rawBuffer and wait for more data.
            break;
          }
          
          // Complete control event found between index 0 and secondNull
          const jsonStr = rawBuffer.slice(1, secondNull);
          rawBuffer = rawBuffer.slice(secondNull + 1); // consume the event
          
          try {
            const event = JSON.parse(jsonStr);
            if (event.__type === "status") {
              setStatusMessage(event.message || "");
              // Dynamically adjust orb State and Workflow Status based on active backend agent
              if (event.agent) {
                setWorkflow((prev) => ({
                  ...prev,
                  [event.agent]: {
                    status: event.status,
                    message: event.message || "",
                  },
                }));

                // Map active running agent to orbState
                if (event.status === "running") {
                  const agentToOrbState: Record<string, OrbState> = {
                    memory: "memory_retrieval",
                    planning: "planning",
                    execution: "execution",
                    identity: "identity_update",
                    reflection: "reflection",
                  };
                  if (agentToOrbState[event.agent]) {
                    setOrbState(agentToOrbState[event.agent]);
                  }
                }
              }
            } else if (event.__type === "planning_complete") {
              setPlanningCardStats(event.stats);
            } else if (event.__type === "plan_version") {
              // Only re-fetch if version actually increased
              const incomingVersion = typeof event.version === "number" ? event.version : 0;
              if (incomingVersion > lastKnownPlanVersion) {
                setLastKnownPlanVersion(incomingVersion);
                setPlanDataVersion(incomingVersion); // triggers useEffect in Plans screen
                console.log(`[Shell] Plan version updated: ${lastKnownPlanVersion} → ${incomingVersion}. Triggering re-fetch.`);
              }
            }
          } catch {
            // Not valid JSON; treat as text
            processedText += `\0${jsonStr}\0`;
          }
        }

        if (processedText) {
          accumulatedText += processedText;
          // Update the streaming companion message in-place
          setMessages((prev) =>
            prev.map((m) =>
              m._id === companionTempId ? { ...m, content: accumulatedText } : m
            )
          );
        }
      }

      // Satisfying completion pulse animation
      setOrbState("completion");
      setStatusMessage("Done ✓");
      
      // Let the pulse play, then reset to idle
      setTimeout(() => {
        setOrbState("idle");
        setStatusMessage("");
      }, 1200);

      // 5. Fetch fresh canonical messages list with exact database IDs and timestamps
      const historyRes = await fetch("/api/chat/history" + (activeConversation ? `?conversationId=${activeConversation._id}` : ""));
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        if (historyData.success && historyData.conversation) {
          setActiveConversation(historyData.conversation);
          setMessages(historyData.messages || []);
          setPendingAction(historyData.pendingAction || null);
        }
      }
    } catch (err) {
      console.error("Error sending message to companion:", err);
      setOrbState("idle");
      setStatusMessage("Connection failed. Try again.");
      
      setMessages((prev) => prev.filter((m) => m._id !== companionTempId));
    }
  };

  // Sync theme with DOM and localStorage
  useEffect(() => {
    if (!themeInitialized) return;
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (isDarkMode) {
        root.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        root.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  }, [isDarkMode, themeInitialized]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleSelectConversation = async (id: string) => {
    setOrbState("thinking");
    setStatusMessage("Loading conversation...");
    try {
      const res = await fetch(`/api/chat/history?conversationId=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.conversation) {
          setActiveConversation(data.conversation);
          const loadedMessages = data.messages || [];
          setMessages(loadedMessages);
          setHasStartedChat(loadedMessages.length > 0);
          setCurrentScreen("chat");
        }
      }
    } catch (err) {
      console.error("Failed to select conversation:", err);
    } finally {
      setOrbState("idle");
      setStatusMessage("");
    }
  };

  const handleNewChat = async () => {
    setOrbState("thinking");
    setStatusMessage("Creating new chat...");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.conversation) {
          setActiveConversation(data.conversation);
          setMessages([]);
          setHasStartedChat(false);
          setCurrentScreen("chat");
        }
      }
    } catch (err) {
      console.error("Failed to create new conversation:", err);
    } finally {
      setOrbState("idle");
      setStatusMessage("");
    }
  };
  const changeScreen = (screen: ScreenType) => {
    setCurrentScreen(screen);
    if (screen === "home") {
      setActiveConversation(null);
      setMessages([]);
      setHasStartedChat(false);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return (
          <Home
            sendMessage={sendMessage}
            orbState={orbState}
            setOrbState={setOrbState}
            userName={userName}
            onNavigate={changeScreen}
          />
        );
      case "chat":
        return (
          <Chat
            messages={messages}
            sendMessage={sendMessage}
            orbState={orbState}
            statusMessage={statusMessage}
            setOrbState={setOrbState}
            userName={userName}
            workflow={workflow}
            onNavigate={changeScreen}
            pendingAction={pendingAction}
            onActionRespond={onActionRespond}
          />
        );
      case "plans":
        return <Plans planDataVersion={planDataVersion} />;
      case "tasks":
        return <Tasks userName={userName} />;
      case "identity":
        return <You userName={userName} initialTab="identity" onNavigate={changeScreen} />;
      case "reflection":
        return <You userName={userName} initialTab="reflection" onNavigate={changeScreen} />;
      case "you":
        return <You userName={userName} initialTab="overview" onNavigate={changeScreen} />;
      case "settings":
        return null;
      case "memory":
        return <MemoryDebug />;
      default:
        return (
          <Home
            sendMessage={sendMessage}
            orbState={orbState}
            setOrbState={setOrbState}
            userName={userName}
            onNavigate={changeScreen}
          />
        );
    }
  };

  if (onboardingCompleted === null) {
    return <div className="h-screen w-full bg-background" />;
  }

  if (!onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-background flex text-foreground transition-colors duration-300">
      {/* Navigation Left Sidebar */}
      <Sidebar 
        currentScreen={currentScreen} 
        onScreenChange={changeScreen} 
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        activeConversationId={activeConversation?._id}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        userName={userName}
        userEmail={userEmail}
        openSettingsModal={(tab) => {
          setActiveSettingsTab(tab);
          setIsSettingsOpen(true);
        }}
        onSignOut={async () => {
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
          } catch (e) {
            console.error("Signout error from sidebar trigger:", e);
          }
        }}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 h-screen max-h-screen overflow-hidden overflow-x-hidden pl-14 md:pl-16 transition-all duration-300">
        <div className="w-full h-full relative overflow-hidden">
          {renderScreen()}
        </div>
      </main>

      {/* Product Tour Overlay */}
      {tourStep !== null && renderTourStep()}

      {/* Global Center Overlay Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTab={activeSettingsTab}
        setActiveTab={setActiveSettingsTab}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        userName={userName}
        userEmail={userEmail}
        onRefreshUser={refreshUserData}
      />
    </div>
  );
}
