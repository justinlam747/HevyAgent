import type { Workout, ExerciseTemplate } from "./hevy";
import { workoutVolume, workoutDuration, workoutSets, getPrimaryMuscles } from "./insights";
import { formatVolume, formatDuration, capitalize, formatWeight } from "./utils";
import { VectorDB } from "./vectordb";

export async function ingestWorkouts(
  workouts: Workout[],
  templates: Map<string, ExerciseTemplate>,
  vectorDb: VectorDB
): Promise<number> {
  // Delta ingestion: only embed workouts not already in the DB
  const existingIds = new Set(
    workouts
      .filter((w) => vectorDb.getByMetadata("workoutId", w.id).length > 0)
      .map((w) => w.id)
  );
  const newWorkouts = workouts.filter((w) => !existingIds.has(w.id));
  if (newWorkouts.length === 0) return 0;

  const docs = newWorkouts.map((w) => {
    const muscles = getPrimaryMuscles(w, templates);
    const volume = workoutVolume(w);
    const duration = workoutDuration(w);
    const sets = workoutSets(w);
    const date = new Date(w.start_time).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const exerciseLines = w.exercises.map((ex) => {
      const exSets = ex.sets
        .filter((s) => s.type !== "warmup")
        .map((s) => {
          const parts: string[] = [];
          if (s.weight_kg) parts.push(formatWeight(s.weight_kg));
          if (s.reps) parts.push(`${s.reps} reps`);
          if (s.rpe) parts.push(`RPE ${s.rpe}`);
          return parts.join(" × ") || "bodyweight";
        });
      return `${ex.title}: ${exSets.join(", ")}`;
    });

    const text = `Workout: ${w.title}
Date: ${date}
Muscles: ${muscles.map(capitalize).join(", ")}
Volume: ${formatVolume(volume)}
Duration: ${formatDuration(duration)}
Total Sets: ${sets}
Exercises:
${exerciseLines.join("\n")}
${w.description ? `Notes: ${w.description}` : ""}`.trim();

    return {
      id: w.id,
      text,
      metadata: {
        workoutId: w.id,
        title: w.title,
        date: new Date(w.start_time).toLocaleDateString(),
        muscles: muscles.map(capitalize).join(", "),
        volume: formatVolume(volume),
        duration: formatDuration(duration),
        sets,
        type: "workout",
      },
    };
  });

  return vectorDb.upsert(docs);
}
// commit-marker-5
// commit-marker-20
// commit-marker-46
// commit-marker-61
// commit-marker-87
