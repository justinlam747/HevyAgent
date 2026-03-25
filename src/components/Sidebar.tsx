"use client";

import type { ReactNode } from "react";
import Logo from "./Logo";

export type NavItem = "calendar" | "workouts" | "insights" | "agent";

const NAV_ITEMS: { key: NavItem; label: string; icon: ReactNode }[] = [
  {
    key: "calendar",
    label: "Calendar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="14" rx="2" />
        <path d="M2 8h16" />
        <path d="M6 2v4" />
        <path d="M14 2v4" />
      </svg>
    ),
  },
  {
    key: "workouts",
    label: "Workouts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h2v6H4zM14 7h2v6h-2z" />
        <path d="M6 9h8" />
        <path d="M2 8.5h2M16 8.5h2" />
        <path d="M6 11h8" />
      </svg>
    ),
  },
  {
    key: "insights",
    label: "Insights",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17V10" />
        <path d="M7 17V6" />
        <path d="M11 17V8" />
        <path d="M15 17V3" />
      </svg>
    ),
  },
  {
    key: "agent",
    label: "Chevy",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14l3-3 3 3 5-5 3 3" />
        <circle cx="10" cy="4" r="2" />
        <path d="M10 6v3" />
      </svg>
    ),
  },
];

export default function Sidebar({
  active,
  onNavigate,
  onSync,
  onDisconnect,
  syncing,
  workoutCount,
}: {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
  workoutCount: number;
}) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Logo size={28} />
        <span className="sidebar-logo-text">HEVY<span className="sidebar-logo-dim">AGENT</span></span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`sidebar-nav-item ${active === item.key ? "active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="sidebar-footer">
        <div className="sidebar-stats">
          <span className="text-xs text-[var(--text-muted)]">{workoutCount} workouts</span>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="sidebar-footer-btn"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "animate-spin" : ""}>
            <path d="M2 8a6 6 0 0110.5-4" />
            <path d="M14 8a6 6 0 01-10.5 4" />
            <polyline points="12,2 13,4.5 10.5,4" />
            <polyline points="4,14 3,11.5 5.5,12" />
          </svg>
          <span>{syncing ? "Syncing..." : "Sync"}</span>
        </button>
        <button
          onClick={onDisconnect}
          className="sidebar-footer-btn disconnect"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
            <polyline points="10,12 14,8 10,4" />
            <path d="M14 8H6" />
          </svg>
          <span>Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
