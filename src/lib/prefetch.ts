// Karpathy-style pre-research: cheap embedding retrieval pass
// before expensive LLM call. Only send relevant context to the model,
// drastically cutting token usage.

import { VectorDB } from "./vectordb";
import type { Workout, ExerciseTemplate } from "./hevy";
import { workoutVolume, workoutDuration, getPrimaryMuscles } from "./insights";
import { formatVolume, formatDuration, capitalize } from "./utils";

// Intent classification via keyword matching (zero LLM cost)
type Intent =
  | "stats_overview"
  | "exercise_specific"
  | "workout_search"
  | "build_workout"
  | "muscle_analysis"
  | "progression"
  | "general";

const INTENT_PATTERNS: [RegExp, Intent][] = [
  [/\b(stats|overview|summary|how\s+am\s+i|total)\b/i, "stats_overview"],
  [/\b(bench|squat|deadlift|curl|press|row|pull|fly|raise|extension|lunge)\b/i, "exercise_specific"],
  [/\b(build|create|make|generate|design|suggest)\s+(me\s+)?(a\s+)?workout/i, "build_workout"],
  [/\b(build|create|make|generate|design|suggest)\s+(me\s+)?(a\s+)?(push|pull|leg|chest|back|shoulder|arm)/i, "build_workout"],
  [/\b(muscle|group|neglect|imbalanc|weak|strong|frequency)/i, "muscle_analysis"],
  [/\b(progress|trend|improv|plateau|stall|grow|gain)/i, "progression"],
  [/\b(find|search|when|last\s+time|history)\b/i, "workout_search"],
];

function classifyIntent(query: string): Intent {
  for (const [pattern, intent] of INTENT_PATTERNS) {
    if (pattern.test(query)) return intent;
  }
  return "general";
}

export interface PrefetchContext {
  intent: Intent;
  relevantContext: string;
  tokenEstimate: number;
  toolHints: string[];
}

export async function prefetchContext(
  query: string,
  workouts: Workout[],
  templates: Map<string, ExerciseTemplate>,
  vectorDb: VectorDB
): Promise<PrefetchContext> {
  const intent = classifyIntent(query);
  let relevantContext = "";
  const toolHints: string[] = [];

  switch (intent) {
    case "stats_overview": {
      // No RAG needed — agent can use get_stats tool directly
      toolHints.push("get_stats");
      relevantContext = `User has ${workouts.length} total workouts. Use get_stats tool for full overview.`;
      break;
    }

    case "exercise_specific": {
      // Extract exercise name and do targeted search
      toolHints.push("analyze_exercise", "search_workouts");
      const results = await vectorDb.query(query, 3);
      relevantContext = results
        .map((r) => r.document.text)
        .join("\n---\n");
      break;
    }

    case "build_workout": {
      // RAG: find similar past workouts for reference
      toolHints.push("build_workout", "search_workouts");
      const results = await vectorDb.query(query, 5);
      relevantContext = results
        .map((r) => r.document.text)
        .join("\n---\n");
      break;
    }

    case "muscle_analysis": {
      // Provide muscle frequency summary inline (no LLM call needed for data)
      toolHints.push("get_stats", "search_workouts");
      const muscleCount = new Map<string, number>();
      workouts.slice(0, 30).forEach((w) => {
        getPrimaryMuscles(w, templates).forEach((m) =>
          muscleCount.set(m, (muscleCount.get(m) ?? 0) + 1)
        );
      });
      const sorted = Array.from(muscleCount.entries()).sort((a, b) => b[1] - a[1]);
      relevantContext = `Muscle frequency (last 30 workouts):\n${sorted
        .map(([m, c]) => `${capitalize(m)}: ${c}`)
        .join("\n")}`;
      break;
    }

    case "progression": {
      // Targeted RAG for the exercise/muscle in question
      toolHints.push("analyze_exercise", "search_workouts");
      const results = await vectorDb.query(query, 5);
      relevantContext = results
        .map((r) => r.document.text)
        .join("\n---\n");
      break;
    }

    case "workout_search": {
      toolHints.push("search_workouts");
      const results = await vectorDb.query(query, 5);
      relevantContext = results
        .map((r) => r.document.text)
        .join("\n---\n");
      break;
    }

    default: {
      // General: light RAG pass
      toolHints.push("search_workouts", "get_stats");
      const results = await vectorDb.query(query, 3);
      relevantContext = results
        .map((r) => r.document.text)
        .join("\n---\n");
      break;
    }
  }

  const tokenEstimate = Math.ceil(relevantContext.length / 4);

  return { intent, relevantContext, tokenEstimate, toolHints };
}

// Build a minimal context injection for the system prompt
// instead of sending ALL workout data to the LLM
export function buildMinimalContext(
  prefetch: PrefetchContext,
  workoutCount: number
): string {
  if (!prefetch.relevantContext) return "";

  return `\n\n<retrieved_context intent="${prefetch.intent}">
The user has ${workoutCount} workouts total.
Suggested tools: ${prefetch.toolHints.join(", ")}

${prefetch.relevantContext}
</retrieved_context>`;
}
// commit-marker-11
// commit-marker-14
// commit-marker-52
