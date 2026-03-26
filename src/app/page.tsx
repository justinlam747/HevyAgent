"use client";

import WorkoutHub from "@/components/WorkoutHub";
import { useAppData } from "@/lib/app-context";

export default function HomePage() {
  const { workouts, templates, onSelectWorkout } = useAppData();
  return <WorkoutHub workouts={workouts} templates={templates} onSelectWorkout={onSelectWorkout} />;
}
