// Server-side in-memory cache for workouts, templates, and VectorDB.

import type { Workout, ExerciseTemplate } from "./hevy";
import { VectorDB } from "./vectordb";

interface CachedSession {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  vectorDb: VectorDB;
  lastAccess: number;
}

const sessions = new Map<string, CachedSession>();
const SESSION_TTL = 1000 * 60 * 30; // 30 min

function sessionKey(hevyApiKey: string): string {
  return hevyApiKey.slice(-12);
}

export function getCachedSession(hevyApiKey: string): CachedSession | null {
  const key = sessionKey(hevyApiKey);
  const session = sessions.get(key);
  if (!session) return null;
  if (Date.now() - session.lastAccess > SESSION_TTL) {
    sessions.delete(key);
    return null;
  }
  session.lastAccess = Date.now();
  return session;
}

export function setCachedSession(
  hevyApiKey: string,
  workouts: Workout[],
  templates: Map<string, ExerciseTemplate>,
  vectorDb: VectorDB
): void {
  const key = sessionKey(hevyApiKey);
  sessions.set(key, { workouts, templates, vectorDb, lastAccess: Date.now() });

  if (sessions.size > 10) {
    const now = Date.now();
    for (const [k, v] of sessions) {
      if (now - v.lastAccess > SESSION_TTL) sessions.delete(k);
    }
  }
}
