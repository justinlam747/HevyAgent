const BASE = "https://api.hevyapp.com/v1";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;

async function hevyFetch<T>(path: string, apiKey: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url.toString(), {
        headers: { "api-key": apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429 || (res.status >= 500 && attempt < MAX_RETRIES)) {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Hevy API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      console.log(`[hevy] ${path}`, json);
      return json;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Hevy API: max retries exceeded for ${path}`);
}

// Types
export interface HevySet {
  index: number;
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}

export interface HevyExercise {
  index: number;
  title: string;
  notes: string;
  exercise_template_id: string;
  superset_id: number | null;
  sets: HevySet[];
}

export interface Workout {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  exercises: HevyExercise[];
}

export interface ExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  is_custom: boolean;
}

interface PaginatedResponse<T> {
  page: number;
  page_count: number;
  [key: string]: unknown;
}

function extractItems<T>(data: Record<string, unknown>): T[] {
  // The API may nest items under different keys (workouts, exercise_templates, etc.)
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) return data[key] as T[];
  }
  return [];
}

// Fetch all workouts (handles pagination)
export async function fetchAllWorkouts(apiKey: string): Promise<Workout[]> {
  const all: Workout[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const data = await hevyFetch<PaginatedResponse<Workout>>(
      "/workouts",
      apiKey,
      { page: String(page), page_size: "10" }
    );
    all.push(...extractItems<Workout>(data));
    pageCount = data.page_count;
    page++;
  }

  return all.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

// Fetch all exercise templates
export async function fetchAllTemplates(apiKey: string): Promise<ExerciseTemplate[]> {
  const all: ExerciseTemplate[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const data = await hevyFetch<PaginatedResponse<ExerciseTemplate>>(
      "/exercise_templates",
      apiKey,
      { page: String(page), page_size: "100" }
    );
    all.push(...extractItems<ExerciseTemplate>(data));
    pageCount = data.page_count;
    page++;
  }

  return all;
}

export async function fetchWorkoutCount(apiKey: string): Promise<number> {
  const data = await hevyFetch<{ workout_count: number }>("/workouts/count", apiKey);
  return data.workout_count;
}

// Routines (saved workout templates in the Hevy app)
export interface RoutineSet {
  index: number;
  type: string;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}

export interface RoutineExercise {
  index: number;
  title: string;
  rest_seconds: string | null;
  notes: string;
  exercise_template_id: string;
  supersets_id: number | null;
  sets: RoutineSet[];
}

export interface Routine {
  id: string;
  title: string;
  folder_id: number | null;
  updated_at: string;
  created_at: string;
  exercises: RoutineExercise[];
}

export async function fetchAllRoutines(apiKey: string): Promise<Routine[]> {
  const all: Routine[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const data = await hevyFetch<PaginatedResponse<Routine>>(
      "/routines",
      apiKey,
      { page: String(page), page_size: "10" }
    );
    all.push(...extractItems<Routine>(data));
    pageCount = data.page_count;
    page++;
  }

  return all;
}
// commit-marker-6
// commit-marker-19
// commit-marker-47
