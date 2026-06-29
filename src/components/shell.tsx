"use client";

import React, { useState, useEffect } from "react";
import Sidebar, { ScreenType } from "./sidebar";
import Home from "./screens/home";
import Chat from "./screens/chat";
import Tasks from "./screens/tasks";
import Identity from "./screens/identity";
import Reflection from "./screens/reflection";
import Settings from "./screens/settings";
import Onboarding, { OnboardingData } from "./onboarding";
import MemoryDebug from "./screens/memory-debug";
import Plans from "./screens/plans";

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
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [themeInitialized, setThemeInitialized] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(
    initialUser ? initialUser.onboardingCompleted : null
  );

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

  const handleOnboardingComplete = async (onboardingData: OnboardingData) => {
    if (onboardingData.name) {
      setUserName(onboardingData.name);
    }
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingData),
      });

      if (!res.ok) {
        console.error("Failed to save onboarding data:", await res.text());
      }
    } catch (err) {
      console.error("Onboarding persistence error:", err);
    }

    setOnboardingCompleted(true);
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
      const historyRes = await fetch("/api/chat/history");
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        if (historyData.success && historyData.conversation) {
          setActiveConversation(historyData.conversation);
          setMessages(historyData.messages || []);
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
          />
        );
      case "plans":
        return <Plans planDataVersion={planDataVersion} />;
      case "tasks":
        return <Tasks userName={userName} />;
      case "identity":
        return <Identity />;
      case "reflection":
        return <Reflection userName={userName} />;
      case "settings":
        return <Settings />;
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
      />
      
      {/* Main Content Area */}
      <main className="flex-1 h-screen max-h-screen overflow-hidden overflow-x-hidden pl-14 md:pl-16 transition-all duration-300">
        <div className="w-full h-full relative overflow-hidden">
          {renderScreen()}
        </div>
      </main>
    </div>
  );
}
