"use client";

import { useState } from "react";
import Body from "react-muscle-highlighter";
import Logo from "./Logo";
import { ArrowRight } from "lucide-react";
import NiceAvatar, { genConfig } from "react-nice-avatar";

const USER_AVATAR_CONFIG = genConfig({ sex: "man", hairStyle: "thick", shirtStyle: "polo", bgColor: "#6366f1" });

/* ════════════════════════════════════════
   Data
   ════════════════════════════════════════ */

const VOL_DATA = [
  { v: 42, d: "M" }, { v: 68, d: "T" }, { v: 55, d: "W" }, { v: 73, d: "T" },
  { v: 48, d: "F" }, { v: 82, d: "S" }, { v: 61, d: "S" }, { v: 90, d: "M" },
  { v: 52, d: "T" }, { v: 78, d: "W" }, { v: 95, d: "T" }, { v: 70, d: "F" },
  { v: 88, d: "S" }, { v: 64, d: "S" }, { v: 102, d: "M" }, { v: 58, d: "T" },
];

const FRONT_MUSCLES = [
  { slug: "chest" as const, color: "#4f9cf7", intensity: 2 },
  { slug: "deltoids" as const, color: "#6aafff", intensity: 1 },
  { slug: "abs" as const, color: "#4f9cf7", intensity: 1 },
  { slug: "quadriceps" as const, color: "#6aafff", intensity: 2 },
];

const BACK_MUSCLES = [
  { slug: "upper-back" as const, color: "#4f9cf7", intensity: 2 },
  { slug: "trapezius" as const, color: "#6aafff", intensity: 1 },
  { slug: "gluteal" as const, color: "#4f9cf7", intensity: 1 },
  { slug: "hamstring" as const, color: "#6aafff", intensity: 2 },
];

/* ════════════════════════════════════════
   Landing
   ════════════════════════════════════════ */

