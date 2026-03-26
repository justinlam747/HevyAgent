"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { getPrimaryMuscles, workoutVolume, workoutDuration, workoutSets } from "@/lib/insights";
import { capitalize, cn, formatVolume, formatDuration, formatDate } from "@/lib/utils";
import { Clock, Dumbbell, Layers, ChevronDown, LayoutGrid, List, CalendarDays } from "lucide-react";
import MuscleMap from "./MuscleMap";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type View = "calendar" | "timeline" | "list";

function buildWorkoutMap(workouts: Workout[]) {
  const map = new Map<string, Workout[]>();
  workouts.forEach((w) => {
    const key = new Date(w.start_time).toLocaleDateString("en-CA");
    (map.get(key) ?? (() => { const a: Workout[] = []; map.set(key, a); return a; })()).push(w);
  });
  return map;
}

function getYearRange(workouts: Workout[]): number[] {
  if (!workouts.length) return [new Date().getFullYear()];
  const yrs = workouts.map((w) => new Date(w.start_time).getFullYear());
  const result: number[] = [];
  for (let y = Math.min(...yrs); y <= Math.max(...yrs); y++) result.push(y);
  return result;
}

interface WeekData { days: { date: Date | null; dateKey: string }[] }

function getWeeksForMonth(year: number, month: number): WeekData[] {
  const dim = new Date(year, month + 1, 0).getDate();
  const weeks: WeekData[] = [];
  let cur: WeekData["days"] = [];
  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) cur.push({ date: null, dateKey: "" });
  for (let d = 1; d <= dim; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0 && cur.length > 0) { while (cur.length < 7) cur.push({ date: null, dateKey: "" }); weeks.push({ days: cur }); cur = []; }
    cur.push({ date, dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  if (cur.length > 0) { while (cur.length < 7) cur.push({ date: null, dateKey: "" }); weeks.push({ days: cur }); }
  return weeks;
}

function getWeekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.floor((d.getDate() + first - 1) / 7);
}

