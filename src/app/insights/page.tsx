"use client";

import Insights from "@/components/Insights";
import { useAppData } from "@/lib/app-context";

export default function InsightsPage() {
  const { workouts, templates } = useAppData();
  return <Insights workouts={workouts} templates={templates} />;
}
