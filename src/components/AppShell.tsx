"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ClipLoader } from "react-spinners";
import { useApiKey, useHevyData } from "@/lib/store";
import type { Workout } from "@/lib/hevy";
import { AppDataProvider } from "@/lib/app-context";
import ApiKeyForm from "@/components/ApiKeyForm";
import Sidebar from "@/components/Sidebar";
import WorkoutDetail from "@/components/WorkoutDetail";

const PATH_TO_NAV: Record<string, string> = {
  "/": "workouts",
  "/workouts": "workouts",
  "/insights": "insights",
  "/builder": "builder",
  "/agent": "agent",
};

const PAGE_TITLES: Record<string, string> = {
  workouts: "Workouts",
  insights: "Insights",
  builder: "Workout Builder",
  agent: "Chevy",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { apiKey, saveKey, clearKey } = useApiKey();
  const { workouts, templates, routines, loading, error, refresh } = useHevyData(apiKey);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const activeNav = PATH_TO_NAV[pathname] ?? "calendar";

  const navigate = useCallback((item: string) => {
    setSelectedWorkout(null);
    if (item === "workouts") router.push("/");
    else router.push(`/${item}`);
  }, [router]);

  if (!apiKey) return <ApiKeyForm onSubmit={saveKey} />;

  if (loading && workouts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <ClipLoader color="#4f9cf7" size={28} speedMultiplier={0.8} />
          <span className="text-sm text-[var(--text-muted)]">Loading workouts...</span>
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
            <button onClick={refresh} className="px-3 py-1.5 text-sm bg-[var(--bg-card)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">Retry</button>
            <button onClick={clearKey} className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Change API Key</button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedWorkout) {
    return (
      <AppDataProvider workouts={workouts} templates={templates} routines={routines} onSelectWorkout={setSelectedWorkout}>
        <Sidebar active={activeNav} onNavigate={navigate} onSync={refresh} onDisconnect={clearKey} syncing={loading} workoutCount={workouts.length} />
        <div className="main-content">
          <div className="page-header"><h1>Workout Detail</h1></div>
          <div className="page-body">
            <WorkoutDetail workout={selectedWorkout} templates={templates} onBack={() => setSelectedWorkout(null)} />
          </div>
        </div>
      </AppDataProvider>
    );
  }

  const isAgent = activeNav === "agent";

  return (
    <AppDataProvider workouts={workouts} templates={templates} routines={routines} onSelectWorkout={setSelectedWorkout}>
      <Sidebar active={activeNav} onNavigate={navigate} onSync={refresh} onDisconnect={clearKey} syncing={loading} workoutCount={workouts.length} />
      <div className="main-content">
        {!isAgent && (
          <div className="page-header">
            <h1>{PAGE_TITLES[activeNav] ?? ""}</h1>
          </div>
        )}
        <div className={isAgent ? "page-body page-body-agent" : "page-body"}>
          {children}
        </div>
      </div>
    </AppDataProvider>
  );
}
// commit-marker-10
// commit-marker-15
// commit-marker-51
