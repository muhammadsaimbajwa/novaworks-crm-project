"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  "Reading meeting",
  "Identifying projects",
  "Assigning managers",
  "Extracting tasks",
  "Assigning developers",
  "Validating deadlines",
  "Saving to CRM",
];

type Result = {
  projectCount: number;
  taskCount: number;
  projects: { id: string; name: string; clientName: string; taskCount: number }[];
};

export default function TranscriptForm() {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const submitting = useRef(false); // synchronous guard against double-clicks

  // Cosmetic progress: advance through the steps while the real request runs,
  // and hold on "Validating deadlines" until the server answers.
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 2)), 2200);
    return () => clearInterval(timer);
  }, [loading]);

  async function submit() {
    if (submitting.current) return;
    if (!transcript.trim()) {
      setError("The transcript is empty. Paste a meeting transcript first.");
      return;
    }

    submitting.current = true;
    setLoading(true);
    setStep(0);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          res.status === 401
            ? "Your session has expired. Please sign in again."
            : (data.error ?? "Something went wrong. Please try again."),
        );
      } else {
        setStep(STEPS.length);
        setResult(data as Result);
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-600">✓</span>
          <h2 className="text-xl font-bold text-navy-900">Successfully created</h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-3xl font-bold text-navy-900">{result.projectCount}</p>
            <p className="text-sm text-slate-500">{result.projectCount === 1 ? "Project" : "Projects"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-3xl font-bold text-navy-900">{result.taskCount}</p>
            <p className="text-sm text-slate-500">{result.taskCount === 1 ? "Task" : "Tasks"}</p>
          </div>
        </div>

        <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {result.projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="font-semibold text-navy-900">{project.name}</span>
                  <span className="ml-2 text-slate-500">{project.clientName}</span>
                </span>
                <span className="text-slate-500">{project.taskCount} tasks</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            View Projects
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setTranscript("");
            }}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-sm" aria-live="polite">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">AI Project Manager</p>
        <h2 className="mt-1 text-xl font-bold text-navy-900">Analyzing meeting...</h2>
        <p className="mt-1 text-slate-500">Turning meeting decisions into work. This can take up to a minute.</p>

        <ul className="mt-6 space-y-3">
          {STEPS.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 text-sm ${
                  done ? "text-emerald-600" : active ? "font-semibold text-indigo-600" : "text-slate-400"
                }`}
              >
                <span className="w-4 text-center">{done ? "✓" : active ? "●" : "○"}</span>
                <span className={active ? "animate-pulse" : ""}>{label}</span>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled
          className="mt-8 cursor-not-allowed rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white opacity-60"
        >
          Analyzing meeting...
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste meeting transcript here..."
        rows={18}
        className="w-full resize-y rounded-xl border border-slate-300 p-4 text-sm leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{transcript.length.toLocaleString()} characters</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setTranscript("");
              setError(null);
            }}
            disabled={!transcript}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✨ Create Projects
          </button>
        </div>
      </div>
    </div>
  );
}
