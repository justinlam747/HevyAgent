import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ContentBlock, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { VectorDB } from "./vectordb";
import type { Workout, ExerciseTemplate } from "./hevy";
import {
  workoutVolume,
  workoutDuration,
  workoutSets,
  getPrimaryMuscles,
  findPRs,
  weeklyFrequency,
  muscleGroupFrequency,
  detectSplit,
} from "./insights";
import { formatWeight, formatVolume, formatDuration, capitalize } from "./utils";

export interface AgentDeps {
  anthropicKey: string;
  openaiKey: string;
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  vectorDb: VectorDB;
}

// --- Tool implementations ---

type ToolFn = (args: Record<string, unknown>, deps: AgentDeps) => Promise<string>;

const toolImpls: Record<string, ToolFn> = {
  async search_workouts({ query, limit }, deps) {
    const results = await deps.vectorDb.query(query as string, (limit as number) ?? 5);
    if (results.length === 0) return "No matching workouts found.";
    return results
      .map((r) => {
        const meta = r.document.metadata;
        return `[${meta.date}] ${meta.title} — ${meta.muscles} | Volume: ${meta.volume} | Duration: ${meta.duration} | Score: ${r.score.toFixed(2)}`;
      })
      .join("\n");
  },

  async get_stats(_args, deps) {
    const { workouts, templates } = deps;
    const total = workouts.length;
    const prs = findPRs(workouts);
    const freq = weeklyFrequency(workouts);
    const muscleFreq = muscleGroupFrequency(workouts, templates, 30);
    const split = detectSplit(workouts, templates);
    const avgVolume = total > 0
      ? Math.round(workouts.reduce((s, w) => s + workoutVolume(w), 0) / total)
      : 0;
    const avgDuration = total > 0
      ? Math.round(workouts.reduce((s, w) => s + workoutDuration(w), 0) / total)
      : 0;
    const avgFreq = freq.length > 0
      ? (freq.reduce((s, f) => s + f.count, 0) / freq.length).toFixed(1)
      : "0";

    const topPRs = Array.from(prs.values())
      .sort((a, b) => b.weight * b.reps - a.weight * a.reps)
      .slice(0, 5)
      .map((pr) => `${pr.exerciseTitle}: ${formatWeight(pr.weight)} × ${pr.reps}`)
      .join("\n");

    const topMuscles = muscleFreq
      .slice(0, 5)
      .map((m) => `${capitalize(m.muscle)}: ${m.count} sessions`)
      .join("\n");

    return `OVERVIEW:
Total workouts: ${total}
Avg volume/workout: ${formatVolume(avgVolume)}
Avg duration: ${avgDuration}m
Avg workouts/week: ${avgFreq}
Detected split: ${split}

TOP PRs (by set volume):
${topPRs}

MOST TRAINED (last 30 sessions):
${topMuscles}`;
  },

  async get_workout_detail({ index }, deps) {
    const idx = index as number;
    if (idx < 0 || idx >= deps.workouts.length) return "Invalid workout index.";
    const w = deps.workouts[idx];
    const muscles = getPrimaryMuscles(w, deps.templates);
    const exercises = w.exercises
      .map((ex) => {
        const sets = ex.sets
          .filter((s) => s.type !== "warmup")
          .map((s) => `${s.weight_kg ? formatWeight(s.weight_kg) : "BW"} × ${s.reps ?? "-"}`)
          .join(", ");
        return `  ${ex.title}: ${sets}`;
      })
      .join("\n");

    return `${w.title} — ${new Date(w.start_time).toLocaleDateString()}
Muscles: ${muscles.map(capitalize).join(", ")}
Volume: ${formatVolume(workoutVolume(w))} | Duration: ${formatDuration(workoutDuration(w))} | Sets: ${workoutSets(w)}
Exercises:
${exercises}`;
  },

  async analyze_exercise({ exerciseName }, deps) {
    const name = exerciseName as string;
    const matching = deps.workouts.flatMap((w) =>
      w.exercises
        .filter((ex) => ex.title.toLowerCase().includes(name.toLowerCase()))
        .map((ex) => ({
          date: w.start_time,
          sets: ex.sets.filter((s) => s.type !== "warmup"),
        }))
    );

    if (matching.length === 0) return `No data found for "${name}".`;

    const history = matching
      .slice(0, 10)
      .map((m) => {
        const best = m.sets.reduce(
          (b, s) => {
            const vol = (s.weight_kg ?? 0) * (s.reps ?? 0);
            return vol > b.vol ? { vol, s } : b;
          },
          { vol: 0, s: m.sets[0] }
        );
        return `${new Date(m.date).toLocaleDateString()}: Best set ${best.s?.weight_kg ? formatWeight(best.s.weight_kg) : "BW"} × ${best.s?.reps ?? "-"} (${m.sets.length} sets)`;
      })
      .join("\n");

    return `${name} — ${matching.length} sessions found\nRecent history:\n${history}`;
  },

  async build_workout({ goal, targetMuscles, durationMinutes }, deps) {
    const muscles = targetMuscles as string[];
    const similar = await deps.vectorDb.query(
      `${goal} ${muscles.join(" ")}`,
      5
    );

    const pastContext = similar.map((r) => r.document.text).join("\n---\n");

    return `CONTEXT FROM PAST WORKOUTS:\n${pastContext}\n\nGOAL: ${goal}\nTARGET MUSCLES: ${muscles.join(", ")}\nDURATION: ${durationMinutes ?? 60}min\n\nUse this context to generate an appropriate workout plan based on the user's history and preferences.`;
  },

  // --- NEW TOOLS ---

  async compare_periods({ period1Start, period1End, period2Start, period2End }, deps) {
    const { workouts, templates } = deps;
    const d = (s: string) => new Date(s as string).getTime();

    const p1 = workouts.filter((w) => {
      const t = new Date(w.start_time).getTime();
      return t >= d(period1Start as string) && t <= d(period1End as string);
    });
    const p2 = workouts.filter((w) => {
      const t = new Date(w.start_time).getTime();
      return t >= d(period2Start as string) && t <= d(period2End as string);
    });

    const summarize = (ws: Workout[], label: string) => {
      const totalVol = ws.reduce((s, w) => s + workoutVolume(w), 0);
      const avgVol = ws.length > 0 ? Math.round(totalVol / ws.length) : 0;
      const avgDur = ws.length > 0 ? Math.round(ws.reduce((s, w) => s + workoutDuration(w), 0) / ws.length) : 0;
      const muscles = new Map<string, number>();
      ws.forEach((w) => getPrimaryMuscles(w, templates).forEach((m) => muscles.set(m, (muscles.get(m) ?? 0) + 1)));
      const topMuscles = Array.from(muscles.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

      return `${label}:
  Workouts: ${ws.length}
  Total volume: ${formatVolume(totalVol)}
  Avg volume/workout: ${formatVolume(avgVol)}
  Avg duration: ${avgDur}m
  Top muscles: ${topMuscles.map(([m, c]) => `${capitalize(m)}(${c})`).join(", ")}`;
    };

    const volChange = p1.length > 0 && p2.length > 0
      ? ((p2.reduce((s, w) => s + workoutVolume(w), 0) / p2.length) /
         (p1.reduce((s, w) => s + workoutVolume(w), 0) / p1.length) - 1) * 100
      : 0;

    return `${summarize(p1, "Period 1")}\n\n${summarize(p2, "Period 2")}\n\nVolume change: ${volChange > 0 ? "+" : ""}${volChange.toFixed(1)}%`;
  },

  async fatigue_recovery(_args, deps) {
    const { workouts, templates } = deps;
    const recent = workouts.slice(0, 21); // Last ~3 weeks
    if (recent.length < 3) return "Not enough data for fatigue analysis (need at least 3 workouts).";

    // Weekly volume load
    const weeks = new Map<string, { vol: number; count: number; sets: number }>();
    recent.forEach((w) => {
      const d = new Date(w.start_time);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      const entry = weeks.get(key) ?? { vol: 0, count: 0, sets: 0 };
      entry.vol += workoutVolume(w);
      entry.count++;
      entry.sets += workoutSets(w);
      weeks.set(key, entry);
    });

    const weeklyData = Array.from(weeks.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, data]) => `  ${week}: ${data.count} sessions, ${formatVolume(data.vol)}, ${data.sets} sets`);

    // Rest day analysis
    const sortedDates = recent.map((w) => new Date(w.start_time).getTime()).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      gaps.push(Math.round((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24)));
    }
    const avgGap = gaps.length > 0 ? (gaps.reduce((s, g) => s + g, 0) / gaps.length).toFixed(1) : "N/A";
    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;

    // Volume trend detection
    const weekVols = Array.from(weeks.values()).map((w) => w.vol);
    let trend = "stable";
    if (weekVols.length >= 2) {
      const lastTwo = weekVols.slice(-2);
      const change = (lastTwo[1] - lastTwo[0]) / (lastTwo[0] || 1);
      if (change > 0.2) trend = "increasing (possible overreaching)";
      else if (change < -0.2) trend = "decreasing (possible deload/recovery)";
    }

    // Muscle frequency — check for overuse
    const muscleFreqMap = new Map<string, number>();
    recent.slice(0, 7).forEach((w) =>
      getPrimaryMuscles(w, templates).forEach((m) =>
        muscleFreqMap.set(m, (muscleFreqMap.get(m) ?? 0) + 1)
      )
    );
    const overworked = Array.from(muscleFreqMap.entries())
      .filter(([, c]) => c >= 4)
      .map(([m]) => capitalize(m));

    return `FATIGUE & RECOVERY ANALYSIS (last ${recent.length} workouts):

Weekly load:
${weeklyData.join("\n")}

Volume trend: ${trend}
Avg days between workouts: ${avgGap}
Longest rest: ${maxGap} days

${overworked.length > 0 ? `Potentially overworked muscles (4+ sessions in last 7 workouts): ${overworked.join(", ")}` : "No muscles appear overworked."}

Recommendation: ${
  trend.includes("overreaching")
    ? "Consider a deload week — reduce volume by 40-50%."
    : trend.includes("deload")
    ? "Good recovery phase. Ready to ramp volume back up."
    : "Training load looks sustainable. Monitor subjective fatigue."
}`;
  },

  async estimate_1rm({ exerciseName }, deps) {
    const name = exerciseName as string;
    const matching = deps.workouts.flatMap((w) =>
      w.exercises
        .filter((ex) => ex.title.toLowerCase().includes(name.toLowerCase()))
        .flatMap((ex) =>
          ex.sets
            .filter((s) => s.type !== "warmup" && s.weight_kg && s.reps && s.reps > 0 && s.reps <= 12)
            .map((s) => ({
              weight: s.weight_kg!,
              reps: s.reps!,
              date: w.start_time,
            }))
        )
    );

    if (matching.length === 0) return `No valid sets found for "${name}" (need non-warmup sets with 1-12 reps).`;

    // Epley formula: 1RM = weight × (1 + reps/30)
    // Brzycki formula: 1RM = weight × 36 / (37 - reps)
    const estimates = matching.map((s) => ({
      ...s,
      epley: s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30),
      brzycki: s.reps === 1 ? s.weight : (s.weight * 36) / (37 - s.reps),
    }));

    // Best estimated 1RM
    const bestEpley = estimates.reduce((best, e) => (e.epley > best.epley ? e : best));
    const bestBrzycki = estimates.reduce((best, e) => (e.brzycki > best.brzycki ? e : best));
    const avg1RM = (bestEpley.epley + bestBrzycki.brzycki) / 2;

    // Recent trend (last 5 sessions)
    const recentSessions = [...new Set(matching.map((m) => m.date))].slice(0, 5);
    const trend = recentSessions.map((date) => {
      const sessionSets = estimates.filter((e) => e.date === date);
      const best = sessionSets.reduce((b, e) => (e.epley > b.epley ? e : b));
      return `  ${new Date(date).toLocaleDateString()}: ${formatWeight(best.weight)} × ${best.reps} → est. 1RM ${formatWeight(Math.round(best.epley))}`;
    });

    // Training percentages
    const percentages = [95, 90, 85, 80, 75, 70, 65].map(
      (p) => `  ${p}%: ${formatWeight(Math.round(avg1RM * p / 100))}`
    );

    return `ESTIMATED 1RM for ${name}:

Epley: ${formatWeight(Math.round(bestEpley.epley))} (from ${formatWeight(bestEpley.weight)} × ${bestEpley.reps})
Brzycki: ${formatWeight(Math.round(bestBrzycki.brzycki))} (from ${formatWeight(bestBrzycki.weight)} × ${bestBrzycki.reps})
Average: ${formatWeight(Math.round(avg1RM))}

Recent 1RM estimates:
${trend.join("\n")}

Training percentages (based on avg):
${percentages.join("\n")}`;
  },
};

