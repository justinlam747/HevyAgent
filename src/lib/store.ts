import { useState, useEffect, useCallback } from "react";
import type { Workout, ExerciseTemplate } from "./hevy";
import { fetchAllWorkouts, fetchAllTemplates } from "./hevy";

const API_KEY_STORAGE = "hevy_api_key";
const WORKOUTS_CACHE = "hevy_workouts";
const TEMPLATES_CACHE = "hevy_templates";
const CACHE_TTL = 1000 * 60 * 15; // 15 min

function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    setApiKey(localStorage.getItem(API_KEY_STORAGE) ?? "");
  }, []);

  const saveKey = useCallback((key: string) => {
    localStorage.setItem(API_KEY_STORAGE, key);
    setApiKey(key);
  }, []);

  const clearKey = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(WORKOUTS_CACHE);
    localStorage.removeItem(TEMPLATES_CACHE);
    setApiKey("");
  }, []);

  return { apiKey, saveKey, clearKey };
}

export function useHevyData(apiKey: string) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<Map<string, ExerciseTemplate>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (!force) {
        const cachedW = getCache<Workout[]>(WORKOUTS_CACHE);
        const cachedT = getCache<ExerciseTemplate[]>(TEMPLATES_CACHE);
        if (cachedW && cachedT) {
          setWorkouts(cachedW);
          const tMap = new Map(cachedT.map((t) => [t.id, t]));
          setTemplates(tMap);
          setLoading(false);
          return;
        }
      }

      const [w, t] = await Promise.all([
        fetchAllWorkouts(apiKey),
        fetchAllTemplates(apiKey),
      ]);

      setCache(WORKOUTS_CACHE, w);
      setCache(TEMPLATES_CACHE, t);
      setWorkouts(w);
      setTemplates(new Map(t.map((tmpl) => [tmpl.id, tmpl])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) load();
  }, [apiKey, load]);

  return { workouts, templates, loading, error, refresh: () => load(true) };
}
