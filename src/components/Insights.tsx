"use client";

import { useMemo, useState } from "react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import {
  findPRs,
  weeklyFrequency,
  weeklyVolume,
  muscleGroupFrequency,
  detectSplit,
  workoutVolume,
  workoutDuration,
  workoutSets,
} from "@/lib/insights";
import { formatWeight, formatVolume, capitalize, formatDateShort } from "@/lib/utils";
import { Trophy } from "lucide-react";
import MuscleMap from "./MuscleMap";

const MEDALS = ["🥇", "🥈", "🥉"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Insights({
  workouts,
  templates,
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
}) {
  const prs = useMemo(() => findPRs(workouts), [workouts]);
  const freqData = useMemo(() => weeklyFrequency(workouts), [workouts]);
  const volData = useMemo(() => weeklyVolume(workouts), [workouts]);
  const muscleFreq = useMemo(() => muscleGroupFrequency(workouts, templates, 30), [workouts, templates]);
  const split = useMemo(() => detectSplit(workouts, templates), [workouts, templates]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const totalWorkouts = workouts.length;
  const avgVolume = totalWorkouts > 0
    ? Math.round(workouts.reduce((s, w) => s + workoutVolume(w), 0) / totalWorkouts)
    : 0;
  const avgDuration = totalWorkouts > 0
    ? Math.round(workouts.reduce((s, w) => s + workoutDuration(w), 0) / totalWorkouts)
    : 0;
  const avgFreq = freqData.length > 0
    ? (freqData.reduce((s, f) => s + f.count, 0) / freqData.length).toFixed(1)
    : "0";
  const totalVolumeEver = workouts.reduce((s, w) => s + workoutVolume(w), 0);

  const recentVol = volData.slice(-12);
  const maxVolWeek = recentVol.length > 0 ? Math.max(...recentVol.map((v) => v.volume)) : 1;

  const topPRs = Array.from(prs.values())
    .sort((a, b) => b.weight * b.reps - a.weight * a.reps)
    .slice(0, 6);

  const prMuscles = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pr of topPRs) {
      const wo = workouts.find((w) => w.id === pr.workoutId);
      if (wo) {
        const ex = wo.exercises.find((e) => e.title === pr.exerciseTitle);
        if (ex) {
          const tmpl = templates.get(ex.exercise_template_id);
          if (tmpl) map.set(pr.exerciseTitle, [tmpl.primary_muscle_group]);
        }
      }
    }
    return map;
  }, [topPRs, workouts, templates]);

  const maxMuscleCount = muscleFreq.length > 0 ? muscleFreq[0].count : 1;

  const firstDate = workouts.length > 0
    ? new Date(workouts[workouts.length - 1].start_time).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";

  const allMuscles = useMemo(() => {
    const s = new Set<string>();
    workouts.slice(0, 30).forEach((w) => {
      w.exercises.forEach((ex) => {
        const tmpl = templates.get(ex.exercise_template_id);
        if (tmpl) s.add(tmpl.primary_muscle_group);
      });
    });
    return Array.from(s);
  }, [workouts, templates]);

  // ── Derived stats ──

  const totalSets = useMemo(() => workouts.reduce((s, w) => s + workoutSets(w), 0), [workouts]);
  const totalReps = useMemo(() => workouts.reduce((s, w) =>
    s + w.exercises.reduce((es, ex) =>
      es + ex.sets.reduce((ss, set) => ss + (set.type !== "warmup" ? (set.reps ?? 0) : 0), 0), 0), 0), [workouts]);

  const totalTime = useMemo(() => workouts.reduce((s, w) => s + workoutDuration(w), 0), [workouts]);

  const uniqueExercises = useMemo(() => {
    const s = new Set<string>();
    workouts.forEach((w) => w.exercises.forEach((ex) => s.add(ex.title)));
    return s.size;
  }, [workouts]);

  // Heaviest single set (by weight)
  const heaviestSet = useMemo(() => {
    let best: { exercise: string; weight: number; reps: number; date: string } | null = null;
    workouts.forEach((w) => {
      w.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          if (s.type !== "warmup" && s.weight_kg && (!best || s.weight_kg > best.weight)) {
            best = { exercise: ex.title, weight: s.weight_kg, reps: s.reps ?? 0, date: w.start_time };
          }
        });
      });
    });
    return best as { exercise: string; weight: number; reps: number; date: string } | null;
  }, [workouts]);

  // Longest workout
  const longestWorkout = useMemo(() => {
    let best: { title: string; duration: number; date: string } | null = null;
    workouts.forEach((w) => {
      const d = workoutDuration(w);
      if (!best || d > best.duration) best = { title: w.title, duration: d, date: w.start_time };
    });
    return best as { title: string; duration: number; date: string } | null;
  }, [workouts]);

  // Highest volume single workout
  const biggestWorkout = useMemo(() => {
    let best: { title: string; volume: number; date: string } | null = null;
    workouts.forEach((w) => {
      const v = workoutVolume(w);
      if (!best || v > best.volume) best = { title: w.title, volume: v, date: w.start_time };
    });
    return best as { title: string; volume: number; date: string } | null;
  }, [workouts]);

  // Set type breakdown
  const setTypes = useMemo(() => {
    let normal = 0, failure = 0, dropset = 0, warmup = 0;
    workouts.forEach((w) => w.exercises.forEach((ex) => ex.sets.forEach((s) => {
      if (s.type === "warmup") warmup++;
      else if (s.type === "failure") failure++;
      else if (s.type === "dropset") dropset++;
      else normal++;
    })));
    return { normal, failure, dropset, warmup };
  }, [workouts]);

  // Day of week distribution
  const dayDist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    workouts.forEach((w) => { counts[new Date(w.start_time).getDay()]++; });
    return counts;
  }, [workouts]);
  const maxDayCount = Math.max(...dayDist, 1);

  // Time of day distribution
  const timeDist = useMemo(() => {
    let morning = 0, afternoon = 0, evening = 0;
    workouts.forEach((w) => {
      const h = new Date(w.start_time).getHours();
      if (h < 12) morning++;
      else if (h < 17) afternoon++;
      else evening++;
    });
    return { morning, afternoon, evening };
  }, [workouts]);
  const favoriteTime = timeDist.morning >= timeDist.afternoon && timeDist.morning >= timeDist.evening
    ? "Morning" : timeDist.afternoon >= timeDist.evening ? "Afternoon" : "Evening";

  // Top exercises by frequency
  const topExercises = useMemo(() => {
    const freq = new Map<string, number>();
    workouts.forEach((w) => w.exercises.forEach((ex) => freq.set(ex.title, (freq.get(ex.title) ?? 0) + 1)));
    return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [workouts]);

  // Best week
  const bestWeek = useMemo(() => {
    if (freqData.length === 0) return null;
    return freqData.reduce((a, b) => b.count > a.count ? b : a);
  }, [freqData]);

  // Current streak (consecutive weeks with at least 1 workout)
  const weekStreak = useMemo(() => {
    if (freqData.length === 0) return 0;
    let streak = 0;
    for (let i = freqData.length - 1; i >= 0; i--) {
      if (freqData[i].count > 0) streak++;
      else break;
    }
    return streak;
  }, [freqData]);

  // Supersets count
  const supersetCount = useMemo(() => {
    let count = 0;
    workouts.forEach((w) => w.exercises.forEach((ex) => { if (ex.superset_id !== null) count++; }));
    return count;
  }, [workouts]);

  // Exercises with RPE tracked
  const rpeStats = useMemo(() => {
    const vals: number[] = [];
    workouts.forEach((w) => w.exercises.forEach((ex) => ex.sets.forEach((s) => {
      if (s.rpe !== null && s.rpe !== undefined) vals.push(s.rpe);
    })));
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { avg: avg.toFixed(1), count: vals.length };
  }, [workouts]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>

      {/* ═══════ LEFT COLUMN ═══════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Row 1: Profile + Volume + Avg Session */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Card>
            <Label>Profile</Label>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 8 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(79,156,247,0.06)", border: "2px solid rgba(79,156,247,0.12)" }}>
                <MuscleMap activeMuscles={allMuscles} size={56} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{split}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>since {firstDate}</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <MiniStat emoji="💪" value={String(totalWorkouts)} />
              <MiniStat emoji="🔥" value={avgFreq + "/wk"} />
              <MiniStat emoji="⏱" value={avgDuration + "m"} />
            </div>
          </Card>

          <Card>
            <Label>Total Volume</Label>
            <BigNum>{formatVolume(totalVolumeEver)}</BigNum>
            <Detail>
              {Math.round(totalVolumeEver * 2.20462 / 2000).toLocaleString()} tons moved across {totalWorkouts} sessions.
              {" "}{totalSets.toLocaleString()} sets and {totalReps.toLocaleString()} reps total.
            </Detail>
          </Card>

          <Card>
            <Label>Avg / Session</Label>
            <BigNum>{formatVolume(avgVolume)}</BigNum>
            <Detail>
              {avgDuration} min avg duration at {avgFreq} sessions/week.
              {" "}{Math.round(totalSets / Math.max(totalWorkouts, 1))} sets per workout.
            </Detail>
          </Card>
        </div>

        {/* Row 2: 4 mini stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Card>
            <Label>Total Time</Label>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
              {Math.round(totalTime / 60)}<span style={{ fontSize: 13, color: "var(--text-muted)" }}>h</span>{" "}{totalTime % 60}<span style={{ fontSize: 13, color: "var(--text-muted)" }}>m</span>
            </p>
            <Detail>In the gym</Detail>
          </Card>
          <Card>
            <Label>Exercises Used</Label>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{uniqueExercises}</p>
            <Detail>{supersetCount > 0 ? `${supersetCount} superset exercises` : "Unique movements"}</Detail>
          </Card>
          <Card>
            <Label>Week Streak</Label>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{weekStreak}<span style={{ fontSize: 13, color: "var(--text-muted)" }}> wks</span></p>
            <Detail>Consecutive weeks active</Detail>
          </Card>
          <Card>
            <Label>Favorite Time</Label>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{favoriteTime}</p>
            <Detail>{timeDist.morning} AM / {timeDist.afternoon} PM / {timeDist.evening} EVE</Detail>
          </Card>
        </div>

        {/* Row 3: Volume chart */}
        {recentVol.length > 1 && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Weekly Volume</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Training load over time</p>
              </div>
              <Pill>Last 12 weeks</Pill>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 140 }}>
              {recentVol.map((v, i) => {
                const pct = (v.volume / maxVolWeek) * 100;
                const isHovered = hoveredBar === i;
                const isMax = v.volume === maxVolWeek;
                return (
                  <div key={v.week} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
                    onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                    {isHovered && (
                      <div style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", zIndex: 10,
                        padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", background: "#fff", color: "#111" }}>
                        {formatVolume(v.volume)}
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
                    <div style={{
                      width: "100%", borderRadius: 5, cursor: "pointer", height: `${Math.max(pct, 4)}%`,
                      background: isMax ? "var(--accent)" : isHovered ? "rgba(79,156,247,0.5)" : "rgba(79,156,247,0.2)",
                      transition: "all 0.15s ease",
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtWeek(recentVol[0]?.week)}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtWeek(recentVol[recentVol.length - 1]?.week)}</span>
            </div>
          </Card>
        )}

        {/* Row 4: Day distribution + Set type breakdown side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Training Days</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Which days you hit the gym</p>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
              {dayDist.map((count, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: "100%", borderRadius: 4,
                    height: `${Math.max((count / maxDayCount) * 100, 6)}%`,
                    background: count === Math.max(...dayDist) ? "var(--accent)" : "rgba(79,156,247,0.2)",
                    transition: "height 0.3s ease",
                    minHeight: 4,
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {DAY_NAMES.map((d, i) => (
                <span key={d} style={{ flex: 1, textAlign: "center", fontSize: 10, color: dayDist[i] === Math.max(...dayDist) ? "var(--accent)" : "var(--text-muted)", fontWeight: dayDist[i] === Math.max(...dayDist) ? 700 : 400 }}>{d}</span>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Set Breakdown</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{(totalSets + setTypes.warmup).toLocaleString()} total sets logged</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SetRow label="Working Sets" value={setTypes.normal} total={totalSets + setTypes.warmup} color="var(--accent)" />
              <SetRow label="Warm-up" value={setTypes.warmup} total={totalSets + setTypes.warmup} color="#f97316" />
              <SetRow label="To Failure" value={setTypes.failure} total={totalSets + setTypes.warmup} color="#ef4444" />
              <SetRow label="Drop Sets" value={setTypes.dropset} total={totalSets + setTypes.warmup} color="#a855f7" />
            </div>
            {rpeStats && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Avg RPE</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{rpeStats.avg}<span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}> / 10</span></span>
              </div>
            )}
          </Card>
        </div>

        {/* Row 5: Muscle Balance */}
        {muscleFreq.length > 0 && (
          <Card>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Muscle Balance</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Most trained areas — last 30 workouts</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {muscleFreq.slice(0, 10).map((m) => {
                const pct = Math.round((m.count / maxMuscleCount) * 100);
                return (
                  <div key={m.muscle} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, width: 76, textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>{capitalize(m.muscle)}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: "var(--accent)", transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, width: 32 }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ═══════ RIGHT COLUMN ═══════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Personal Records */}
        {topPRs.length > 0 && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Personal Records</p>
              <Trophy size={15} style={{ color: "#FFD700" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {topPRs.map((pr, i) => {
                const medal = i < 3 ? MEDALS[i] : null;
                const muscles = prMuscles.get(pr.exerciseTitle) ?? [];
                const isLast = i === topPRs.length - 1;
                return (
                  <div key={pr.exerciseTitle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                    {muscles.length > 0 && <div style={{ flexShrink: 0, opacity: 0.6 }}><MuscleMap activeMuscles={muscles} size={32} /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {medal && <span style={{ fontSize: 12 }}>{medal}</span>}
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.exerciseTitle}</p>
                      </div>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{formatDateShort(pr.date)}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{formatWeight(pr.weight)} &times; {pr.reps}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatVolume(pr.weight * pr.reps)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Top Exercises */}
        {topExercises.length > 0 && (
          <Card>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Most Performed</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Your go-to exercises</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {topExercises.map(([name, count], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i === topExercises.length - 1 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 18 }}>{i + 1}</span>
                  <p style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{count}x</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Highlight records */}
        <Card>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Highlights</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {heaviestSet && (
              <HighlightRow emoji="🏋️" label="Heaviest Lift" value={formatWeight(heaviestSet.weight)} sub={`${heaviestSet.exercise} — ${formatDateShort(heaviestSet.date)}`} />
            )}
            {biggestWorkout && (
              <HighlightRow emoji="📈" label="Biggest Session" value={formatVolume(biggestWorkout.volume)} sub={`${biggestWorkout.title} — ${formatDateShort(biggestWorkout.date)}`} />
            )}
            {longestWorkout && (
              <HighlightRow emoji="⏱️" label="Longest Workout" value={`${longestWorkout.duration}m`} sub={`${longestWorkout.title} — ${formatDateShort(longestWorkout.date)}`} />
            )}
            {bestWeek && (
              <HighlightRow emoji="🗓️" label="Best Week" value={`${bestWeek.count} sessions`} sub={`Week of ${fmtWeek(bestWeek.week)}`} />
            )}
            <HighlightRow emoji="🔢" label="Total PRs" value={`${prs.size}`} sub={`Across ${uniqueExercises} exercises`} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(22,22,22,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 22 }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{children}</p>;
}

function BigNum({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 6 }}>{children}</p>;
}

function Detail({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{children}</p>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {children}
    </span>
  );
}

function MiniStat({ emoji, value }: { emoji: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}

function SetRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", width: 36, textAlign: "right" }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", width: 28, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function HighlightRow({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</p>
        <p style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function fmtWeek(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
