"use client";

import Insights from "@/components/Insights";
import { useAppData } from "@/lib/app-context";

export default function InsightsPage() {
  const { workouts, templates } = useAppData();
  return <Insights workouts={workouts} templates={templates} />;
}
// commit-marker-9
// commit-marker-16
// commit-marker-50
