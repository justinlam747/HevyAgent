"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { getPrimaryMuscles, workoutVolume, workoutDuration, workoutSets } from "@/lib/insights";
import { capitalize, cn, formatVolume, formatDuration } from "@/lib/utils";
import { Clock, Dumbbell, Layers, ChevronDown, LayoutGrid, List } from "lucide-react";
import MuscleMap from "./MuscleMap";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ════════════════════════════════════════
   Helpers
   ════════════════════════════════════════ */

function buildWorkoutMap(workouts: Workout[]) {
  const map = new Map<string, Workout[]>();
  workouts.forEach((w) => {
    const key = new Date(w.start_time).toLocaleDateString("en-CA");
    const arr = map.get(key) ?? [];
    arr.push(w);
    map.set(key, arr);
  });
  return map;
}

function getYearRange(workouts: Workout[]): number[] {
  if (workouts.length === 0) return [new Date().getFullYear()];
  const dates = workouts.map((w) => new Date(w.start_time).getFullYear());
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const years: number[] = [];
  for (let y = min; y <= max; y++) years.push(y);
  return years;
}

interface WeekData {
  days: { date: Date | null; dateKey: string }[];
}

function getWeeksForMonth(year: number, month: number): WeekData[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: WeekData[] = [];
  let currentDays: { date: Date | null; dateKey: string }[] = [];

  const firstDow = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDow; i++) currentDays.push({ date: null, dateKey: "" });

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 && currentDays.length > 0) {
      while (currentDays.length < 7) currentDays.push({ date: null, dateKey: "" });
      weeks.push({ days: currentDays });
      currentDays = [];
    }
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    currentDays.push({ date, dateKey });
  }

  if (currentDays.length > 0) {
    while (currentDays.length < 7) currentDays.push({ date: null, dateKey: "" });
    weeks.push({ days: currentDays });
  }

  return weeks;
}

/* ════════════════════════════════════════
   Month/Year Selector
   ════════════════════════════════════════ */

