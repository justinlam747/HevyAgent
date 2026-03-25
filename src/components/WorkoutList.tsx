"use client";

import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { workoutVolume, workoutDuration, workoutSets, getPrimaryMuscles } from "@/lib/insights";
import { formatDate, formatVolume, formatDuration, capitalize } from "@/lib/utils";
import { Clock, Dumbbell, Layers } from "lucide-react";
import MuscleMap from "./MuscleMap";

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
    <div className="workout-grid">
      {workouts.map((w) => {
        const muscles = getPrimaryMuscles(w, templates);
        const vol = workoutVolume(w);
        const dur = workoutDuration(w);
        const sets = workoutSets(w);
        const exerciseNames = w.exercises.slice(0, 5).map((e) => e.title);
        const moreCount = w.exercises.length - 5;

        return (
          <button key={w.id} onClick={() => onSelect(w)} className="workout-tile">
            {/* Head: title + date + muscles */}
            <div className="workout-tile-head">
              <div className="workout-tile-title">{w.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {formatDate(w.start_time)}
              </div>
              {muscles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                  {muscles.map((m) => (
                    <span key={m} style={{
                      fontSize: 11, padding: "3px 9px", borderRadius: 6,
                      background: "transparent", color: "var(--accent)", fontWeight: 500,
                      border: "1px solid rgba(79,156,247,0.2)",
                      boxShadow: "0 1px 4px rgba(79,156,247,0.08)",
                    }}>
                      {capitalize(m)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Body: muscle map + exercises + stats */}
            <div className="workout-tile-body">
              <div className="workout-tile-map">
                <MuscleMap activeMuscles={muscles} size={90} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Exercise preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {exerciseNames.map((name, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", opacity: 0.5, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    </div>
                  ))}
                  {moreCount > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 11 }}>+{moreCount} more</span>
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 14, marginTop: "auto", paddingTop: 4 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
                    <Dumbbell size={13} /> {formatVolume(vol)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
                    <Clock size={13} /> {formatDuration(dur)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
                    <Layers size={13} /> {sets} sets
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
// commit-marker-33
// commit-marker-74
