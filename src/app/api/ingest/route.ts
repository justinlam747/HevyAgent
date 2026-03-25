import { NextRequest, NextResponse } from "next/server";
import { VectorDB } from "@/lib/vectordb";
import { ingestWorkouts } from "@/lib/ingest";
import { setCachedSession } from "@/lib/server-cache";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      hevyApiKey,
      workouts,
      templates: templatesArr,
    }: {
      hevyApiKey: string;
      workouts: Workout[];
      templates: ExerciseTemplate[];
    } = body;

    if (!hevyApiKey) {
      return NextResponse.json({ error: "Hevy API key required" }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured on server" }, { status: 500 });
    }

    const templates = new Map(templatesArr.map((t: ExerciseTemplate) => [t.id, t]));
    const vectorDb = new VectorDB(openaiKey);
    const count = await ingestWorkouts(workouts, templates, vectorDb);

    setCachedSession(hevyApiKey, workouts, templates, vectorDb);

    return NextResponse.json({ success: true, count, totalStored: vectorDb.size });
  } catch (error) {
    console.error("[ingest]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingest error" },
      { status: 500 }
    );
  }
}
// commit-marker-32
// commit-marker-34
// commit-marker-73
// commit-marker-75
