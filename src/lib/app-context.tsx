"use client";

import { createContext, useContext } from "react";
import type { Workout, ExerciseTemplate, Routine } from "./hevy";

interface AppData {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  routines: Routine[];
  onSelectWorkout: (w: Workout) => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({
  children,
  workouts,
  templates,
  routines,
  onSelectWorkout,
}: AppData & { children: React.ReactNode }) {
  return (
    <AppDataContext.Provider value={{ workouts, templates, routines, onSelectWorkout }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
// commit-marker-12
// commit-marker-13
// commit-marker-53
// commit-marker-54
