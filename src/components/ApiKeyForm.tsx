"use client";

import { useState } from "react";
import Body from "react-muscle-highlighter";
import Logo from "./Logo";
import { ArrowRight } from "lucide-react";
import { User } from "lucide-react";

const VOL_DATA = [
  { v: 42, d: "M" }, { v: 68, d: "T" }, { v: 55, d: "W" }, { v: 73, d: "T" },
  { v: 48, d: "F" }, { v: 82, d: "S" }, { v: 61, d: "S" }, { v: 90, d: "M" },
  { v: 52, d: "T" }, { v: 78, d: "W" }, { v: 95, d: "T" }, { v: 70, d: "F" },
];

const FRONT_MUSCLES = [
  { slug: "chest" as const, color: "#5eaaff", intensity: 3 },
  { slug: "deltoids" as const, color: "#7bbfff", intensity: 2 },
  { slug: "abs" as const, color: "#5eaaff", intensity: 2 },
  { slug: "quadriceps" as const, color: "#7bbfff", intensity: 3 },
  { slug: "biceps" as const, color: "#5eaaff", intensity: 1 },
  { slug: "forearm" as const, color: "#7bbfff", intensity: 1 },
  { slug: "obliques" as const, color: "#5eaaff", intensity: 1 },
];

const BACK_MUSCLES = [
  { slug: "upper-back" as const, color: "#5eaaff", intensity: 3 },
  { slug: "trapezius" as const, color: "#7bbfff", intensity: 2 },
  { slug: "gluteal" as const, color: "#5eaaff", intensity: 2 },
  { slug: "hamstring" as const, color: "#7bbfff", intensity: 3 },
  { slug: "triceps" as const, color: "#5eaaff", intensity: 1 },
  { slug: "lower-back" as const, color: "#7bbfff", intensity: 2 },
  { slug: "calves" as const, color: "#5eaaff", intensity: 1 },
];

const TILE = {
  background: "linear-gradient(168deg, rgba(22, 22, 22, 0.95) 0%, rgba(14, 14, 14, 0.98) 100%)",
  border: "1px solid rgba(255,255,255,0.05)",
  boxShadow: "0 2px 4px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)",
};