export default function ApiKeyForm({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState("");
  const maxVol = Math.max(...VOL_DATA.map((d) => d.v));

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Grain overlay — fine */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.025]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
      }} />

      {/* Glow */}
      <div className="absolute w-[800px] h-[800px] rounded-full pointer-events-none" style={{
        background: "radial-gradient(circle, rgba(79, 156, 247, 0.08) 0%, transparent 65%)",
        top: "-300px", right: "-200px", filter: "blur(40px)",
      }} />

      {/* Banner */}
      <div className="relative z-10 text-center py-2 text-[11px] font-medium tracking-wide" style={{
        background: "linear-gradient(90deg, rgba(79, 156, 247, 0.12) 0%, rgba(79, 156, 247, 0.2) 50%, rgba(79, 156, 247, 0.12) 100%)",
        borderBottom: "1px solid rgba(79, 156, 247, 0.15)",
        color: "rgba(160, 200, 255, 0.85)",
      }}>
        Currently only available for Hevy Pro subscribers
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="text-sm font-bold tracking-wide">HEVY<span className="text-[var(--text-muted)] font-normal ml-0.5">AGENT</span></span>
          </div>
          <div className="relative group">
            <a href="https://hevy.com/settings?developer" target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              Get API Key &rarr;
            </a>
            <div className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-lg text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{
              background: "rgba(20, 20, 20, 0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}>
              Requires a Hevy Pro subscription
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 pt-16 pb-20 items-start">
          <div>
            <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-tight text-[var(--text-primary)]" style={{
              textShadow: "0 1px 30px rgba(79, 156, 247, 0.12)",
            }}>
              Your training,<br />measured.
            </h1>
            <p className="mt-5 text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-lg">
              Connect your Hevy account. Meet Chevy — an AI coach that knows your workout history, tracks your PRs, and gives you real recommendations.
            </p>

            {/* Form */}
            <form onSubmit={(e) => { e.preventDefault(); if (key.trim()) onSubmit(key.trim()); }}
              className="mt-8 flex gap-2 max-w-md">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="API key"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(79,156,247,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
              <button type="submit" disabled={!key.trim()}
                className="group flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-20 active:translate-y-[1px]"
                style={{
                  background: "linear-gradient(180deg, #5aa3f9 0%, #3b7dd8 50%, #2e6bc0 100%)",
                  boxShadow: "0 4px 12px rgba(79, 156, 247, 0.3), 0 1px 0 rgba(255,255,255,0.15) inset, 0 -2px 0 rgba(0,0,0,0.15) inset, 0 1px 3px rgba(0,0,0,0.25)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}>
                Connect <ArrowRight size={14} />
              </button>
            </form>
            <p className="mt-3 text-[10px] text-[var(--text-muted)]">
              Your key stays in your browser. Nothing is stored on a server.
            </p>

            {/* Proof points */}
            <div className="flex items-center gap-6 mt-12">
              {["Volume tracking", "PR detection", "AI coach", "Muscle balance"].map((t) => (
                <span key={t} className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] opacity-60" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Body diagram — right */}
          <div className="relative flex justify-center pt-4">
            <div className="flex items-start gap-1">
              <Body data={FRONT_MUSCLES} side="front" gender="male" scale={0.65} border="none"
                defaultFill="rgba(255,255,255,0.015)" defaultStroke="rgba(255,255,255,0.05)" defaultStrokeWidth={0.4} />
              <Body data={BACK_MUSCLES} side="back" gender="male" scale={0.65} border="none"
                defaultFill="rgba(255,255,255,0.015)" defaultStroke="rgba(255,255,255,0.05)" defaultStrokeWidth={0.4} />
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at center, transparent 40%, rgba(10, 10, 10, 1) 85%)",
            }} />
          </div>
        </div>

        {/* Bento */}
        <div className="grid grid-cols-12 gap-2.5 pb-20">
          {/* Volume chart */}
          <div className="col-span-12 md:col-span-7 rounded-2xl p-5" style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}>
            <div className="text-[11px] text-[var(--text-muted)] mb-4 font-medium">Weekly volume</div>
            <div className="overflow-hidden rounded-b-lg">
              <div className="flex items-end gap-1.5 h-36" style={{ perspective: "600px" }}>
                {VOL_DATA.map((d, i) => {
                  const pct = (d.v / maxVol) * 100;
                  const isHighlight = i === VOL_DATA.length - 3;
                  const baseAlpha = 0.3 + (d.v / maxVol) * 0.35;
                  return (
                    <div key={i} className="flex-1 relative" style={{ height: `${Math.max(pct, 8)}%`, transformStyle: "preserve-3d", transform: "rotateY(-4deg) rotateX(2deg)" }}>
                      <div className="absolute inset-0 rounded-md" style={{
                        background: isHighlight
                          ? "linear-gradient(to top, rgba(79, 156, 247, 0.5), rgba(79, 156, 247, 0.95))"
                          : `linear-gradient(to top, rgba(79, 156, 247, 0.12), rgba(79, 156, 247, ${baseAlpha}))`,
                        boxShadow: isHighlight
                          ? "0 0 14px rgba(79,156,247,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                          : "inset 0 1px 0 rgba(255,255,255,0.06), inset -2px 0 4px rgba(0,0,0,0.15)",
                      }} />
                      <div className="absolute top-0 right-0 w-[3px] h-full rounded-r-md" style={{
                        background: isHighlight ? "rgba(40, 100, 200, 0.6)" : `rgba(30, 70, 140, ${baseAlpha * 0.5})`,
                      }} />
                      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-md" style={{
                        background: isHighlight ? "rgba(120, 185, 255, 0.5)" : `rgba(100, 170, 255, ${baseAlpha * 0.4})`,
                      }} />
                      {isHighlight && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[120%] h-3" style={{
                          background: "radial-gradient(ellipse, rgba(79,156,247,0.35) 0%, transparent 70%)",
                          filter: "blur(3px)",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* X axis */}
              <div className="h-[1px]" style={{
                background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08) 15%, rgba(255,255,255,0.08) 85%, transparent)",
              }} />
              {/* Day labels */}
              <div className="flex gap-1.5 mt-1.5">
                {VOL_DATA.map((d, i) => (
                  <div key={i} className="flex-1 text-center text-[8px] text-[var(--text-muted)]">{d.d}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="col-span-12 md:col-span-5 grid grid-cols-2 gap-2.5">
            {[
              { val: "91", label: "workouts logged" },
              { val: "3.4x", label: "per week avg" },
              { val: "6.8k", label: "lbs avg session" },
              { val: "1h 22m", label: "avg duration" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-4" style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              }}>
                <div className="text-xl font-bold text-[var(--text-primary)]" style={{
                  textShadow: "0 0 20px rgba(79,156,247,0.1)",
                }}>{s.val}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Chat with Chevy */}
          <div className="col-span-12 md:col-span-8 rounded-2xl p-5" style={{
            background: "linear-gradient(135deg, rgba(79, 156, 247, 0.04) 0%, rgba(255,255,255,0.015) 100%)",
            border: "1px solid rgba(79, 156, 247, 0.08)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}>
            <div className="text-[10px] text-[var(--text-muted)] font-medium mb-3">Chevy</div>
            <div className="space-y-3">
              {/* User message */}
              <div className="flex items-end gap-2 justify-end">
                <div className="px-3.5 py-2 rounded-2xl rounded-br-sm text-[12px] text-white max-w-[280px]" style={{
                  background: "linear-gradient(145deg, #5aa3f9 0%, #3b7dd8 100%)",
                  boxShadow: "0 2px 8px rgba(79,156,247,0.25), inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.2)",
                }}>
                  How should I adjust my programming?
                </div>
                <NiceAvatar style={{ width: "24px", height: "24px" }} {...USER_AVATAR_CONFIG} />
              </div>
              {/* Chevy response */}
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden" style={{
                  background: "linear-gradient(135deg, rgba(79,156,247,0.2), rgba(79,156,247,0.05))",
                  boxShadow: "0 2px 6px rgba(79,156,247,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}>
                  <Logo size={14} />
                </div>
                <div className="px-3.5 py-2 rounded-2xl rounded-bl-sm text-[12px] text-[var(--text-secondary)] leading-relaxed max-w-[340px]" style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}>
                  Your push volume is 18% higher than pull over the last 4 weeks. I&apos;d add a back-focused day and drop one chest accessory to balance it out.
                </div>
              </div>
            </div>
          </div>

          {/* PRs */}
          <div className="col-span-12 md:col-span-4 rounded-2xl p-5" style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}>
            <div className="text-[11px] text-[var(--text-muted)] font-medium mb-3">Recent PRs</div>
            <div className="space-y-3">
              {[
                { name: "Bench Press", w: "225 lbs x5" },
                { name: "Squat", w: "315 lbs x3" },
                { name: "Deadlift", w: "405 lbs x1" },
              ].map((pr) => (
                <div key={pr.name} className="flex justify-between items-baseline">
                  <span className="text-[12px] text-[var(--text-secondary)]">{pr.name}</span>
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{pr.w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
