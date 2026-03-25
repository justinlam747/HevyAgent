"use client";

import { useMemo } from "react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import {
  findPRs,
  weeklyFrequency,
  weeklyVolume,
  muscleGroupFrequency,
  detectSplit,
  workoutVolume,
  workoutDuration,
} from "@/lib/insights";
import { formatWeight, formatVolume, capitalize, formatDateShort } from "@/lib/utils";

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

  // Summary stats
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

  const topPRs = Array.from(prs.values())
    .sort((a, b) => b.weight * b.reps - a.weight * a.reps)
    .slice(0, 8);

  const maxMuscleCount = muscleFreq.length > 0 ? muscleFreq[0].count : 1;
  const maxVolWeek = volData.length > 0 ? Math.max(...volData.map((v) => v.volume)) : 1;
  const recentVol = volData.slice(-12);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Workouts" value={String(totalWorkouts)} />
        <StatCard label="Avg Volume" value={formatVolume(avgVolume)} />
        <StatCard label="Avg Duration" value={`${avgDuration}m`} />
        <StatCard label="Avg/Week" value={avgFreq} />
      </div>

      {/* Split Detection */}
      <div className="card">
        <div className="text-xs text-[var(--text-muted)] mb-1">Detected Split</div>
        <div className="text-sm font-medium">{split}</div>
      </div>

      {/* Volume Trend */}
      {recentVol.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-muted)]">Weekly Volume (last 12 weeks)</h3>
          <div className="flex items-end gap-1 h-24">
            {recentVol.map((v) => (
              <div key={v.week} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-[var(--accent)]"
                  style={{ height: `${(v.volume / maxVolWeek) * 100}%`, minHeight: 2 }}
                  title={`${v.week}: ${formatVolume(v.volume)}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>{recentVol[0]?.week}</span>
            <span>{recentVol[recentVol.length - 1]?.week}</span>
          </div>
        </div>
      )}

      {/* Muscle Group Frequency */}
      {muscleFreq.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            Muscle Frequency (last 30 workouts)
          </h3>
          <div className="space-y-1.5">
            {muscleFreq.slice(0, 10).map((m) => (
              <div key={m.muscle} className="flex items-center gap-2">
                <span className="text-xs w-24 text-right text-[var(--text-muted)]">
                  {capitalize(m.muscle)}
                </span>
                <div className="flex-1 h-4 bg-[var(--bg-hover)] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-sm transition-all"
                    style={{ width: `${(m.count / maxMuscleCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-6">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personal Records */}
      {topPRs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-muted)]">Top Personal Records</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {topPRs.map((pr) => (
              <div key={pr.exerciseTitle} className="card flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{pr.exerciseTitle}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {formatDateShort(pr.date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {formatWeight(pr.weight)} &times; {pr.reps}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {formatVolume(pr.weight * pr.reps)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