function MonthYearSelector({
  month, year, years, onChange,
}: {
  month: number; year: number; years: number[];
  onChange: (m: number, y: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={month}
          onChange={(e) => onChange(Number(e.target.value), year)}
          className="appearance-none text-sm font-medium text-[var(--text)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-3 pr-7 py-1.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {MONTHS.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>
      <div className="relative">
        <select
          value={year}
          onChange={(e) => onChange(month, Number(e.target.value))}
          className="appearance-none text-sm font-medium text-[var(--text)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-3 pr-7 py-1.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Single Month View — fixed grid, fits viewport
   ════════════════════════════════════════ */

function SingleMonthView({
  month, year, workoutsByDate, templates, todayKey, onSelectWorkout,
}: {
  month: number; year: number;
  workoutsByDate: Map<string, Workout[]>;
  templates: Map<string, ExerciseTemplate>;
  todayKey: string;
  onSelectWorkout: (w: Workout) => void;
}) {
  const weeks = useMemo(() => getWeeksForMonth(year, month), [year, month]);

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px border-b border-[var(--border)] mb-px">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] text-[var(--text-muted)] font-medium py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows — flex-1 so they fill remaining space equally */}
      <div className="flex-1 grid gap-px" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.days.map((cell, di) => {
              if (!cell.date) {
                return <div key={`e-${wi}-${di}`} className="bg-[var(--bg)]/30" />;
              }

              const dayWorkouts = workoutsByDate.get(cell.dateKey) ?? [];
              const isToday = cell.dateKey === todayKey;
              const day = cell.date.getDate();

              if (dayWorkouts.length === 0) {
                return (
                  <div
                    key={cell.dateKey}
                    className="relative p-1.5"
                  >
                    <span className={cn(
                      "text-[11px]",
                      isToday ? "text-[var(--accent)] font-medium" : "text-[var(--text-muted)]"
                    )}>
                      {day}
                    </span>
                  </div>
                );
              }

              // Workout day — compact tile
              const totalVol = dayWorkouts.reduce((s, w) => s + workoutVolume(w), 0);
              const totalDur = dayWorkouts.reduce((s, w) => s + workoutDuration(w), 0);
              const totalS = dayWorkouts.reduce((s, w) => s + workoutSets(w), 0);
              const muscles = [...new Set(dayWorkouts.flatMap((w) => getPrimaryMuscles(w, templates)))];
              const title = dayWorkouts.length === 1 ? dayWorkouts[0].title : `${dayWorkouts.length} sessions`;

              return (
                <button
                  key={cell.dateKey}
                  onClick={() => onSelectWorkout(dayWorkouts[0])}
                  className={cn(
                    "relative flex flex-col p-2 text-left transition-all rounded-lg overflow-hidden group",
                    "hover:brightness-125",
                    isToday && "ring-1 ring-[var(--accent)] ring-inset"
                  )}
                  style={{
                    background: "rgba(22, 22, 22, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  {/* Header: title + date + stats */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate leading-tight">
                        {title}
                      </span>
                      <span className={cn(
                        "text-[10px] flex-shrink-0 ml-1",
                        isToday ? "text-[var(--accent)] font-medium" : "text-[var(--text-muted)]"
                      )}>
                        {day}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]">
                        <Dumbbell size={9} />
                        {formatVolume(totalVol)}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]">
                        <Clock size={9} />
                        {formatDuration(totalDur)}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]">
                        <Layers size={9} />
                        {totalS}
                      </span>
                    </div>
                  </div>

                  {/* Muscle map — fills remaining space */}
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
   Continuous Timeline View
   ════════════════════════════════════════ */

function ContinuousView({
  workouts, workoutsByDate, templates, todayKey, onSelectWorkout,
}: {
  workouts: Workout[];
  workoutsByDate: Map<string, Workout[]>;
  templates: Map<string, ExerciseTemplate>;
  todayKey: string;
  onSelectWorkout: (w: Workout) => void;
}) {
  const todayRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    if (workouts.length === 0) return [];
    const dates = workouts.map((w) => new Date(w.start_time));
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(latest.getFullYear(), latest.getMonth(), 1);

    const result: { label: string; year: number; month: number; weeks: WeekData[] }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      result.push({ label: `${MONTHS[m]} ${y}`, year: y, month: m, weeks: getWeeksForMonth(y, m) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result.reverse();
  }, [workouts]);

  useEffect(() => {
    if (todayRef.current) todayRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [months]);

  return (
    <div className="space-y-6 overflow-y-auto h-full pb-8">
      {months.map((md) => {
        const count = md.weeks.reduce(
          (sum, w) => sum + w.days.reduce((s, d) => s + (workoutsByDate.get(d.dateKey)?.length ?? 0), 0), 0
        );

        return (
          <div key={`${md.year}-${md.month}`}>
            <div className="flex items-center justify-between py-1.5 px-1 mb-1">
              <h3 className="text-sm font-medium text-[var(--text)]">{md.label}</h3>
              <span className="text-[11px] text-[var(--text-muted)]">{count} workout{count !== 1 ? "s" : ""}</span>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-7 gap-px mb-px">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] text-[var(--text-muted)] font-medium py-1">{d}</div>
              ))}
            </div>

            {/* Weeks */}
            {md.weeks.map((week, wi) => {
              const hasToday = week.days.some((d) => d.dateKey === todayKey);
              return (
                <div key={wi} ref={hasToday ? todayRef : undefined} className="grid grid-cols-7 gap-px" style={{ minHeight: 80 }}>
                  {week.days.map((cell, di) => {
                    if (!cell.date) return <div key={`e-${di}`} />;
                    const dayWorkouts = workoutsByDate.get(cell.dateKey) ?? [];
                    const isToday = cell.dateKey === todayKey;
                    const day = cell.date.getDate();

                    if (dayWorkouts.length === 0) {
                      return (
                        <div key={cell.dateKey} className="p-1.5">
                          <span className={cn("text-[11px]", isToday ? "text-[var(--accent)] font-medium" : "text-[var(--text-muted)]")}>{day}</span>
                        </div>
                      );
                    }

                    const totalVol = dayWorkouts.reduce((s, w) => s + workoutVolume(w), 0);
                    const totalDur = dayWorkouts.reduce((s, w) => s + workoutDuration(w), 0);
                    const totalS = dayWorkouts.reduce((s, w) => s + workoutSets(w), 0);
                    const muscles = [...new Set(dayWorkouts.flatMap((w) => getPrimaryMuscles(w, templates)))];
                    const title = dayWorkouts.length === 1 ? dayWorkouts[0].title : `${dayWorkouts.length} sessions`;

                    return (
                      <button
                        key={cell.dateKey}
                        onClick={() => onSelectWorkout(dayWorkouts[0])}
                        className={cn(
                          "relative flex flex-col p-2 text-left transition-all rounded-lg overflow-hidden",
                          "hover:brightness-125",
                          isToday && "ring-1 ring-[var(--accent)] ring-inset"
                        )}
                        style={{ background: "rgba(22, 22, 22, 0.6)", border: "1px solid rgba(255, 255, 255, 0.05)" }}
                      >
                        {/* Header: title + date + stats */}
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[var(--text-primary)] truncate leading-tight">{title}</span>
                            <span className={cn("text-[10px] flex-shrink-0 ml-1", isToday ? "text-[var(--accent)] font-medium" : "text-[var(--text-muted)]")}>{day}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]"><Dumbbell size={9} />{formatVolume(totalVol)}</span>
                            <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]"><Clock size={9} />{formatDuration(totalDur)}</span>
                            <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]"><Layers size={9} />{totalS}</span>
                          </div>
                        </div>
                        {/* Muscle map — fills remaining space */}
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

/* ════════════════════════════════════════
   Main Calendar Component
   ════════════════════════════════════════ */

export default function Calendar({
  workouts, templates, onSelectWorkout,
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  onSelectWorkout: (w: Workout) => void;
}) {
  const [view, setView] = useState<"single" | "continuous">("single");
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());

  const todayKey = now.toLocaleDateString("en-CA");
  const workoutsByDate = useMemo(() => buildWorkoutMap(workouts), [workouts]);
  const years = useMemo(() => getYearRange(workouts), [workouts]);

  const handleMonthYear = useCallback((m: number, y: number) => { setSelMonth(m); setSelYear(y); }, []);
  const goToday = useCallback(() => { setSelMonth(now.getMonth()); setSelYear(now.getFullYear()); }, []);
  const prevMonth = useCallback(() => {
    if (selMonth === 0) { setSelMonth(11); setSelYear(selYear - 1); } else setSelMonth(selMonth - 1);
  }, [selMonth, selYear]);
  const nextMonth = useCallback(() => {
    if (selMonth === 11) { setSelMonth(0); setSelYear(selYear + 1); } else setSelMonth(selMonth + 1);
  }, [selMonth, selYear]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ background: "rgba(22, 22, 22, 0.55)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
          >
            <button
              onClick={() => setView("single")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                view === "single" ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              )}
            >
              <LayoutGrid size={13} />
              Month
            </button>
            <button
              onClick={() => setView("continuous")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                view === "continuous" ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              )}
            >
              <List size={13} />
              Timeline
            </button>
          </div>

          {view === "single" && (
            <>
              <MonthYearSelector month={selMonth} year={selYear} years={years} onChange={handleMonthYear} />
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="px-2 py-1 text-sm rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">&larr;</button>
                <button onClick={goToday} className="px-2 py-1 text-[11px] rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">Today</button>
                <button onClick={nextMonth} className="px-2 py-1 text-sm rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">&rarr;</button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>{workouts.length} workouts</span>
          <span>{workoutsByDate.size} days trained</span>
        </div>
      </div>

      {/* Calendar body — fills remaining viewport */}
      <div className="flex-1 min-h-0">
        {view === "single" ? (
          <SingleMonthView
            month={selMonth} year={selYear}
            workoutsByDate={workoutsByDate} templates={templates}
            todayKey={todayKey} onSelectWorkout={onSelectWorkout}
          />
        ) : (
          <ContinuousView
            workouts={workouts} workoutsByDate={workoutsByDate}
            templates={templates} todayKey={todayKey}
            onSelectWorkout={onSelectWorkout}
          />
        )}
      </div>
    </div>
  );
}
// commit-marker-8
// commit-marker-17
// commit-marker-49
