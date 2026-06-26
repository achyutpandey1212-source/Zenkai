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

import { OrbState } from "./ui/companion-orb";

interface ShellProps {
  initialUser?: {
    name: string;
    email: string;
    firebaseUid: string;
  } | null;
}

export default function Shell({ initialUser }: ShellProps) {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Lifted User info states
  const [userName, setUserName] = useState(initialUser?.name || "");
  const [userEmail, setUserEmail] = useState(initialUser?.email || "");

  // Lifted Chat & Companion States
  const [activeConversation, setActiveConversation] = useState<{ _id: string; title?: string } | null>(null);
  const [messages, setMessages] = useState<{ _id: string; role: string; content: string; createdAt: Date }[]>([]);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [hasStartedChat, setHasStartedChat] = useState<boolean>(false);

  // On mount: read onboardingCompleted from MongoDB (via /api/auth/me)
  // This ensures each Firebase account has its own onboarding status —
  // not shared via localStorage across accounts on the same browser.
  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setOnboardingCompleted(data.user?.onboardingCompleted === true);
          if (data.user?.name) setUserName(data.user.name);
          if (data.user?.email) setUserEmail(data.user.email);
        } else {
          // If not authenticated, the layout already redirected — default to false
          setOnboardingCompleted(false);
        }
      } catch {
        setOnboardingCompleted(false);
      }
    }

    checkOnboardingStatus();

    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      const isDark = root.classList.contains("dark");
      Promise.resolve().then(() => {
        setIsDarkMode(isDark);
      });

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
      // Persist onboarding data to MongoDB
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

    // Update state regardless so the user isn't blocked if a network error occurs
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

      // 4. Read body stream chunk-by-chunk
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamFinished = false;
      let accumulatedText = "";

      setOrbState("writing");
      setStatusMessage("Writing response...");

      while (!streamFinished && reader) {
        const { value, done } = await reader.read();
        if (done) {
          streamFinished = true;
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        accumulatedText += chunkText;

        // Update the streaming companion message in-place
        setMessages((prev) =>
          prev.map((m) =>
            m._id === companionTempId ? { ...m, content: accumulatedText } : m
          )
        );
      }

      // Reset Companion status
      setOrbState("idle");
      setStatusMessage("");

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
      
      // Clean up the empty assistant message in case of failure
      setMessages((prev) => prev.filter((m) => m._id !== companionTempId));
    }
  };

  // Sync theme with DOM and localStorage
  useEffect(() => {
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
  }, [isDarkMode]);

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

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return (
          <Home
            messages={messages}
            sendMessage={sendMessage}
            orbState={orbState}
            statusMessage={statusMessage}
            hasStartedChat={hasStartedChat}
            setOrbState={setOrbState}
            userName={userName}
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
          />
        );
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
            messages={messages}
            sendMessage={sendMessage}
            orbState={orbState}
            statusMessage={statusMessage}
            hasStartedChat={hasStartedChat}
            setOrbState={setOrbState}
            userName={userName}
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
        onScreenChange={setCurrentScreen} 
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
