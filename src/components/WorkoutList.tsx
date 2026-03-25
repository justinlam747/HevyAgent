"use client";

import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { workoutVolume, workoutDuration, workoutSets, getPrimaryMuscles } from "@/lib/insights";
import { formatDate, formatVolume, formatDuration, capitalize } from "@/lib/utils";
import { Clock, Dumbbell, Layers, ChevronRight } from "lucide-react";

export default function WorkoutList({
  workouts,
  templates,
  onSelect,
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  onSelect: (w: Workout) => void;
}) {
  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_120px_100px_80px_70px_24px] gap-3 px-4 py-2 text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wide border-b border-[var(--border)]">
        <span>Workout</span>
        <span>Date</span>
        <span>Volume</span>
        <span>Duration</span>
        <span>Sets</span>
        <span />
      </div>

      {/* Workout rows */}
      {workouts.map((w) => {
        const muscles = getPrimaryMuscles(w, templates);
        const vol = workoutVolume(w);
        const dur = workoutDuration(w);
        const sets = workoutSets(w);

        return (
          <button
            key={w.id}
            onClick={() => onSelect(w)}
            className="grid grid-cols-[1fr_120px_100px_80px_70px_24px] gap-3 items-center w-full px-4 py-3 text-left rounded-lg transition-all hover:brightness-125"
            style={{
              background: "rgba(22, 22, 22, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            {/* Title + muscles */}
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {w.title}
              </div>
              {muscles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {muscles.map((m) => (
                    <span
                      key={m}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                    >
                      {capitalize(m)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Date */}
            <span className="text-[12px] text-[var(--text-secondary)]">
              {formatDate(w.start_time)}
            </span>

            {/* Volume */}
            <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
              <Dumbbell size={12} className="text-[var(--text-muted)]" />
              {formatVolume(vol)}
            </span>

            {/* Duration */}
            <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
              <Clock size={12} className="text-[var(--text-muted)]" />
              {formatDuration(dur)}
            </span>

            {/* Sets */}
            <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
              <Layers size={12} className="text-[var(--text-muted)]" />
              {sets}
            </span>

            {/* Arrow */}
            <ChevronRight size={14} className="text-[var(--text-muted)]" />
          </button>
        );
      })}
    </div>
  );
}
