"use client";

import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { workoutVolume, workoutDuration, workoutSets, getPrimaryMuscles } from "@/lib/insights";
import { formatDate, formatWeight, formatVolume, formatDuration, capitalize } from "@/lib/utils";
import { ArrowLeft, Dumbbell, Clock, Layers } from "lucide-react";
import MuscleMap from "./MuscleMap";

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
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, fontWeight: 500, padding: 0, marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header tile */}
      <div className="tile" style={{ cursor: "default", marginBottom: 16 }}>
        <div className="tile-head" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MuscleMap activeMuscles={muscles} size={64} />
          <div>
            <p className="tile-head-title" style={{ fontSize: 22 }}>{workout.title}</p>
            <p className="tile-head-sub" style={{ fontSize: 13 }}>{formatDate(workout.start_time)}</p>
            {workout.description && <p className="tile-head-sub" style={{ marginTop: 4 }}>{workout.description}</p>}
          </div>
        </div>
        <div className="tile-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                <Dumbbell size={14} style={{ color: "var(--accent)" }} />
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{formatVolume(volume)}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Volume</p>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                <Clock size={14} style={{ color: "var(--accent)" }} />
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{formatDuration(duration)}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Duration</p>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                <Layers size={14} style={{ color: "var(--accent)" }} />
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{sets}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Sets</p>
            </div>
          </div>
          {muscles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {muscles.map((m) => (
                <span key={m} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "transparent", color: "var(--accent)", fontWeight: 500, border: "1px solid rgba(79,156,247,0.2)", boxShadow: "0 1px 4px rgba(79,156,247,0.08)" }}>
                  {capitalize(m)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exercise tiles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {workout.exercises.map((ex) => {
          const tmpl = templates.get(ex.exercise_template_id);
          const workingSets = ex.sets.filter((s) => s.type !== "warmup");
          return (
            <div key={ex.index} className="tile" style={{ cursor: "default" }}>
              <div className="tile-head">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p className="tile-head-title">{ex.title}</p>
                    <p className="tile-head-sub">
                      {tmpl ? capitalize(tmpl.primary_muscle_group) : ""} &middot; {workingSets.length} working sets
                    </p>
                  </div>
                </div>
                {ex.notes && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>{ex.notes}</p>}
              </div>
              <div className="tile-body">
                {/* Set header */}
                <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 60px", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textAlign: "center" }}>SET</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>WEIGHT</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>REPS</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textAlign: "right" }}>TYPE</span>
                </div>
                {ex.sets.map((s) => (
                  <div key={s.index} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 60px", gap: 8, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: s.type === "warmup" ? "var(--text-muted)" : "var(--accent)", textAlign: "center" }}>
                      {s.type === "warmup" ? "W" : s.index + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>
                      {s.weight_kg !== null ? formatWeight(s.weight_kg) : "—"}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>
                      {s.reps !== null ? s.reps : s.duration_seconds !== null ? `${s.duration_seconds}s` : "—"}
                    </span>
                    <div style={{ textAlign: "right", display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      {s.type === "warmup" && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(249,115,22,0.1)", color: "#f97316", fontWeight: 500 }}>WARM</span>}
                      {s.type === "failure" && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 500 }}>FAIL</span>}
                      {s.type === "dropset" && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(168,85,247,0.1)", color: "#a855f7", fontWeight: 500 }}>DROP</span>}
                      {s.rpe !== null && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(249,115,22,0.1)", color: "#fb923c", fontWeight: 500 }}>RPE {s.rpe}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
