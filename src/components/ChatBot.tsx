"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart3,
  Trophy,
  Dumbbell,
  Zap,
  Target,
  Plus,
  Search,
  PanelLeft,
  X,
  SendHorizontal,
  Key,
  ExternalLink,
} from "lucide-react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import Logo from "./Logo";
import NiceAvatar from "react-nice-avatar";
import { ClaudeLogo, OpenAILogo, GeminiLogo, PROVIDER_COLORS } from "./ProviderLogos";
import { buildWorkoutContext, CHEVY_SYSTEM_PROMPT } from "@/lib/context";
import type { Provider } from "@/lib/providers";
import { PROVIDERS, getSavedProvider, saveProvider } from "@/lib/providers";

const USER_AVATAR_CONFIG = {
  sex: "man" as const, faceColor: "#F9C9B6", earSize: "small" as const, eyeStyle: "smile" as const,
  noseStyle: "long" as const, mouthStyle: "smile" as const, shirtStyle: "polo" as const,
  glassesStyle: "none" as const, hairColor: "#000", hairStyle: "thick" as const,
  hatStyle: "none" as const, hatColor: "#000", shirtColor: "#6366f1", bgColor: "#6366f1",
};

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  claude: <ClaudeLogo size={16} />,
  openai: <OpenAILogo size={16} />,
  gemini: <GeminiLogo size={16} />,
};

const PROVIDER_ICONS_LG: Record<Provider, React.ReactNode> = {
  claude: <ClaudeLogo size={28} />,
  openai: <OpenAILogo size={28} />,
  gemini: <GeminiLogo size={28} />,
};

const PROVIDER_META: Record<Provider, { tagline: string; keyUrl: string }> = {
  claude: {
    tagline: "Anthropic's most capable model",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    tagline: "OpenAI's flagship model",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  gemini: {
    tagline: "Google's multimodal AI",
    keyUrl: "https://aistudio.google.com/apikey",
  },
};

type ConvoMode = "chat" | "plan";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  mode: ConvoMode;
  createdAt: number;
  updatedAt: number;
}

const CONVERSATIONS_KEY = "hevy_conversations";

const PLAN_SYSTEM_PROMPT = `You are Chevy, a world-class personal trainer and nutrition coach. Your job is to learn about the user and build them a completely personalized workout and lifestyle plan.

## Your approach

**Phase 1 — Learn about them (2-4 messages)**
After the user shares their initial info, ask focused follow-up questions about gaps. Don't ask everything at once — pick the 2-3 most important unknowns. Be conversational, not clinical.

Topics to understand (ask naturally, not as a checklist):
- Primary goal (build muscle, lose fat, get stronger, sport-specific, general health)
- Training experience level and how long they've been lifting
- How many days/week they can train, and how long per session
- Equipment access (full gym, home gym, dumbbells only, bodyweight)
- Any injuries, limitations, or exercises they can't do
- Diet situation (do they cook, eat out, meal prep, dietary restrictions, rough calorie awareness)
- Sleep habits and stress level
- What they've tried before and what worked/didn't
- Current body comp goals (if relevant)
- Any specific exercises or muscle groups they care about most

**Phase 2 — Generate the plan**
Once you have enough info (don't over-ask), generate a COMPLETE plan with:

### The Plan Format

**WEEKLY SCHEDULE**
- Day-by-day breakdown (e.g., Mon: Upper, Tue: Rest, Wed: Lower...)
- Exactly which exercises, sets, reps, and rest periods
- Use weights in lbs — reference their actual PRs/history when available
- Include warm-up suggestions

**PROGRESSION**
- How to increase weight/reps week to week
- When to deload
- How to track progress

**NUTRITION GUIDELINES** (practical, not preachy)
- Rough daily calorie and protein target based on their goal
- Simple meal ideas that fit their lifestyle (eating out? give restaurant-friendly options)
- Meal timing around workouts if relevant
- Hydration

**RECOVERY**
- Rest day recommendations
- Sleep targets
- Stretching/mobility if needed

**REALISTIC TIMELINE**
- What results to expect in 4, 8, and 12 weeks
- How to adjust the plan as they progress

## Rules
- Be direct and specific — no generic advice. Every recommendation should be tailored.
- Use their actual workout data when available to set starting weights.
- If they eat out a lot, don't tell them to meal prep everything — give them practical options.
- Keep it conversational and encouraging, not overwhelming.
- Use markdown formatting with clear headers and tables.
- When you have enough info, say "I've got everything I need — here's your plan:" and deliver it.
- If user data is available, reference their PRs, frequency, and exercise selection.`;