export default function WorkoutHub({
  workouts, templates, onSelectWorkout,
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  onSelectWorkout: (w: Workout) => void;
}) {
  const [view, setView] = useState<View>("list");
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());
  const todayKey = now.toLocaleDateString("en-CA");
  const workoutsByDate = useMemo(() => buildWorkoutMap(workouts), [workouts]);
  const years = useMemo(() => getYearRange(workouts), [workouts]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingBottom: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* View tabs */}
          <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", background: "rgba(22,22,22,0.55)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <TabBtn active={view === "list"} onClick={() => setView("list")}><List size={13} /> List</TabBtn>
            <TabBtn active={view === "calendar"} onClick={() => setView("calendar")}><LayoutGrid size={13} /> Calendar</TabBtn>
            <TabBtn active={view === "timeline"} onClick={() => setView("timeline")}><CalendarDays size={13} /> Timeline</TabBtn>
          </div>

          {view === "calendar" && (
            <>
              <MonthYearSelector month={selMonth} year={selYear} years={years} onChange={(m, y) => { setSelMonth(m); setSelYear(y); }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <NavBtn onClick={() => { if (selMonth === 0) { setSelMonth(11); setSelYear(selYear - 1); } else setSelMonth(selMonth - 1); }}>&larr;</NavBtn>
                <NavBtn onClick={() => { setSelMonth(now.getMonth()); setSelYear(now.getFullYear()); }}>Today</NavBtn>
                <NavBtn onClick={() => { if (selMonth === 11) { setSelMonth(0); setSelYear(selYear + 1); } else setSelMonth(selMonth + 1); }}>&rarr;</NavBtn>
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          <span>{workouts.length} workouts</span>
          <span>{workoutsByDate.size} days</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {view === "calendar" && (
          <CalendarGrid month={selMonth} year={selYear} workoutsByDate={workoutsByDate} templates={templates} todayKey={todayKey} onSelect={onSelectWorkout} />
        )}
        {view === "timeline" && (
          <TimelineView workouts={workouts} workoutsByDate={workoutsByDate} templates={templates} todayKey={todayKey} onSelect={onSelectWorkout} />
        )}
        {view === "list" && (
          <ListView workouts={workouts} templates={templates} onSelect={onSelectWorkout} />
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   LIST VIEW — grouped by month, weeks as rows
   ════════════════════════════════════════ */

function ListView({ workouts, templates, onSelect }: {
  workouts: Workout[]; templates: Map<string, ExerciseTemplate>; onSelect: (w: Workout) => void;
}) {
  // Group workouts by month → week
  const grouped = useMemo(() => {
    const months = new Map<string, Map<number, Workout[]>>();
    for (const w of workouts) {
      const d = new Date(w.start_time);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const wk = getWeekOfMonth(d);
      if (!months.has(mk)) months.set(mk, new Map());
      const weekMap = months.get(mk)!;
      if (!weekMap.has(wk)) weekMap.set(wk, []);
      weekMap.get(wk)!.push(w);
    }
    return Array.from(months.entries()).map(([mk, weekMap]) => {
      const [y, m] = mk.split("-").map(Number);
      return {
        label: `${MONTHS[m - 1]} ${y}`,
        key: mk,
        weeks: Array.from(weekMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([wk, wkWorkouts]) => {
            // Get the date range for this week
            const dates = wkWorkouts.map((w) => new Date(w.start_time));
            const minD = new Date(Math.min(...dates.map((d) => d.getTime())));
            const maxD = new Date(Math.max(...dates.map((d) => d.getTime())));
            const rangeLabel = minD.getDate() === maxD.getDate()
              ? `${MONTHS[minD.getMonth()].slice(0, 3)} ${minD.getDate()}`
              : `${MONTHS[minD.getMonth()].slice(0, 3)} ${minD.getDate()} – ${maxD.getDate()}`;
            return { week: wk, workouts: wkWorkouts, rangeLabel };
          }),
        count: Array.from(weekMap.values()).reduce((s, a) => s + a.length, 0),
      };
    });
  }, [workouts]);

  return (
    <div style={{ overflow: "auto", height: "100%", paddingBottom: 32 }}>
      {grouped.map((month) => (
        <div key={month.key} style={{ marginBottom: 28 }}>
          {/* Month header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 2px" }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{month.label}</p>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{month.count} workout{month.count !== 1 ? "s" : ""}</span>
          </div>

          {/* Weeks */}
          {month.weeks.map(({ week, workouts: wkWorkouts, rangeLabel }) => (
            <div key={week} style={{ marginBottom: 16 }}>
              {/* Week label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "0 2px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Week {week + 1}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>{rangeLabel}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
              </div>

              {/* Workout tiles in a horizontal row */}
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                {wkWorkouts.map((w) => {
                  const muscles = getPrimaryMuscles(w, templates);
                  const vol = workoutVolume(w);
                  const dur = workoutDuration(w);
                  const sets = workoutSets(w);
                  const exerciseNames = w.exercises.slice(0, 3).map((e) => e.title);
                  const moreCount = w.exercises.length - 3;

                  return (
                    <button key={w.id} onClick={() => onSelect(w)} className="tile" style={{ minWidth: 260, maxWidth: 320, flex: "0 0 auto", display: "flex", flexDirection: "column" }}>
                      <div className="tile-head">
                        <p className="tile-head-title">{w.title}</p>
                        <p className="tile-head-sub">
                          {new Date(w.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        {muscles.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                            {muscles.map((m) => (
                              <span key={m} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "rgba(79,156,247,0.08)", color: "var(--accent)", fontWeight: 600 }}>{capitalize(m)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="tile-body" style={{ flex: 1, display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ flexShrink: 0 }}>
                          <MuscleMap activeMuscles={muscles} size={60} />
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {exerciseNames.map((name, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", opacity: 0.5 }} />
                                <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                              </div>
                            ))}
                            {moreCount > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 10 }}>+{moreCount} more</span>}
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><Dumbbell size={11} />{formatVolume(vol)}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><Clock size={11} />{formatDuration(dur)}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><Layers size={11} />{sets}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   CALENDAR GRID VIEW
   ════════════════════════════════════════ */

function CalendarGrid({ month, year, workoutsByDate, templates, todayKey, onSelect }: {
  month: number; year: number; workoutsByDate: Map<string, Workout[]>; templates: Map<string, ExerciseTemplate>; todayKey: string; onSelect: (w: Workout) => void;
}) {
  const weeks = useMemo(() => getWeeksForMonth(year, month), [year, month]);
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 gap-px border-b border-[var(--border)] mb-px">
        {DAYS.map((d) => <div key={d} className="text-center text-[11px] text-[var(--text-muted)] font-medium py-2">{d}</div>)}
      </div>
      <div className="flex-1 grid gap-px" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.days.map((cell, di) => {
              if (!cell.date) return <div key={`e-${wi}-${di}`} className="bg-[var(--bg)]/30" />;
              const dw = workoutsByDate.get(cell.dateKey) ?? [];
              const isToday = cell.dateKey === todayKey;
              const day = cell.date.getDate();
              if (!dw.length) return (
                <div key={cell.dateKey} className="relative p-1.5">
                  <span className={cn("text-[11px]", isToday ? "text-[var(--accent)] font-semibold" : "text-[var(--text-muted)]")}>{day}</span>
                </div>
              );
              const muscles = [...new Set(dw.flatMap((w) => getPrimaryMuscles(w, templates)))];
              const title = dw.length === 1 ? dw[0].title : `${dw.length} sessions`;
              return (
                <button key={cell.dateKey} onClick={() => onSelect(dw[0])}
                  className={cn("relative flex flex-col p-2 text-left transition-all rounded-lg overflow-hidden hover:brightness-125", isToday && "ring-1 ring-[var(--accent)] ring-inset")}
                  style={{ background: "rgba(22,22,22,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{title}</span>
                    <span className={cn("text-[10px] flex-shrink-0 ml-1", isToday ? "text-[var(--accent)] font-bold" : "text-[var(--text-muted)]")}>{day}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center mt-1 overflow-hidden">
                    <MuscleMap activeMuscles={muscles} size={60} />
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   TIMELINE VIEW (continuous months)
   ════════════════════════════════════════ */

function TimelineView({ workouts, workoutsByDate, templates, todayKey, onSelect }: {
  workouts: Workout[]; workoutsByDate: Map<string, Workout[]>; templates: Map<string, ExerciseTemplate>; todayKey: string; onSelect: (w: Workout) => void;
}) {
  const todayRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => {
    if (!workouts.length) return [];
    const dates = workouts.map((w) => new Date(w.start_time));
    const start = new Date(Math.min(...dates.map((d) => d.getTime()))); start.setDate(1);
    const end = new Date(Math.max(...dates.map((d) => d.getTime()))); end.setDate(1);
    const res: { label: string; year: number; month: number; weeks: WeekData[] }[] = [];
    const c = new Date(start);
    while (c <= end) { res.push({ label: `${MONTHS[c.getMonth()]} ${c.getFullYear()}`, year: c.getFullYear(), month: c.getMonth(), weeks: getWeeksForMonth(c.getFullYear(), c.getMonth()) }); c.setMonth(c.getMonth() + 1); }
    return res.reverse();
  }, [workouts]);

  useEffect(() => { todayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [months]);

  return (
    <div className="space-y-6 overflow-y-auto h-full pb-8">
      {months.map((md) => {
        const count = md.weeks.reduce((s, w) => s + w.days.reduce((ss, d) => ss + (workoutsByDate.get(d.dateKey)?.length ?? 0), 0), 0);
        return (
          <div key={`${md.year}-${md.month}`}>
            <div className="flex items-center justify-between py-1.5 px-1 mb-1">
              <h3 className="text-sm font-semibold text-[var(--text)]">{md.label}</h3>
              <span className="text-[11px] text-[var(--text-muted)]">{count} workout{count !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-7 gap-px mb-px">
              {DAYS.map((d) => <div key={d} className="text-center text-[10px] text-[var(--text-muted)] font-medium py-1">{d}</div>)}
            </div>
            {md.weeks.map((week, wi) => {
              const hasToday = week.days.some((d) => d.dateKey === todayKey);
              return (
                <div key={wi} ref={hasToday ? todayRef : undefined} className="grid grid-cols-7 gap-px" style={{ minHeight: 80 }}>
                  {week.days.map((cell, di) => {
                    if (!cell.date) return <div key={`e-${di}`} />;
                    const dw = workoutsByDate.get(cell.dateKey) ?? [];
                    const isToday = cell.dateKey === todayKey;
                    const day = cell.date.getDate();
                    if (!dw.length) return <div key={cell.dateKey} className="p-1.5"><span className={cn("text-[11px]", isToday ? "text-[var(--accent)] font-semibold" : "text-[var(--text-muted)]")}>{day}</span></div>;
                    const muscles = [...new Set(dw.flatMap((w) => getPrimaryMuscles(w, templates)))];
                    const title = dw.length === 1 ? dw[0].title : `${dw.length} sessions`;
                    return (
                      <button key={cell.dateKey} onClick={() => onSelect(dw[0])}
                        className={cn("relative flex flex-col p-2 text-left transition-all rounded-lg overflow-hidden hover:brightness-125", isToday && "ring-1 ring-[var(--accent)] ring-inset")}
                        style={{ background: "rgba(22,22,22,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{title}</span>
                          <span className={cn("text-[10px] flex-shrink-0 ml-1", isToday ? "text-[var(--accent)] font-bold" : "text-[var(--text-muted)]")}>{day}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center mt-1 overflow-hidden">
                          <MuscleMap activeMuscles={muscles} size={60} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Small shared components ─── */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600,
      cursor: "pointer", border: "none", transition: "all 0.15s",
      background: active ? "rgba(79,156,247,0.12)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-muted)",
    }}>
      {children}
    </button>
  );
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", fontSize: 12, borderRadius: 8, cursor: "pointer",
      background: "none", border: "none", color: "var(--text-muted)",
    }}>
      {children}
    </button>
  );
}

function MonthYearSelector({ month, year, years, onChange }: { month: number; year: number; years: number[]; onChange: (m: number, y: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <select value={month} onChange={(e) => onChange(Number(e.target.value), year)}
          style={{ appearance: "none", fontSize: 13, fontWeight: 600, color: "var(--text)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 28px 6px 12px", cursor: "pointer" }}>
          {MONTHS.map((n, i) => <option key={i} value={i}>{n}</option>)}
        </select>
        <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
      </div>
      <div style={{ position: "relative" }}>
        <select value={year} onChange={(e) => onChange(month, Number(e.target.value))}
          style={{ appearance: "none", fontSize: 13, fontWeight: 600, color: "var(--text)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 28px 6px 12px", cursor: "pointer" }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
