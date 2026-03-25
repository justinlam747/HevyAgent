"use client";

import { useMemo } from "react";
import type { Workout, ExerciseTemplate } from "@/lib/hevy";
import { getPrimaryMuscles } from "@/lib/insights";
import { capitalize } from "@/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SplitTracker({
  workouts,
  templates,
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
}) {
  // Last 8 weeks of training mapped by day
  const weekData = useMemo(() => {
    const weeks: {
      weekLabel: string;
      days: { date: string; muscles: string[]; title: string }[];
    }[] = [];

    const now = new Date();
    for (let w = 0; w < 8; w++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - w * 7);
      weekStart.setHours(0, 0, 0, 0);

      const days: { date: string; muscles: string[]; title: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const dateKey = day.toLocaleDateString("en-CA");
        const dayWorkouts = workouts.filter(
          (wo) => new Date(wo.start_time).toLocaleDateString("en-CA") === dateKey
        );
        const muscles = dayWorkouts.flatMap((wo) => getPrimaryMuscles(wo, templates));
        days.push({
          date: dateKey,
          muscles: [...new Set(muscles)],
          title: dayWorkouts.map((wo) => wo.title).join(", "),
        });
      }

      weeks.push({
        weekLabel: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        days,
      });
    }

    return weeks.reverse();
  }, [workouts, templates]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">Last 8 weeks — muscle groups trained each day</p>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-[var(--text-muted)] font-normal pr-3 pb-2">Week</th>
              {DAY_NAMES.map((d) => (
                <th key={d} className="text-center text-[var(--text-muted)] font-normal pb-2 px-1">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekData.map((week) => (
              <tr key={week.weekLabel}>
                <td className="text-[var(--text-muted)] pr-3 py-1 whitespace-nowrap">
                  {week.weekLabel}
                </td>
                {week.days.map((day) => (
                  <td key={day.date} className="text-center py-1 px-1">
                    {day.muscles.length > 0 ? (
                      <div
                        className="inline-block px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] text-[10px] leading-tight cursor-default"
                        title={`${day.title}\n${day.muscles.map(capitalize).join(", ")}`}
                      >
                        {day.muscles
                          .slice(0, 2)
                          .map((m) => m.slice(0, 3).toUpperCase())
                          .join("/")}
                      </div>
                    ) : (
                      <span className="text-[var(--border)]">&middot;</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