const PRESET_QUESTIONS: { icon: typeof BarChart3; title: string; desc: string; mode: ConvoMode }[] = [
  { icon: Target, title: "Build My Plan", desc: "I want to build a personalized workout and nutrition plan based on my goals", mode: "plan" },
  { icon: BarChart3, title: "Analyze Training", desc: "Break down my volume, frequency, and muscle balance", mode: "chat" },
  { icon: Trophy, title: "Find My PRs", desc: "Show my personal records across all exercises", mode: "chat" },
  { icon: Dumbbell, title: "Build a Workout", desc: "Create a session based on my training history", mode: "chat" },
  { icon: Zap, title: "Check Fatigue", desc: "Analyze my recovery and overtraining risk", mode: "chat" },
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
        const migrated = parsed.map((c) => ({ ...c, mode: c.mode ?? "chat" as ConvoMode }));
        setConversations(migrated.sort((a, b) => b.updatedAt - a.updatedAt));
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

  const send = async (text: string, mode?: ConvoMode) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), timestamp: Date.now() };

    let convoId = activeId;
    let convoMode: ConvoMode = mode ?? activeConvo?.mode ?? "chat";
    let newMessages: Message[];

    if (!convoId) {
      const id = generateId();
      const title = convoMode === "plan" ? "My Training Plan" : text.trim().slice(0, 60);
      const convo: Conversation = {
        id,
        title,
        messages: [userMsg],
        mode: convoMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations((prev) => [convo, ...prev]);
      setActiveId(id);
      convoId = id;
      newMessages = [userMsg];
    } else {
      convoMode = activeConvo?.mode ?? "chat";
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
      const basePrompt = convoMode === "plan" ? PLAN_SYSTEM_PROMPT : CHEVY_SYSTEM_PROMPT;
      const systemPrompt = basePrompt + workoutContext;

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
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveId(c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") setActiveId(c.id); }}
                  className={`chat-sidebar-item ${c.id === activeId ? "active" : ""}`}
                >
                  <span className="chat-sidebar-item-title">
                    {c.mode === "plan" && <Target size={11} className="inline mr-1 opacity-50" />}
                    {c.title}
                  </span>
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
                </div>
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
          /* Welcome Screen */
          <div className="chat-welcome">
            <div className="chat-welcome-inner">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{
                background: "linear-gradient(135deg, rgba(79,156,247,0.15), rgba(79,156,247,0.05))",
                boxShadow: "0 4px 20px rgba(79,156,247,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}>
                <Logo size={40} />
              </div>

              <p className="chat-welcome-sub">Chevy</p>
              <h2 className="chat-welcome-title">How can I help with your training?</h2>

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

              <div className="chat-presets">
                {PRESET_QUESTIONS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => send(p.desc, p.mode)}
                    disabled={loading || !isReady}
                    className={`chat-preset-card ${p.mode === "plan" ? "preset-plan" : ""}`}
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
          /* Active Conversation */
          <div className="chat-convo">
            <div className="chat-convo-header">
              <h3>
                {activeConvo?.mode === "plan" && <Target size={14} className="inline mr-1.5 opacity-60" />}
                {activeConvo?.title}
              </h3>
              <button onClick={newChat} className="chat-convo-new" title="New chat">
                <Plus size={16} />
              </button>
            </div>

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

            <div className="chat-input-bar">
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="chat-input-form"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={activeConvo?.mode === "plan" ? "Tell me about your goals, schedule, diet..." : "Ask about your workouts..."}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{
            background: "rgba(17, 17, 17, 0.97)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{
                background: "linear-gradient(135deg, rgba(79,156,247,0.15), rgba(79,156,247,0.05))",
                boxShadow: "0 4px 20px rgba(79,156,247,0.15)",
              }}>
                <Logo size={24} />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)]">Set up Chevy</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
                Bring your own API key to power your workout AI. Pick a provider below — your key stays in your browser.
              </p>
            </div>

            <div className="space-y-2">
              {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
                const selected = provider === p;
                const colors = PROVIDER_COLORS[p];
                return (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: selected ? colors.bg : "rgba(255,255,255,0.02)",
                      border: selected ? `1px solid ${colors.border}` : "1px solid rgba(255,255,255,0.05)",
                      boxShadow: selected ? `0 0 20px ${colors.glow}` : "none",
                    }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                      background: selected ? colors.bg : "rgba(255,255,255,0.04)",
                      color: selected ? colors.primary : "var(--text-muted)",
                    }}>
                      {PROVIDER_ICONS_LG[p]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: selected ? colors.primary : "var(--text-primary)" }}>
                          {PROVIDERS[p].name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "var(--text-muted)",
                        }}>
                          {PROVIDERS[p].defaultModel}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {PROVIDER_META[p].tagline}
                      </p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{
                      borderColor: selected ? colors.primary : "rgba(255,255,255,0.15)",
                    }}>
                      {selected && (
                        <div className="w-2 h-2 rounded-full" style={{ background: colors.primary }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Key size={12} />
                  API Key
                </label>
                <a
                  href={PROVIDER_META[provider].keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] flex items-center gap-1 hover:underline"
                  style={{ color: PROVIDER_COLORS[provider].primary }}
                >
                  Get a key <ExternalLink size={9} />
                </a>
              </div>
              <input
                type="password"
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                placeholder={PROVIDERS[provider].placeholder}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(255,255,255,0.08)`,
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = PROVIDER_COLORS[provider].border}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                onKeyDown={(e) => { if (e.key === "Enter" && providerKey.trim()) handleSaveProvider(); }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {providerKey && (
                <button
                  onClick={() => setShowProviderSetup(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs text-[var(--text-muted)] transition-all hover:bg-[rgba(255,255,255,0.04)]"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveProvider}
                disabled={!providerKey.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-20"
                style={{
                  background: `linear-gradient(180deg, ${PROVIDER_COLORS[provider].primary}dd 0%, ${PROVIDER_COLORS[provider].primary} 100%)`,
                  boxShadow: `0 4px 16px ${PROVIDER_COLORS[provider].glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                }}
              >
                Connect {PROVIDERS[provider].name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
