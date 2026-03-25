"use client";

import { useState } from "react";
import { useApiKey, useHevyData } from "@/lib/store";
import type { Workout } from "@/lib/hevy";
import ApiKeyForm from "@/components/ApiKeyForm";
import Sidebar from "@/components/Sidebar";
import type { NavItem } from "@/components/Sidebar";
import Calendar from "@/components/Calendar";
import WorkoutList from "@/components/WorkoutList";
import WorkoutDetail from "@/components/WorkoutDetail";
import Insights from "@/components/Insights";
import ChatBot from "@/components/ChatBot";

const PAGE_TITLES: Record<NavItem, string> = {
  calendar: "Calendar",
  workouts: "Workouts",
  insights: "Insights",
  agent: "Chevy",
};

export default function Home() {
  const { apiKey, saveKey, clearKey } = useApiKey();
  const { workouts, templates, loading, error, refresh } = useHevyData(apiKey);
  const [tab, setTab] = useState<NavItem>("calendar");
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  if (!apiKey) {
    return <ApiKeyForm onSubmit={saveKey} />;
  }

  if (loading && workouts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-[var(--text-muted)] animate-pulse">
          Loading workouts...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-[var(--red)]">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={refresh}
              className="px-3 py-1.5 text-sm bg-[var(--bg-card)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              Retry
            </button>
            <button
              onClick={clearKey}
              className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Change API Key
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Workout detail view
  if (selectedWorkout) {
    return (
      <>
        <Sidebar
          active={tab}
          onNavigate={(item) => {
            setSelectedWorkout(null);
            setTab(item);
          }}
          onSync={refresh}
          onDisconnect={clearKey}
          syncing={loading}
          workoutCount={workouts.length}
        />
        <div className="main-content">
          <div className="page-header">
            <h1>Workout Detail</h1>
          </div>
          <div className="page-body">
            <WorkoutDetail
              workout={selectedWorkout}
              templates={templates}
              onBack={() => setSelectedWorkout(null)}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Sidebar
        active={tab}
        onNavigate={setTab}
        onSync={refresh}
        onDisconnect={clearKey}
        syncing={loading}
        workoutCount={workouts.length}
      />
      <div className="main-content">
        {tab !== "agent" && (
          <div className="page-header">
            <h1>{PAGE_TITLES[tab]}</h1>
          </div>
        )}
        <div className={tab === "agent" ? "page-body page-body-agent" : "page-body"}>
          {tab === "agent" ? (
            <ChatBot workouts={workouts} templates={templates} hevyApiKey={apiKey} />
          ) : (
            <>
              {tab === "calendar" && (
                <Calendar
                  workouts={workouts}
                  templates={templates}
                  onSelectWorkout={setSelectedWorkout}
                />
              )}
              {tab === "workouts" && (
                <WorkoutList
                  workouts={workouts}
                  templates={templates}
                  onSelect={setSelectedWorkout}
                />
              )}
{tab === "insights" && (
                <Insights workouts={workouts} templates={templates} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