// --- Tool definitions for Claude ---

const TOOLS: Tool[] = [
  {
    name: "search_workouts",
    description: "Semantic search across all workout history. Use for finding workouts by muscle group, exercise name, date, or any workout-related query.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query about workouts" },
        limit: { type: "number", description: "Number of results (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_stats",
    description: "Get overall workout statistics, PRs, muscle frequency, and detected split pattern.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_workout_detail",
    description: "Get full detail of a specific workout by its index (0 = most recent).",
    input_schema: {
      type: "object" as const,
      properties: {
        index: { type: "number", description: "Workout index, 0 = most recent" },
      },
      required: ["index"],
    },
  },
  {
    name: "analyze_exercise",
    description: "Analyze progression history for a specific exercise by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        exerciseName: { type: "string", description: "Exercise name (partial match)" },
      },
      required: ["exerciseName"],
    },
  },
  {
    name: "build_workout",
    description: "Generate a workout plan based on goals, target muscles, and past workout history via RAG.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal: { type: "string", description: "Workout goal (e.g., 'hypertrophy chest and triceps')" },
        targetMuscles: { type: "array", items: { type: "string" }, description: "Target muscle groups" },
        durationMinutes: { type: "number", description: "Target duration in minutes (default 60)" },
      },
      required: ["goal", "targetMuscles"],
    },
  },
  {
    name: "compare_periods",
    description: "Compare training between two date ranges. Use ISO date strings (YYYY-MM-DD).",
    input_schema: {
      type: "object" as const,
      properties: {
        period1Start: { type: "string", description: "Start date for period 1 (YYYY-MM-DD)" },
        period1End: { type: "string", description: "End date for period 1 (YYYY-MM-DD)" },
        period2Start: { type: "string", description: "Start date for period 2 (YYYY-MM-DD)" },
        period2End: { type: "string", description: "End date for period 2 (YYYY-MM-DD)" },
      },
      required: ["period1Start", "period1End", "period2Start", "period2End"],
    },
  },
  {
    name: "fatigue_recovery",
    description: "Analyze training load, rest patterns, volume trends, and detect potential overreaching or recovery needs.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "estimate_1rm",
    description: "Estimate 1 rep max for an exercise using Epley and Brzycki formulas, plus training percentage table.",
    input_schema: {
      type: "object" as const,
      properties: {
        exerciseName: { type: "string", description: "Exercise name (partial match)" },
      },
      required: ["exerciseName"],
    },
  },
];

