"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart3,
  Trophy,
  Dumbbell,
  Zap,
  Plus,
  Search,
  PanelLeft,
  X,
  SendHorizontal,
} from "lucide-react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import Logo from "./Logo";
import NiceAvatar, { genConfig } from "react-nice-avatar";
import { ClaudeLogo, OpenAILogo, GeminiLogo } from "./ProviderLogos";
import { buildWorkoutContext, CHEVY_SYSTEM_PROMPT } from "@/lib/context";
import type { Provider } from "@/lib/providers";
import { PROVIDERS, getSavedProvider, saveProvider } from "@/lib/providers";

const USER_AVATAR_CONFIG = genConfig({ sex: "man", hairStyle: "thick", shirtStyle: "polo", bgColor: "#6366f1" });

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  claude: <ClaudeLogo size={16} />,
  openai: <OpenAILogo size={16} />,
  gemini: <GeminiLogo size={16} />,
};

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const CONVERSATIONS_KEY = "hevy_conversations";

const PRESET_QUESTIONS = [
  { icon: BarChart3, title: "Analyze Training", desc: "Break down my volume, frequency, and muscle balance" },
  { icon: Trophy, title: "Find My PRs", desc: "Show my personal records across all exercises" },
  { icon: Dumbbell, title: "Build a Workout", desc: "Create a session based on my training history" },
  { icon: Zap, title: "Check Fatigue", desc: "Analyze my recovery and overtraining risk" },
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function groupByDate(convos: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of convos) {
    if (c.updatedAt >= today) groups[0].items.push(c);
    else if (c.updatedAt >= yesterday) groups[1].items.push(c);
    else if (c.updatedAt >= week) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function ChatBot({
  workouts,
  templates,
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Provider state
  const [provider, setProvider] = useState<Provider>("claude");
  const [providerKey, setProviderKey] = useState("");
  const [showProviderSetup, setShowProviderSetup] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConvo = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );
  const messages = activeConvo?.messages ?? [];

  // Load conversations + provider from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    if (stored) {
      try {
        const parsed: Conversation[] = JSON.parse(stored);
        setConversations(parsed.sort((a, b) => b.updatedAt - a.updatedAt));
      } catch { /* ignore */ }
    }
    const saved = getSavedProvider();
    if (saved) {
      setProvider(saved.provider);
      setProviderKey(saved.apiKey);
    } else {
      setShowProviderSetup(true);
    }
  }, []);

  // Save conversations
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Build workout context for system prompt
  const workoutContext = useMemo(
    () => buildWorkoutContext(workouts, templates),
    [workouts, templates]
  );

  const isReady = !!providerKey && workouts.length > 0;

  const handleSaveProvider = useCallback(() => {
    if (providerKey.trim()) {
      saveProvider(provider, providerKey.trim());
      setShowProviderSetup(false);
    }
  }, [provider, providerKey]);

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => {
        const updated = prev.map((c) => (c.id === id ? updater(c) : c));
        return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      });
    },
    []
  );

  const newChat = useCallback(() => {
    setActiveId(null);
    setInput("");
    setStreamingText("");
  }, []);

  const deleteConvo = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), timestamp: Date.now() };

    let convoId = activeId;
    let newMessages: Message[];

    if (!convoId) {
      // Create new conversation
      const id = generateId();
      const title = text.trim().slice(0, 60);
      const convo: Conversation = {
        id,
        title,
        messages: [userMsg],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations((prev) => [convo, ...prev]);
      setActiveId(id);
      convoId = id;
      newMessages = [userMsg];
    } else {
      newMessages = [...messages, userMsg];
      updateConversation(convoId, (c) => ({
        ...c,
        messages: newMessages,
        updatedAt: Date.now(),
      }));
    }

    setInput("");
    setLoading(true);
    setStreamingText("");

    try {
      const systemPrompt = CHEVY_SYSTEM_PROMPT + workoutContext;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: providerKey,
          model: PROVIDERS[provider].defaultModel,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          system: systemPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) { fullText += parsed.text; setStreamingText(fullText); }
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      const assistantMsg: Message = { role: "assistant", content: fullText, timestamp: Date.now() };
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...newMessages, assistantMsg],
        updatedAt: Date.now(),
      }));
      setStreamingText("");
    } catch (e) {
      const errMsg: Message = {
        role: "assistant",
        content: `Error: ${e instanceof Error ? e.message : "Failed to get response"}`,
        timestamp: Date.now(),
      };
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...newMessages, errMsg],
        updatedAt: Date.now(),
      }));
      setStreamingText("");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const filteredConvos = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const groups = useMemo(() => groupByDate(filteredConvos), [filteredConvos]);
  const isWelcome = !activeId;

  return (
    <div className="chat-layout">
      {/* Chat History Sidebar */}
      <div className={`chat-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="chat-sidebar-header">
          <button onClick={newChat} className="chat-new-btn">
            <Plus size={14} strokeWidth={2.5} />
            New chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="chat-sidebar-toggle"
            title="Close sidebar"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        <div className="chat-sidebar-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chat-sidebar-list">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="chat-sidebar-label">{group.label}</div>
              {group.items.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`chat-sidebar-item ${c.id === activeId ? "active" : ""}`}
                >
                  <span className="chat-sidebar-item-title">{c.title}</span>
                  <button
                    className="chat-sidebar-item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConvo(c.id);
                    }}
                    title="Delete"
                  >
                    <X size={12} />
                  </button>
                </button>
              ))}
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="chat-sidebar-empty">No conversations yet</div>
          )}
        </div>

        <div className="chat-sidebar-footer">
          <button
            onClick={() => setShowProviderSetup(true)}
            className="chat-sidebar-status"
            style={{ cursor: "pointer", background: "none", border: "none", padding: 0, width: "100%" }}
          >
            <div className="flex items-center gap-1.5">
              {PROVIDER_ICONS[provider]}
              <span className="text-[12px] text-[var(--text-secondary)]">{PROVIDERS[provider].name}</span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">{workouts.length} workouts</span>
          </button>
        </div>
      </div>

      {/* Collapsed sidebar toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="chat-sidebar-open-btn"
          title="Open sidebar"
        >
          <PanelLeft size={16} />
        </button>
      )}

      {/* Main Chat Area */}
      <div className={`chat-main ${sidebarOpen ? "with-sidebar" : "full"}`}>
        {isWelcome ? (
          /* ═══ Welcome Screen ═══ */
          <div className="chat-welcome">
            <div className="chat-welcome-inner">
              {/* Chevy avatar */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{
                background: "linear-gradient(135deg, rgba(79,156,247,0.15), rgba(79,156,247,0.05))",
                boxShadow: "0 4px 20px rgba(79,156,247,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}>
                <Logo size={40} />
              </div>

              <p className="chat-welcome-sub">Chevy</p>
              <h2 className="chat-welcome-title">How can I help with your training?</h2>

              {/* Input */}
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="chat-welcome-input"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={loading || !isReady}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim() || !isReady}
                  className="chat-send-btn"
                >
                  <SendHorizontal size={16} strokeWidth={2.5} />
                </button>
              </form>

              {/* Preset Cards */}
              <div className="chat-presets">
                {PRESET_QUESTIONS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => send(p.desc)}
                    disabled={loading || !isReady}
                    className="chat-preset-card"
                  >
                    <span className="chat-preset-icon"><p.icon size={18} /></span>
                    <span className="chat-preset-title">{p.title}</span>
                    <span className="chat-preset-desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ═══ Active Conversation ═══ */
          <div className="chat-convo">
            {/* Conversation Header */}
            <div className="chat-convo-header">
              <h3>{activeConvo?.title}</h3>
              <button onClick={newChat} className="chat-convo-new" title="New chat">
                <Plus size={16} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  {m.role === "assistant" && (
                    <div className="chat-msg-avatar">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{
                        background: "linear-gradient(135deg, rgba(79,156,247,0.18), rgba(79,156,247,0.06))",
                        boxShadow: "0 2px 8px rgba(79,156,247,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                      }}>
                        <Logo size={16} />
                      </div>
                    </div>
                  )}
                  <div className={`chat-msg-bubble ${m.role}`}>
                    {m.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="chat-msg-avatar">
                      <NiceAvatar style={{ width: "28px", height: "28px" }} {...USER_AVATAR_CONFIG} />
                    </div>
                  )}
                </div>
              ))}

              {streamingText && (
                <div className="chat-msg assistant">
                  <div className="chat-msg-avatar">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{
                      background: "linear-gradient(135deg, rgba(79,156,247,0.18), rgba(79,156,247,0.06))",
                      boxShadow: "0 2px 8px rgba(79,156,247,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}>
                      <Logo size={16} />
                    </div>
                  </div>
                  <div className="chat-msg-bubble assistant">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  </div>
                </div>
              )}

              {loading && !streamingText && (
                <div className="chat-msg assistant">
                  <div className="chat-msg-avatar">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{
                      background: "linear-gradient(135deg, rgba(79,156,247,0.18), rgba(79,156,247,0.06))",
                      boxShadow: "0 2px 8px rgba(79,156,247,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}>
                      <Logo size={16} />
                    </div>
                  </div>
                  <div className="chat-msg-bubble assistant">
                    <div className="flex gap-1 items-center py-1">
                      <span className="typing-dot" />
                      <span className="typing-dot [animation-delay:150ms]" />
                      <span className="typing-dot [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="chat-input-bar">
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="chat-input-form"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your workouts..."
                  disabled={loading || !isReady}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim() || !isReady}
                  className="chat-send-btn"
                >
                  <SendHorizontal size={16} strokeWidth={2.5} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Provider Setup Modal */}
      {showProviderSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{
            background: "rgba(17, 17, 17, 0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Connect AI Provider</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Choose your AI provider and enter your API key. Keys are stored locally in your browser.</p>
            </div>

            {/* Provider selector */}
            <div className="flex gap-2">
              {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: provider === p ? "rgba(79,156,247,0.12)" : "rgba(255,255,255,0.03)",
                    border: provider === p ? "1px solid rgba(79,156,247,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {PROVIDER_ICONS[p]}
                  <span className={provider === p ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>
                    {PROVIDERS[p].name}
                  </span>
                </button>
              ))}
            </div>

            {/* API key input */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">
                {PROVIDERS[provider].name} API Key
              </label>
              <input
                type="password"
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                placeholder={PROVIDERS[provider].placeholder}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(79,156,247,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            {/* Model info */}
            <p className="text-[10px] text-[var(--text-muted)]">
              Model: {PROVIDERS[provider].defaultModel}
            </p>

            {/* Buttons */}
            <div className="flex gap-2">
              {providerKey && (
                <button
                  onClick={() => setShowProviderSetup(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs text-[var(--text-muted)] transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveProvider}
                disabled={!providerKey.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white transition-all disabled:opacity-20"
                style={{
                  background: "linear-gradient(180deg, #5aa3f9 0%, #3b7dd8 50%, #2e6bc0 100%)",
                  boxShadow: "0 4px 12px rgba(79,156,247,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 0 rgba(0,0,0,0.15)",
                }}
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
