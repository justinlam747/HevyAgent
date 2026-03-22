"use client";

import Body from "react-muscle-highlighter";
import type { ExtendedBodyPart, Slug } from "react-muscle-highlighter";

/**
 * Maps Hevy API muscle group names to react-muscle-highlighter slugs.
 */
const HEVY_TO_SLUG: Record<string, Slug> = {
  chest: "chest",
  shoulders: "deltoids",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  lats: "upper-back",
  upper_back: "upper-back",
  traps: "trapezius",
  lower_back: "lower-back",
  quadriceps: "quadriceps",
  hamstrings: "hamstring",
  glutes: "gluteal",
  calves: "calves",
  abdominals: "abs",
  abductors: "adductors",
  adductors: "adductors",
  neck: "neck",
  cardio: "chest", // fallback
  full_body: "chest", // handled separately
  other: "chest",
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#ef4444",
  shoulders: "#f97316",
  biceps: "#eab308",
  triceps: "#84cc16",
  forearms: "#22c55e",
  lats: "#14b8a6",
  upper_back: "#06b6d4",
  traps: "#0ea5e9",
  lower_back: "#3b82f6",
  quadriceps: "#6366f1",
  hamstrings: "#8b5cf6",
  glutes: "#a855f7",
  calves: "#d946ef",
  abdominals: "#ec4899",
  cardio: "#f43f5e",
  full_body: "#64748b",
  other: "#94a3b8",
  abductors: "#c084fc",
  adductors: "#e879f9",
  neck: "#fb7185",
};

// Which Hevy muscles appear on front vs back
const FRONT_MUSCLES = new Set(["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "quadriceps", "adductors", "neck"]);
const BACK_MUSCLES = new Set(["traps", "upper_back", "lats", "lower_back", "glutes", "hamstrings", "abductors"]);

// Full body slugs for highlighting everything
const ALL_SLUGS: Slug[] = ["abs", "adductors", "biceps", "calves", "chest", "deltoids", "forearm", "gluteal", "hamstring", "lower-back", "neck", "obliques", "quadriceps", "trapezius", "triceps", "upper-back"];

export default function MuscleMap({
  activeMuscles,
  size = 80,
}: {
  activeMuscles: string[];
  size?: number;
}) {
  const isFullBody = activeMuscles.some((m) => m === "full_body" || m === "cardio");
  const hasFront = activeMuscles.some((m) => FRONT_MUSCLES.has(m));
  const hasBack = activeMuscles.some((m) => BACK_MUSCLES.has(m));
  const showBoth = hasFront && hasBack;

  // Build body part data
  function buildData(muscles: string[]): ExtendedBodyPart[] {
    if (isFullBody) {
      return ALL_SLUGS.map((slug) => ({
        slug,
        color: "#4f9cf7",
        intensity: 1,
      }));
    }

    // Dedupe by slug — if multiple hevy muscles map to same slug, pick first color
    const seen = new Map<Slug, string>();
    for (const m of muscles) {
      const slug = HEVY_TO_SLUG[m];
      if (slug && !seen.has(slug)) {
        seen.set(slug, MUSCLE_COLORS[m] ?? "#64748b");
      }
    }

    return Array.from(seen.entries()).map(([slug, color]) => ({
      slug,
      color,
      intensity: 1,
    }));
  }

  const data = buildData(activeMuscles);
  const scale = size / 200; // library default is ~200px tall

  return (
    <div className="flex items-center gap-0.5" style={{ height: size }}>
      {(hasFront || !hasBack || isFullBody) && (
        <Body
          data={data}
          side="front"
          gender="male"
          scale={showBoth ? scale * 0.55 : scale * 0.9}
          border="none"
          defaultFill="rgba(255,255,255,0.04)"
          defaultStroke="rgba(255,255,255,0.1)"
          defaultStrokeWidth={0.5}
        />
      )}
      {(hasBack || isFullBody) && (
        <Body
          data={data}
          side="back"
          gender="male"
          scale={showBoth ? scale * 0.55 : scale * 0.9}
          border="none"
          defaultFill="rgba(255,255,255,0.04)"
          defaultStroke="rgba(255,255,255,0.1)"
          defaultStrokeWidth={0.5}
        />
      )}
    </div>
  );
}
// commit-marker-28
// commit-marker-38
