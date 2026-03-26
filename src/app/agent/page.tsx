"use client";

import ChatBot from "@/components/ChatBot";
import { useAppData } from "@/lib/app-context";

export default function AgentPage() {
  const { workouts, templates } = useAppData();
  return <ChatBot workouts={workouts} templates={templates} />;
}