const SYSTEM_PROMPT = `You are HevyAgent, an expert fitness coach and workout analyst. You have access to the user's complete Hevy workout history through tools.

Your capabilities:
- Analyze workout patterns, volume, frequency, and splits
- Track personal records and exercise progression
- Build personalized workout plans based on their history
- Answer any question about their training data
- Give evidence-based training advice grounded in their actual data
- Compare training periods to track progress over time
- Analyze fatigue and recovery patterns
- Estimate 1 rep maxes from training data

Guidelines:
- Always use tools to ground your answers in real data — don't guess
- Be concise and direct
- Use specific numbers (weights, reps, volumes) when available
- When building workouts, reference their actual exercise history and PRs
- Format responses cleanly with markdown when helpful
- If the user asks something you can't answer from the data, say so clearly`;

// Execute tool calls from a Claude response
async function executeToolCalls(
  content: ContentBlock[],
  deps: AgentDeps
): Promise<ToolResultBlockParam[]> {
  const results: ToolResultBlockParam[] = [];
  for (const block of content) {
    if (block.type === "tool_use") {
      const fn = toolImpls[block.name];
      if (fn) {
        try {
          const result = await fn(block.input as Record<string, unknown>, deps);
          results.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } catch (e) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${e instanceof Error ? e.message : "Tool execution failed"}`,
            is_error: true,
          });
        }
      }
    }
  }
  return results;
}

// Streaming agent — yields text chunks for the final response
export async function* runAgentStream(
  messages: { role: "user" | "assistant"; content: string }[],
  deps: AgentDeps,
  prefetchedContext?: string
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: deps.anthropicKey });

  const systemContent = SYSTEM_PROMPT + (prefetchedContext ?? "");

  const claudeMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop — tool rounds (non-streaming, fast)
  let currentMessages = [...claudeMessages];
  for (let i = 0; i < 3; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemContent,
      tools: TOOLS,
      messages: currentMessages,
    });

    if (response.stop_reason !== "tool_use") {
      // Final response — extract text and yield it
      for (const block of response.content) {
        if (block.type === "text") {
          yield block.text;
        }
      }
      return;
    }

    // Tool calls needed — execute them
    const toolResults = await executeToolCalls(response.content, deps);
    currentMessages = [
      ...currentMessages,
      { role: "assistant" as const, content: response.content },
      { role: "user" as const, content: toolResults },
    ];
  }

  // Final streaming pass after tool rounds
  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemContent,
    tools: TOOLS,
    messages: currentMessages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// Non-streaming fallback (for compatibility)
export async function runAgent(
  messages: { role: "user" | "assistant"; content: string }[],
  deps: AgentDeps,
  prefetchedContext?: string
): Promise<string> {
  let result = "";
  for await (const chunk of runAgentStream(messages, deps, prefetchedContext)) {
    result += chunk;
  }
  return result;
}
