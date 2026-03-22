"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Workout, ExerciseTemplate, Routine } from "@/lib/hevy";
import { muscleGroupFrequency, findPRs } from "@/lib/insights";
import { capitalize } from "@/lib/utils";
import { Plus, X, Sparkles, Search, Trash2, ArrowLeft } from "lucide-react";
import MuscleMap from "./MuscleMap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PROVIDERS, getSavedProvider } from "@/lib/providers";

function toLbs5(kg: number): number { return Math.round((kg * 2.20462) / 5) * 5; }
function fmtLbs(kg: number): string { return `${toLbs5(kg)} lbs`; }

interface BuilderExercise {
  id: string;
  templateId: string;
  title: string;
  primaryMuscle: string;
  sets: { lbs: number; reps: number }[];
}

export default function WorkoutBuilder({
  workouts,
  templates,
  routines = [],
}: {
  workouts: Workout[];
  templates: Map<string, ExerciseTemplate>;
  routines?: Routine[];
}) {
  const [exercises, setExercises] = useState<BuilderExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<string | null>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  const prs = useMemo(() => findPRs(workouts), [workouts]);

  const exerciseFreq = useMemo(() => {
    const freq = new Map<string, number>();
    workouts.forEach((w) => w.exercises.forEach((ex) => freq.set(ex.exercise_template_id, (freq.get(ex.exercise_template_id) ?? 0) + 1)));
    return freq;
  }, [workouts]);

  const activeMuscles = useMemo(() => {
    const s = new Set<string>();
    exercises.forEach((ex) => { if (ex.primaryMuscle) s.add(ex.primaryMuscle); });
    return Array.from(s);
  }, [exercises]);

  const totalLbs = exercises.reduce((s, ex) => s + ex.sets.reduce((ss, set) => ss + set.lbs * set.reps, 0), 0);
  const totalSets = exercises.reduce((s, ex) => s + ex.sets.length, 0);

  // Load a routine — includes ALL exercises from the template, using PR data or routine set data for weights
  const loadRoutine = useCallback((routine: Routine) => {
    setExercises(routine.exercises.map((rex) => {
      const tmpl = templates.get(rex.exercise_template_id);
      const pr = prs.get(rex.title);

      // Use routine's saved sets, falling back to PR data
      const sets = rex.sets.length > 0
        ? rex.sets.filter((s) => s.type !== "warmup").map((s) => ({
            lbs: s.weight_kg ? toLbs5(s.weight_kg) : (pr ? toLbs5(pr.weight) : 0),
            reps: s.reps ?? (pr?.reps ?? 10),
          }))
        : Array(3).fill(null).map(() => ({
            lbs: pr ? toLbs5(pr.weight) : 0,
            reps: pr?.reps ?? 10,
          }));

      return {
        id: crypto.randomUUID?.() ?? Math.random().toString(36),
        templateId: rex.exercise_template_id,
        title: rex.title,
        primaryMuscle: tmpl?.primary_muscle_group ?? "",
        sets: sets.length > 0 ? sets : [{ lbs: 0, reps: 10 }],
      };
    }));
  }, [templates, prs]);

  const addExercise = useCallback((tmpl: ExerciseTemplate) => {
    const pr = prs.get(tmpl.title);
    setExercises((prev) => [...prev, {
      id: crypto.randomUUID?.() ?? Math.random().toString(36),
      templateId: tmpl.id, title: tmpl.title, primaryMuscle: tmpl.primary_muscle_group,
      sets: Array(3).fill(null).map(() => ({ lbs: pr ? toLbs5(pr.weight) : 0, reps: pr?.reps ?? 10 })),
    }]);
    setShowPicker(false);
    setPickerSearch("");
  }, [prs]);

  const updateSet = useCallback((exId: string, si: number, field: "lbs" | "reps", val: number) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.id !== exId) return ex;
      const sets = [...ex.sets]; sets[si] = { ...sets[si], [field]: val }; return { ...ex, sets };
    }));
  }, []);

  const addSet = useCallback((exId: string) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.id !== exId) return ex;
      const last = ex.sets.at(-1) ?? { lbs: 0, reps: 10 };
      return { ...ex, sets: [...ex.sets, { ...last }] };
    }));
  }, []);

  const removeSet = useCallback((exId: string, si: number) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.id !== exId || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, i) => i !== si) };
    }));
  }, []);

  const templateList = useMemo(() => {
    const arr = Array.from(templates.values());
    if (!pickerSearch.trim()) return arr.sort((a, b) => (exerciseFreq.get(b.id) ?? 0) - (exerciseFreq.get(a.id) ?? 0));
    const q = pickerSearch.toLowerCase();
    return arr.filter((t) => t.title.toLowerCase().includes(q) || t.primary_muscle_group.toLowerCase().includes(q));
  }, [templates, pickerSearch, exerciseFreq]);

  // Muscles for a routine
  const routineMuscles = useCallback((r: Routine) => {
    const s = new Set<string>();
    r.exercises.forEach((ex) => {
      const tmpl = templates.get(ex.exercise_template_id);
      if (tmpl) s.add(tmpl.primary_muscle_group);
    });
    return Array.from(s);
  }, [templates]);

  // AI
  const callAI = useCallback(async (mode: string) => {
    const saved = getSavedProvider();
    if (!saved) { setAiText("Connect an AI provider in the Chevy tab first."); return; }
    setAiLoading(true); setAiMode(mode); setAiText("");
    const desc = exercises.map((ex) => `${ex.title}: ${ex.sets.map((s) => `${s.lbs} lbs x ${s.reps}`).join(", ")}`).join("\n");
    const mf = muscleGroupFrequency(workouts, templates, 30).slice(0, 8).map((m) => `${capitalize(m.muscle)}: ${m.count}`).join(", ");
    const prList = Array.from(prs.values()).sort((a, b) => b.weight * b.reps - a.weight * a.reps).slice(0, 15).map((p) => `${p.exerciseTitle}: ${fmtLbs(p.weight)} x ${p.reps}`).join("\n");
    const prompts: Record<string, string> = {
      analyze: `Analyze this workout. Is volume balanced? Missing muscles? Weights appropriate? Be specific in lbs.\n\nWorkout:\n${desc}\n\nMuscle freq (30 sessions): ${mf}`,
      suggest: `Suggest 2-3 exercises to add. Why each one, with sets/reps/weight in lbs.\n\nWorkout:\n${desc}\n\nMuscle freq (30 sessions): ${mf}`,
      replace: `Suggest swaps for exercises that could be improved. Specific alternatives with reasoning. Use lbs.\n\nWorkout:\n${desc}`,
    };
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: saved.provider, apiKey: saved.apiKey, model: PROVIDERS[saved.provider].defaultModel, messages: [{ role: "user", content: prompts[mode] }], system: `You are a workout coach. Be concise. Use lbs. Markdown. Under 250 words.\n\nPRs:\n${prList}` }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop()!; for (const l of lines) { if (!l.startsWith("data: ")) continue; const d = l.slice(6); if (d === "[DONE]") break; try { const p = JSON.parse(d); if (p.text) { full += p.text; setAiText(full); } } catch {} } }
    } catch (e) { setAiText(`Error: ${e instanceof Error ? e.message : "Failed"}`); }
    finally { setAiLoading(false); }
  }, [exercises, workouts, templates, prs]);

  useEffect(() => { aiRef.current?.scrollTo({ top: aiRef.current.scrollHeight, behavior: "smooth" }); }, [aiText]);

  const editing = exercises.length > 0;

  return (
    <>
      {!editing ? (
        /* ═══ ROUTINE PICKER ═══ */
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>Workout Builder</p>
            <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 4 }}>
              {routines.length > 0
                ? "Pick a routine to customize, or start from scratch."
                : "Loading your routines from Hevy..."}
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: routines.length <= 2 ? "1fr" : routines.length <= 4 ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 16,
          }}>
            {routines.map((r) => {
              const muscles = routineMuscles(r);
              const exerciseNames = r.exercises.slice(0, 4).map((e) => e.title);
              const moreCount = r.exercises.length - 4;
              return (
                <button key={r.id} onClick={() => loadRoutine(r)} style={{
                  display: "flex", flexDirection: "column", padding: 0, borderRadius: 20, overflow: "hidden",
                  background: "rgba(22,22,22,0.6)", border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.2s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,156,247,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Top: Title + description */}
                  <div style={{ padding: "22px 24px 16px" }}>
                    <p style={{ fontSize: 18, fontWeight: 500, color: "#fff", marginBottom: 4 }}>{r.title}</p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {r.exercises.length} exercises &middot; {muscles.map(capitalize).join(", ")}
                    </p>
                  </div>

                  {/* Visual content area */}
                  <div style={{
                    padding: "12px 24px 20px", flex: 1,
                    background: "rgba(255,255,255,0.015)",
                    borderTop: "1px solid rgba(255,255,255,0.03)",
                  }}>
                    {/* Muscle map centered */}
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                      <MuscleMap activeMuscles={muscles} size={80} />
                    </div>

                    {/* Exercise list preview */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {exerciseNames.map((name, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, opacity: 0.6 }} />
                          <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        </div>
                      ))}
                      {moreCount > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 13 }}>+{moreCount} more</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Start from scratch tile */}
            <button onClick={() => setShowPicker(true)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              padding: 32, borderRadius: 20, minHeight: 200,
              background: "rgba(79,156,247,0.04)", border: "1px dashed rgba(79,156,247,0.2)",
              cursor: "pointer", transition: "all 0.2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(28,28,28,0.7)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={24} style={{ color: "var(--accent)" }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#fff" }}>Start from scratch</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Build a custom workout<br />from your exercise library.</p>
            </button>
          </div>

          {routines.length === 0 && (
            <div style={{ textAlign: "center", padding: 48 }}>
              <p style={{ fontSize: 15, color: "var(--text-muted)" }}>No saved routines found in your Hevy account.</p>
            </div>
          )}
        </div>
      ) : (
        /* ═══ EXERCISE EDITOR ═══ */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <button onClick={() => setExercises([])} style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
              color: "var(--text-muted)", cursor: "pointer", fontSize: 14, fontWeight: 500, padding: 0, marginBottom: -4,
            }}>
              <ArrowLeft size={16} /> Back to routines
            </button>

            {exercises.map((ex) => {
              const pr = prs.get(ex.title);
              return (
                <div key={ex.id} style={{ background: "rgba(22,22,22,0.55)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 500, color: "#fff" }}>{ex.title}</p>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        {capitalize(ex.primaryMuscle)}
                        {pr && <> &middot; PR {toLbs5(pr.weight)} lbs &times; {pr.reps}</>}
                      </p>
                    </div>
                    <button onClick={() => setExercises((p) => p.filter((e) => e.id !== ex.id))} style={{
                      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10,
                      cursor: "pointer", padding: "8px 10px", color: "#f87171", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500,
                    }}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 36px", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, textAlign: "center" }}>SET</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>LBS</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>REPS</span>
                    <span />
                  </div>

                  {ex.sets.map((s, si) => (
                    <div key={si} style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 36px", gap: 10, marginBottom: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", textAlign: "center" }}>{si + 1}</span>
                      <input type="number" step={5} value={s.lbs || ""} onChange={(e) => updateSet(ex.id, si, "lbs", Number(e.target.value))}
                        onBlur={(e) => updateSet(ex.id, si, "lbs", Math.round(Number(e.target.value) / 5) * 5)}
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 17, fontWeight: 500, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", outline: "none" }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "rgba(79,156,247,0.4)"} onBlurCapture={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                      <input type="number" value={s.reps || ""} onChange={(e) => updateSet(ex.id, si, "reps", Number(e.target.value))}
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 17, fontWeight: 500, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", outline: "none" }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "rgba(79,156,247,0.4)"} onBlurCapture={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                      <button onClick={() => removeSet(ex.id, si)} disabled={ex.sets.length <= 1}
                        style={{ background: "none", border: "none", cursor: ex.sets.length <= 1 ? "default" : "pointer", padding: 6, color: "var(--text-muted)", opacity: ex.sets.length <= 1 ? 0.15 : 0.5 }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  <button onClick={() => addSet(ex.id)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
                    padding: 12, marginTop: 8, borderRadius: 12, fontSize: 14, fontWeight: 500,
                    color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", cursor: "pointer",
                  }}>
                    <Plus size={15} /> Add Set
                  </button>
                </div>
              );
            })}

            <button onClick={() => setShowPicker(true)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
              padding: 18, borderRadius: 16, fontSize: 16, fontWeight: 500,
              color: "var(--accent)", background: "rgba(79,156,247,0.06)", border: "1px dashed rgba(79,156,247,0.25)", cursor: "pointer",
            }}>
              <Plus size={18} /> Add Exercise
            </button>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 20 }}>
            <div style={{ background: "rgba(22,22,22,0.55)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#fff", marginBottom: 16 }}>Summary</p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <MuscleMap activeMuscles={activeMuscles} size={150} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
                <div><p style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{exercises.length}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Exercises</p></div>
                <div><p style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{totalSets}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Sets</p></div>
                <div><p style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{totalLbs >= 2000 ? `${(totalLbs / 1000).toFixed(1)}k` : totalLbs}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Volume (lbs)</p></div>
              </div>
              {activeMuscles.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {activeMuscles.map((m) => (
                    <span key={m} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 8, background: "transparent", color: "var(--accent)", fontWeight: 500, border: "1px solid rgba(79,156,247,0.2)", boxShadow: "0 1px 4px rgba(79,156,247,0.08)" }}>{capitalize(m)}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "rgba(22,22,22,0.55)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Sparkles size={16} style={{ color: "var(--accent)" }} />
                <p style={{ fontSize: 16, fontWeight: 500, color: "#fff" }}>AI Coach</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <AiBtn label="Analyze" desc="Check balance & volume" onClick={() => callAI("analyze")} loading={aiLoading && aiMode === "analyze"} disabled={!exercises.length || aiLoading} />
                <AiBtn label="Suggest Adds" desc="Exercises to fill gaps" onClick={() => callAI("suggest")} loading={aiLoading && aiMode === "suggest"} disabled={aiLoading} />
                <AiBtn label="Suggest Swaps" desc="Better alternatives" onClick={() => callAI("replace")} loading={aiLoading && aiMode === "replace"} disabled={!exercises.length || aiLoading} />
              </div>
            </div>

            {aiText && (
              <div style={{ background: "rgba(22,22,22,0.55)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
                <div ref={aiRef} className="chat-msg-bubble assistant" style={{ maxHeight: 500, overflow: "auto", padding: 0, border: "none", background: "none", borderRadius: 0, backdropFilter: "none", boxShadow: "none", fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PICKER MODAL */}
      {showPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => { setShowPicker(false); setPickerSearch(""); }}>
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "75vh", borderRadius: 18, overflow: "hidden", background: "rgba(20,20,20,0.98)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={18} style={{ color: "var(--text-muted)" }} />
              <input autoFocus placeholder="Search exercises..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16, color: "#fff", padding: "10px 0" }} />
              <button onClick={() => { setShowPicker(false); setPickerSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", margin: "8px 20px 0" }} />
            <div style={{ flex: 1, overflow: "auto", padding: "8px 10px 20px" }}>
              {templateList.slice(0, 60).map((tmpl) => {
                const freq = exerciseFreq.get(tmpl.id) ?? 0;
                const pr = prs.get(tmpl.title);
                return (
                  <button key={tmpl.id} onClick={() => addExercise(tmpl)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left", background: "none", border: "none", transition: "background 0.1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: "#fff" }}>{tmpl.title}</p>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        {capitalize(tmpl.primary_muscle_group)}
                        {freq > 0 && <> &middot; {freq}x</>}
                        {pr && <> &middot; PR: {fmtLbs(pr.weight)} &times; {pr.reps}</>}
                      </p>
                    </div>
                    <Plus size={16} style={{ color: "var(--accent)" }} />
                  </button>
                );
              })}
              {templateList.length === 0 && <p style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No exercises found</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AiBtn({ label, desc, onClick, loading, disabled }: { label: string; desc: string; onClick: () => void; loading: boolean; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px",
      borderRadius: 12, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
      background: loading ? "rgba(79,156,247,0.08)" : "rgba(255,255,255,0.03)",
      border: loading ? "1px solid rgba(79,156,247,0.2)" : "1px solid rgba(255,255,255,0.06)",
      opacity: disabled && !loading ? 0.35 : 1, transition: "all 0.15s",
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>{label}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</p>
      </div>
      {loading && <div className="typing-dot" />}
    </button>
  );
}
// commit-marker-1
// commit-marker-24
