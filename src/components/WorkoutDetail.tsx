"use client";

import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { workoutVolume, workoutDuration, workoutSets, getPrimaryMuscles } from "@/lib/insights";
import { formatDate, formatWeight, formatVolume, formatDuration, capitalize } from "@/lib/utils";

export default function WorkoutDetail({
  workout,
  templates,
  onBack,
}: {
  workout: Workout;
  templates: Map<string, ExerciseTemplate>;
  onBack: () => void;
}) {
  const volume = workoutVolume(workout);
  const duration = workoutDuration(workout);
  const sets = workoutSets(workout);
  const muscles = getPrimaryMuscles(workout, templates);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        &larr; Back
      </button>

      <div>
        <h2 className="text-xl font-semibold">{workout.title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{formatDate(workout.start_time)}</p>
        {workout.description && (
          <p className="text-sm text-[var(--text-muted)] mt-1">{workout.description}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-lg font-semibold">{formatVolume(volume)}</div>
          <div className="text-xs text-[var(--text-muted)]">Volume</div>
        </div>
        <div className="card text-center">
          <div className="text-lg font-semibold">{formatDuration(duration)}</div>
          <div className="text-xs text-[var(--text-muted)]">Duration</div>
        </div>
        <div className="card text-center">
          <div className="text-lg font-semibold">{sets}</div>
          <div className="text-xs text-[var(--text-muted)]">Sets</div>
        </div>
      </div>

      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {muscles.map((m) => (
            <span
              key={m}
              className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]"
            >
              {capitalize(m)}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {workout.exercises.map((ex) => (
          <div key={ex.index} className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{ex.title}</h3>
              <span className="text-xs text-[var(--text-muted)]">
                {ex.sets.filter((s) => s.type !== "warmup").length} sets
              </span>
            </div>
            {ex.notes && (
              <p className="text-xs text-[var(--text-muted)]">{ex.notes}</p>
            )}
            <div className="space-y-1">
              {ex.sets.map((s) => (
                <div
                  key={s.index}
                  className="flex items-center gap-3 text-xs"
                >
                  <span className="w-6 text-[var(--text-muted)]">
                    {s.type === "warmup" ? "W" : s.index + 1}
                  </span>
                  {s.weight_kg !== null && (
                    <span>{formatWeight(s.weight_kg)}</span>
                  )}
                  {s.reps !== null && (
                    <span className="text-[var(--text-muted)]">&times; {s.reps}</span>
                  )}
                  {s.duration_seconds !== null && (
                    <span>{s.duration_seconds}s</span>
                  )}
                  {s.rpe !== null && (
                    <span className="text-[var(--orange)]">RPE {s.rpe}</span>
                  )}
                  {s.type === "dropset" && (
                    <span className="text-[var(--red)] text-[10px]">DROP</span>
                  )}
                  {s.type === "failure" && (
                    <span className="text-[var(--red)] text-[10px]">FAIL</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

