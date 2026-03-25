import type { Workout, ExerciseTemplate, HevySet } from "./hevy";

// Muscle group mapping from exercise templates
export function getMuscleGroups(
  workout: Workout,
  templates: Map<string, ExerciseTemplate>
): string[] {
  const muscles = new Set<string>();
  workout.exercises.forEach((ex) => {
    const tmpl = templates.get(ex.exercise_template_id);
    if (tmpl) {
      muscles.add(tmpl.primary_muscle_group);
      tmpl.secondary_muscle_groups.forEach((m) => muscles.add(m));
    }
  });
  return Array.from(muscles);
}

export function getPrimaryMuscles(
  workout: Workout,
  templates: Map<string, ExerciseTemplate>
): string[] {
  const muscles = new Set<string>();
  workout.exercises.forEach((ex) => {
    const tmpl = templates.get(ex.exercise_template_id);
    if (tmpl) muscles.add(tmpl.primary_muscle_group);
  });
  return Array.from(muscles);
}

// Total volume (kg) for a workout
export function workoutVolume(workout: Workout): number {
  return workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((setTotal, s) => {
      if (s.type === "warmup") return setTotal;
      return setTotal + (s.weight_kg ?? 0) * (s.reps ?? 0);
    }, 0);
  }, 0);
}

// Total sets (excluding warmups)
export function workoutSets(workout: Workout): number {
  return workout.exercises.reduce((total, ex) => {
    return total + ex.sets.filter((s) => s.type !== "warmup").length;
  }, 0);
}

// Duration in minutes
export function workoutDuration(workout: Workout): number {
  const start = new Date(workout.start_time).getTime();
  const end = new Date(workout.end_time).getTime();
  return Math.round((end - start) / 60000);
}

// PR detection: best set per exercise across all workouts
export interface PersonalRecord {
  exerciseTitle: string;
  weight: number;
  reps: number;
  date: string;
  workoutId: string;
}

export function findPRs(workouts: Workout[]): Map<string, PersonalRecord> {
  const prs = new Map<string, PersonalRecord>();

  workouts.forEach((w) => {
    w.exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.type === "warmup" || !s.weight_kg || !s.reps) return;
        const volume = s.weight_kg * s.reps;
        const key = ex.title;
        const current = prs.get(key);
        if (!current || volume > current.weight * current.reps) {
          prs.set(key, {
            exerciseTitle: ex.title,
            weight: s.weight_kg,
            reps: s.reps,
            date: w.start_time,
            workoutId: w.id,
          });
        }
      });
    });
  });

  return prs;
}

// Weekly frequency
export function weeklyFrequency(workouts: Workout[]): { week: string; count: number }[] {
  const weeks = new Map<string, number>();
  workouts.forEach((w) => {
    const d = new Date(w.start_time);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    weeks.set(key, (weeks.get(key) ?? 0) + 1);
  });
  return Array.from(weeks.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// Volume over time (weekly)
export function weeklyVolume(workouts: Workout[]): { week: string; volume: number }[] {
  const weeks = new Map<string, number>();
  workouts.forEach((w) => {
    const d = new Date(w.start_time);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    weeks.set(key, (weeks.get(key) ?? 0) + workoutVolume(w));
  });
  return Array.from(weeks.entries())
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// Muscle group frequency over last N workouts
export function muscleGroupFrequency(
  workouts: Workout[],
  templates: Map<string, ExerciseTemplate>,
  n?: number
): { muscle: string; count: number }[] {
  const subset = n ? workouts.slice(0, n) : workouts;
  const freq = new Map<string, number>();
  subset.forEach((w) => {
    const muscles = getPrimaryMuscles(w, templates);
    muscles.forEach((m) => freq.set(m, (freq.get(m) ?? 0) + 1));
  });
  return Array.from(freq.entries())
    .map(([muscle, count]) => ({ muscle, count }))
    .sort((a, b) => b.count - a.count);
}

// Detect split pattern from recent workouts
export function detectSplit(
  workouts: Workout[],
  templates: Map<string, ExerciseTemplate>
): string {
  const recent = workouts.slice(0, 14);
  const patterns = recent.map((w) => getPrimaryMuscles(w, templates).sort().join("+"));
  const unique = new Set(patterns);

  if (unique.size <= 2) return "Full Body / Minimal Split";
  if (unique.size <= 4) return "Upper/Lower or Push/Pull";
  return "Push/Pull/Legs or Bro Split";
}
