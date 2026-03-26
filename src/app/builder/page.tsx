"use client";

import WorkoutBuilder from "@/components/WorkoutBuilder";
import { useAppData } from "@/lib/app-context";

export default function BuilderPage() {
  const { workouts, templates, routines } = useAppData();
  return <WorkoutBuilder workouts={workouts} templates={templates} routines={routines} />;
}
