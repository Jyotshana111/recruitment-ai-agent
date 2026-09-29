"use client";

import { useState } from "react";

type CandidateAnalysis = {
  requirementCoverage: number;
  summary: string;
  matchingSkills: string[];
  missingSkills: string[];
  interviewQuestion: string;
};

export default function Home() {
  const [cv, setCv] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<CandidateAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyseCandidate() {
    if (!cv.trim() || !jobDescription.trim()) {
      setError("Please enter both a candidate CV and a job description.");
      return;
    }

    setIsLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setAnalysis(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Recruitment AI Agent
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            Find the right candidate faster
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Review job-relevant evidence from a candidate CV against a role.
            Final hiring decisions always remain with a human recruiter.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <label>
            <span className="mb-2 block font-semibold">Candidate CV</span>
            <textarea
              value={cv}
              onChange={(event) => setCv(event.target.value)}
              placeholder="Paste the candidate CV here..."
              className="h-80 w-full rounded-xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label>
            <span className="mb-2 block font-semibold">Job Description</span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the job description here..."
              className="h-80 w-full rounded-xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </section>

        <button
          onClick={analyseCandidate}
          disabled={isLoading}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isLoading ? "Analysing..." : "Analyse candidate"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
        )}

        {analysis && (
          <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Job-requirement coverage
                </p>
                <p className="text-5xl font-bold text-blue-600">
                  {analysis.requirementCoverage}%
                </p>
              </div>
              <span className="w-fit rounded-full bg-blue-100 px-4 py-2 font-semibold text-blue-800">
                Human review required
              </span>
            </div>

            <div className="mt-8 rounded-xl bg-slate-50 p-4">
              <h2 className="font-bold">Evidence-based summary</h2>
              <p className="mt-2 text-slate-600">{analysis.summary}</p>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <h2 className="font-bold">Evidenced matches</h2>
                <ul className="mt-3 space-y-2 text-slate-600">
                  {analysis.matchingSkills.map((skill) => (
                    <li key={skill}>✓ {skill}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="font-bold">Not evidenced in CV</h2>
                <ul className="mt-3 space-y-2 text-slate-600">
                  {analysis.missingSkills.map((skill) => (
                    <li key={skill}>• {skill}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="font-bold">Suggested interview question</h2>
                <p className="mt-3 text-slate-600">
                  {analysis.interviewQuestion}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}