export default function ApiKeyForm({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState("");
  const maxVol = Math.max(...VOL_DATA.map((d) => d.v));

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#060606" }}>
      {/* Banner */}
      <div className="text-center py-1.5 text-[11px] font-medium tracking-wide flex-shrink-0" style={{
        background: "linear-gradient(90deg, rgba(79,156,247,0.08) 0%, rgba(79,156,247,0.14) 50%, rgba(79,156,247,0.08) 100%)",
        borderBottom: "1px solid rgba(79,156,247,0.1)",
        color: "rgba(160,200,255,0.75)",
      }}>
        Currently only available for Hevy Pro subscribers
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 flex flex-col max-w-[1400px] w-full mx-auto px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span className="text-sm font-medium tracking-wide">HEVY<span className="text-[var(--text-muted)] font-normal ml-0.5">AGENT</span></span>
          </div>
          <a href="https://hevy.com/settings?developer" target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Get API Key &rarr;
          </a>
        </nav>

        {/* Hero row — headline, form, body diagrams */}
        <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center py-6">
          <div>
            <h1 className="text-[clamp(2rem,4vw,2.8rem)] font-medium leading-[1.08] tracking-tight text-[var(--text-primary)]">
              Your training, measured.
            </h1>
            <p className="mt-3 text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-md">
              Connect your Hevy account. Meet Chevy — an AI coach that knows your workout history, tracks your PRs, and gives you real recommendations.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (key.trim()) onSubmit(key.trim()); }}
              className="mt-5 flex gap-2 max-w-sm">
              <input
                type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="API key"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
              <button type="submit" disabled={!key.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-20"
                style={{
                  background: "linear-gradient(180deg, #5aa3f9 0%, #3b7dd8 50%, #2e6bc0 100%)",
                  boxShadow: "0 4px 12px rgba(79,156,247,0.3), 0 1px 0 rgba(255,255,255,0.15) inset",
                }}>
                Connect <ArrowRight size={14} />
              </button>
            </form>
            <p className="mt-2 text-[10px] text-[var(--text-muted)]">Your key stays in your browser. Nothing is stored on a server.</p>
            <div className="flex items-center gap-5 mt-5">
              {["Volume tracking", "PR detection", "AI coach", "Muscle balance"].map((t) => (
                <span key={t} className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] opacity-60" />{t}
                </span>
              ))}
            </div>
          </div>
          {/* Body diagrams */}
          <div className="relative hidden lg:flex items-start gap-2">
            <Body data={FRONT_MUSCLES} side="front" gender="male" scale={0.7} border="none"
              defaultFill="rgba(255,255,255,0.04)" defaultStroke="rgba(255,255,255,0.12)" defaultStrokeWidth={0.5} />
            <Body data={BACK_MUSCLES} side="back" gender="male" scale={0.7} border="none"
              defaultFill="rgba(255,255,255,0.04)" defaultStroke="rgba(255,255,255,0.12)" defaultStrokeWidth={0.5} />
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at center, transparent 55%, #060606 90%)",
            }} />
          </div>
        </div>

        {/* Bento grid — fills remaining space */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 pb-4">
          {/* Volume chart — left tall */}
          <div className="col-span-4 rounded-2xl p-5 flex flex-col" style={TILE}>
            <div className="text-[14px] text-[var(--text-secondary)] mb-1">Weekly volume</div>
            <div className="text-[11px] text-[var(--text-muted)] mb-4">Last 12 sessions &middot; lbs lifted per day</div>
            <div className="flex-1 flex items-end gap-1.5 min-h-0">
              {VOL_DATA.map((d, i) => {
                const pct = (d.v / maxVol) * 100;
                const isHighlight = i === VOL_DATA.length - 3;
                const baseAlpha = 0.3 + (d.v / maxVol) * 0.35;
                return (
                  <div key={i} className="flex-1 relative rounded-md transition-all" style={{
                    height: `${Math.max(pct, 6)}%`,
                    background: isHighlight
                      ? "linear-gradient(to top, rgba(79,156,247,0.5), rgba(79,156,247,0.95))"
                      : `linear-gradient(to top, rgba(79,156,247,0.08), rgba(79,156,247,${baseAlpha}))`,
                    boxShadow: isHighlight ? "0 0 14px rgba(79,156,247,0.35)" : "none",
                  }} />
                );
              })}
            </div>
            <div className="flex gap-1.5 mt-2">
              {VOL_DATA.map((d, i) => (
                <div key={i} className="flex-1 text-center text-[10px] text-[var(--text-muted)]">{d.d}</div>
              ))}
            </div>
          </div>

          {/* Stats 2x2 — center top */}
          <div className="col-span-4 grid grid-cols-2 gap-3">
            {[
              { val: "91", label: "workouts logged", sub: "since Jan 2025" },
              { val: "3.4x", label: "per week avg", sub: "last 12 weeks" },
              { val: "6.8k", label: "lbs avg session", sub: "total volume / sessions" },
              { val: "1h 22m", label: "avg duration", sub: "rest time included" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-5 flex flex-col justify-center" style={TILE}>
                <div className="text-3xl font-medium text-[var(--text-primary)] leading-none">{s.val}</div>
                <div className="text-[13px] text-[var(--text-secondary)] mt-2">{s.label}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* PRs — right tall */}
          <div className="col-span-4 rounded-2xl p-5 flex flex-col" style={TILE}>
            <div className="text-[14px] text-[var(--text-secondary)] mb-1">Recent PRs</div>
            <div className="text-[11px] text-[var(--text-muted)] mb-4">All-time personal records</div>
            <div className="flex-1 flex flex-col justify-center gap-5">
              {[
                { name: "Bench Press", w: "225 lbs", r: "x5", date: "Mar 12" },
                { name: "Squat", w: "315 lbs", r: "x3", date: "Mar 8" },
                { name: "Deadlift", w: "405 lbs", r: "x1", date: "Feb 28" },
                { name: "OHP", w: "155 lbs", r: "x4", date: "Mar 15" },
                { name: "Barbell Row", w: "225 lbs", r: "x6", date: "Mar 10" },
              ].map((pr) => (
                <div key={pr.name} className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[15px] text-[var(--text-secondary)]">{pr.name}</span>
                    <span className="text-[11px] text-[var(--text-muted)] ml-2">{pr.date}</span>
                  </div>
                  <div>
                    <span className="text-[15px] font-medium text-[var(--text-primary)]">{pr.w}</span>
                    <span className="text-[13px] text-[var(--text-muted)] ml-1">{pr.r}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat — bottom wide */}
          <div className="col-span-8 rounded-2xl p-5 flex flex-col" style={TILE}>
            <div className="text-[14px] text-[var(--text-secondary)] mb-1">Chevy</div>
            <div className="text-[11px] text-[var(--text-muted)] mb-4">AI training coach &middot; powered by your real data</div>
            <div className="flex-1 flex flex-col justify-center gap-4">
              {/* User */}
              <div className="flex items-end gap-3 justify-end">
                <div className="px-4 py-3 rounded-2xl rounded-br-sm text-[15px] text-white" style={{
                  background: "linear-gradient(145deg, #5aa3f9 0%, #3b7dd8 100%)",
                  boxShadow: "0 2px 8px rgba(79,156,247,0.25)",
                }}>
                  How should I adjust my programming?
                </div>
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <User size={16} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
              {/* Chevy */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1" style={{
                  background: "linear-gradient(135deg, rgba(79,156,247,0.2), rgba(79,156,247,0.05))",
                }}>
                  <Logo size={17} />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-[15px] text-[var(--text-secondary)] leading-relaxed" style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  Your push volume is 18% higher than pull over the last 4 weeks. I&apos;d add a back-focused day and drop one chest accessory to balance it out. Your best bench session was Monday — keep that slot and swap Friday&apos;s chest work for heavy rows.
                </div>
              </div>
            </div>
          </div>

          {/* Muscle split — bottom right */}
          <div className="col-span-4 rounded-2xl p-5 flex flex-col" style={TILE}>
            <div className="text-[14px] text-[var(--text-secondary)] mb-1">Muscle balance</div>
            <div className="text-[11px] text-[var(--text-muted)] mb-4">Last 30 sessions frequency</div>
            <div className="flex-1 flex flex-col justify-center gap-3">
              {[
                { muscle: "Chest", pct: 85 },
                { muscle: "Back", pct: 72 },
                { muscle: "Shoulders", pct: 68 },
                { muscle: "Quads", pct: 60 },
                { muscle: "Hamstrings", pct: 45 },
                { muscle: "Arms", pct: 55 },
              ].map((m) => (
                <div key={m.muscle} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--text-muted)] w-20 text-right">{m.muscle}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${m.pct}%`,
                      background: `linear-gradient(90deg, rgba(79,156,247,0.4), rgba(79,156,247,${0.3 + m.pct * 0.007}))`,
                    }} />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] w-8">{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// commit-marker-25
// commit-marker-41
