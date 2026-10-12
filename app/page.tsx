"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { DocumentInput, type DocumentMeta } from "@/components/document-input";
import { analysisSchema, inputSchema, reportText, savedReviewSchema, statusLabels, type Analysis, type Documents, type SavedReview } from "@/lib/analysis";

const STORAGE_KEY = "recruitment-ai.reviews.v1";
const EMPTY: Documents = { cv: "", jobDescription: "" };
const SAMPLE: Documents = {
  cv: "Alex Morgan — Frontend developer\nThree years building React and TypeScript applications. Integrated REST APIs and wrote automated tests with Jest. Collaborated through Git pull requests. Built responsive, accessible interfaces with semantic HTML and CSS. Deployed personal projects on Vercel.",
  jobDescription: "Frontend developer\nEssential: React, TypeScript, REST API integration, automated testing, Git, and accessible HTML/CSS.\nDesirable: Docker and AWS deployment experience.\nThe role involves building customer-facing interfaces and collaborating with designers.",
};
type Key = keyof Documents;
type Tab = "checklist" | "interview" | "sources";

export default function Home() {
  const [documents, setDocuments] = useState<Documents>(EMPTY);
  const [metas, setMetas] = useState<Record<Key, DocumentMeta | null>>({ cv: null, jobDescription: null });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState<"analyse" | Key | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState({ status: "checking", model: "gemma3:4b" });
  const [reviews, setReviews] = useState<SavedReview[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("checklist");
  const [filter, setFilter] = useState("all");
  const controller = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLElement>(null);

  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error();
      setHealth(await res.json());
    } catch { setHealth({ status: "offline", model: "gemma3:4b" }); }
  }

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      void checkHealth();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = savedReviewSchema.array().max(10).safeParse(JSON.parse(raw));
          if (!parsed.success) throw new Error();
          setReviews(parsed.data);
        }
        setStorageReady(true);
      } catch { setError("Saved reviews could not be read. Existing browser storage has not been overwritten."); }
    });
    return () => { mounted = false; controller.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  function canReplace() {
    return !dirty || window.confirm("Replace this workspace? Unsaved analysis, notes, and input changes will be lost.");
  }
  function invalidate() {
    setAnalysis(null); setReviewId(null); setNotes(""); setNotice(""); setDirty(true);
  }
  function changeDocument(key: Key, text: string) {
    setDocuments((prev) => ({ ...prev, [key]: text }));
    invalidate(); setError("");
  }
  function newReview(sample = false) {
    if (!canReplace()) return;
    setDocuments(sample ? SAMPLE : EMPTY); setMetas({ cv: null, jobDescription: null });
    setAnalysis(null); setTitle(sample ? "Frontend developer · sample review" : "");
    setNotes(""); setReviewId(null); setError(""); setNotice(""); setDirty(sample);
    setTab("checklist"); setFilter("all");
  }
  async function upload(key: Key, file: File, ocr: boolean) {
    if (busy) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a non-empty PDF up to 5 MB."); return;
    }
    if (documents[key] && !window.confirm("Replace the text in this document with the uploaded PDF?")) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(key); setElapsed(0); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("file", file); form.append("ocr", String(ocr));
      const response = await fetch("/api/extract-pdf", { method: "POST", body: form, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(330000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not extract the PDF.");
      if (typeof data.text !== "string") throw new Error("Unexpected PDF response.");
      changeDocument(key, data.text);
      setMetas((prev) => ({ ...prev, [key]: { name: file.name, pages: data.pages, warning: data.warning, method: data.method } }));
      setNotice("Document imported. Review the extracted text before starting the analysis.");
    } catch (err) {
      setError(abort.signal.aborted ? "Upload cancelled. Your previous text is unchanged." : err instanceof Error && err.name === "TimeoutError" ? "Extraction timed out. Try a smaller PDF." : err instanceof Error ? err.message : "Upload failed.");
    } finally { setBusy(null); controller.current = null; }
  }
  async function analyse() {
    if (busy) return;
    if (!inputSchema.safeParse(documents).success) {
      setError("Use 30–20,000 characters per document and at most 30,000 combined."); return;
    }
    const abort = new AbortController(); controller.current = abort;
    setBusy("analyse"); setElapsed(0); setError(""); setNotice(""); setAnalysis(null);
    setReviewId(null); setNotes(""); setDirty(true);
    try {
      const response = await fetch("/api/analyse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documents), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(195000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      const parsed = analysisSchema.safeParse(data);
      if (!parsed.success) throw new Error("Unexpected analysis format. Please retry.");
      setAnalysis(parsed.data); setTab("checklist"); setFilter("all");
      setNotice("Review ready. Check each finding against its quoted source.");
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      void checkHealth();
    } catch (err) {
      setError(abort.signal.aborted ? "Analysis cancelled." : err instanceof Error && err.name === "TimeoutError" ? "Analysis timed out. Try shorter inputs." : err instanceof Error ? err.message : "Analysis failed.");
    } finally { setBusy(null); controller.current = null; }
  }
  function saveReview() {
    if (!analysis || !storageReady) return;
    const item: SavedReview = {
      id: reviewId || crypto.randomUUID(), title: title.trim() || "Untitled candidate review",
      savedAt: new Date().toISOString(), documents, analysis, notes,
    };
    const next = [item, ...reviews.filter((r) => r.id !== item.id)];
    if (next.length > 10) { setError("You have 10 saved reviews. Delete one before saving another."); return; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setReviews(next); setReviewId(item.id); setTitle(item.title); setDirty(false);
      setNotice("Review and notes saved in this browser."); setError("");
    } catch { setError("Browser storage is full or unavailable. Download the report to keep a copy."); }
  }
  function openReview(review: SavedReview) {
    if (!canReplace()) return;
    setDocuments(review.documents); setAnalysis(review.analysis); setTitle(review.title);
    setNotes(review.notes); setReviewId(review.id); setDirty(false); setTab("checklist");
    setFilter("all"); setError(""); setNotice("Saved review opened."); setMetas({ cv: null, jobDescription: null });
  }
  function deleteReview(id: string) {
    if (!window.confirm("Delete this saved review and its documents from this browser?")) return;
    const next = reviews.filter((r) => r.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setReviews(next);
      if (id === reviewId) {
        setDocuments(EMPTY); setAnalysis(null); setTitle(""); setNotes("");
        setReviewId(null); setMetas({ cv: null, jobDescription: null }); setDirty(false);
      }
      setNotice("Saved review deleted.");
    } catch { setError("The saved review could not be deleted."); }
  }
  function downloadReport() {
    if (!analysis) return;
    const url = URL.createObjectURL(new Blob([reportText(title || "Candidate review", analysis, notes)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = "recruitment-review.txt"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const ready = inputSchema.safeParse(documents).success;
  const counts = analysis ? {
    evidenced: analysis.requirements.filter((r) => r.status === "evidenced").length,
    partial: analysis.requirements.filter((r) => r.status === "partial").length,
    not_evidenced: analysis.requirements.filter((r) => r.status === "not_evidenced").length,
  } : null;

  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="sidebar no-print">
      <button onClick={() => newReview()} disabled={!!busy} className="brand" aria-label="Recruitment AI home"><span className="brand-mark"><Icon name="file" size={20} /></span><span>recruitment<span className="brand-ai">ai</span><small>Local review workspace</small></span></button>
      <button className="button primary new-review" onClick={() => newReview()} disabled={!!busy}><Icon name="plus" size={17} /> New review</button>
      <div className="nav-label">YOUR WORKSPACE</div>
      <div className="active-nav"><Icon name="file" size={18} /> Candidate review <span>01</span></div>
      <div className="saved-heading"><span className="nav-label">SAVED REVIEWS</span><span className="count-pill">{reviews.length}</span></div>
      <div className="saved-list">
        {!reviews.length && <div className="saved-empty"><Icon name="clock" size={22} /><p>Your reviews, within reach.</p><small>Save a completed review to revisit it here.</small></div>}
        {reviews.map((review) => <div className={`saved-item ${reviewId === review.id ? "selected" : ""}`} key={review.id}>
          <button disabled={!!busy} onClick={() => openReview(review)}><strong>{review.title}</strong><small>{new Date(review.savedAt).toLocaleDateString()}</small></button>
          <button className="delete-review" disabled={!!busy} aria-label={`Delete ${review.title}`} onClick={() => deleteReview(review.id)}><Icon name="close" size={14} /></button>
        </div>)}
      </div>
      <div className="sidebar-note"><Icon name="save" size={17} /><strong>Your workspace, your data.</strong><p>Save only what you need. Reviews stay in this browser until you delete them.</p></div>
      <div className="sidebar-footer"><span className="workspace-avatar">R</span><span>Personal workspace<small>Local edition</small></span></div>
    </aside>

    <main id="workspace" className="workspace">
      <header className="topbar no-print"><span>Workspace <span className="slash">/</span> <strong>Candidate review</strong></span>
        <button onClick={checkHealth} className={`model-status ${health.status}`} title="Click to check Ollama again"><span className={`tiny-dot ${health.status === "ready" ? "ready" : ""}`} />{health.status === "ready" ? "Ollama connected" : health.status === "checking" ? "Checking Ollama…" : health.status === "missing" ? "Model not installed" : "Ollama offline"}<Icon name="refresh" size={13} /></button>
      </header>
      <div className="workspace-content">
        <section className="hero no-print">
          <div><div className="eyebrow">CANDIDATE INTELLIGENCE <span className="edition-tag">LOCAL-FIRST</span></div><h1>Good hiring starts<br />with <em>clearer evidence.</em></h1><p>Turn a CV and a job description into a grounded review.<br className="desktop-break" /> Less time searching. More room for a meaningful conversation.</p></div>
          <div className="hero-aside"><span className="hero-aside-icon"><Icon name="chat" size={24} /></span><strong>Built to inform.<br />Not to decide.</strong><p>AI-assisted insights.<br />Human-led decisions.</p></div>
        </section>
        <ol className="workflow no-print" aria-label="Review workflow">
          <li className={!analysis && busy !== "analyse" ? "current" : "complete"} aria-current={!analysis && busy !== "analyse" ? "step" : undefined}><span className="workflow-number">01</span><div><strong>Add your documents</strong><small>A CV and the role requirements</small></div><Icon name="arrow" size={16} /></li>
          <li className={analysis ? "complete" : busy === "analyse" ? "current" : ""} aria-current={busy === "analyse" ? "step" : undefined}><span className="workflow-number">02</span><div><strong>Connect the evidence</strong><small>Local AI, source-checked quotes</small></div><Icon name="arrow" size={16} /></li>
          <li className={analysis ? "current" : ""} aria-current={analysis ? "step" : undefined}><span className="workflow-number">03</span><div><strong>Make it a conversation</strong><small>Review findings and prepare questions</small></div></li>
        </ol>
        <div className="review-layout no-print">
        <section className="input-section no-print" aria-label="Review documents">
          <div className="section-heading"><div><h2>The source material</h2><p>Upload PDFs or paste text to get started.</p></div><button className="button quiet" onClick={() => newReview(true)} disabled={!!busy}><Icon name="spark" size={16} /> Try a sample</button></div>
          <div className="document-grid">
            <DocumentInput id="cv" number="01" title="Candidate CV" description="Experience, skills & qualifications" text={documents.cv} meta={metas.cv} disabled={!!busy} uploading={busy === "cv"} onChange={(text) => changeDocument("cv", text)} onUpload={(file, ocr) => void upload("cv", file, ocr)} />
            <DocumentInput id="jobDescription" number="02" title="Job description" description="Responsibilities & requirements" text={documents.jobDescription} meta={metas.jobDescription} disabled={!!busy} uploading={busy === "jobDescription"} onChange={(text) => changeDocument("jobDescription", text)} onUpload={(file, ocr) => void upload("jobDescription", file, ocr)} />
          </div>
          <div className="action-bar"><div className="action-note"><Icon name="check" size={16} /><span>Review the text above. You stay in control.</span></div><button className="button primary analyse-button" onClick={analyse} disabled={!ready || !!busy}>{busy === "analyse" ? "Reviewing documents…" : "Build the review"}<Icon name={busy === "analyse" ? "clock" : "arrow"} size={18} /></button></div>
          {documents.cv.length + documents.jobDescription.length > 30000 && <p className="error-message">Keep the combined text below 30,000 characters.</p>}
        </section>
        <aside className="brief-panel" aria-label="About this review">
          <div className="brief-heading"><Icon name="spark" size={17} /><span>YOUR REVIEW, EXPLAINED</span></div>
          <h2>From documents<br />to useful context.</h2>
          <p className="brief-intro">A structured starting point for your next interview.</p>
          <div className="deliverable"><Icon name="check" size={18} /><div><h3>Evidence checklist</h3><p>Requirements linked to quotes from the source documents.</p></div></div>
          <div className="deliverable"><Icon name="chat" size={18} /><div><h3>Better questions</h3><p>Interview prompts to explore experience and clarify gaps.</p></div></div>
          <div className="deliverable"><Icon name="download" size={18} /><div><h3>A review you can keep</h3><p>Add notes, save locally, or export a report for later.</p></div></div>
          <div className="engine-info"><span className="engine-label">INFERENCE ENGINE</span><strong><span className={`tiny-dot ${health.status === "ready" ? "ready" : ""}`} />{health.model}</strong><span>Powered by Ollama · runs locally</span></div>
          <p className="brief-footnote">No candidate scores or automated hiring decisions. Every finding needs your judgment.</p>
        </aside>
        </div>

        <div className="messages no-print" aria-live="polite">
          {busy && <div className="progress-message"><span className="spinner" /><span>{busy === "analyse" ? "Finding requirements and supporting evidence" : "Reading your PDF"} · {elapsed}s</span><button onClick={() => controller.current?.abort()}>Cancel</button></div>}
          {notice && <p className="notice-message">{notice}</p>}
        </div>
        {error && <p className="error-message no-print" role="alert">{error}</p>}

        {analysis && counts && <section ref={reportRef} className="results" aria-label="Review results">
          <header className="report-heading"><div><span className="step-label">YOUR GENERATED REPORT</span><h2>Results &amp; evidence</h2><p>What the documents show, what needs exploring, and what to ask next.</p></div><span className="review-badge"><Icon name="check" size={17} /> Ready for human review</span></header>
          <div className="report-content">
          <div className="report-toolbar no-print"><label>Review name<input maxLength={120} value={title} placeholder="e.g. Frontend developer · Alex" onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label><div className="toolbar-actions">
            <button className="button secondary" disabled={!storageReady || !!busy} onClick={saveReview}><Icon name="save" size={16} />{reviewId ? "Update saved review" : "Save review"}</button>
            <button className="button quiet" onClick={downloadReport}><Icon name="download" size={16} /> Download .txt</button>
            <button className="button quiet" onClick={() => window.print()}>Print / PDF</button>
          </div></div>
          <p className="storage-caption no-print">Saving stores the source text, analysis, and notes on this browser. Up to 10 reviews. {dirty ? "You have unsaved changes." : "Saved."}</p>
          <div className="print-only"><h1>{title || "Candidate review"}</h1><p>{new Date(analysis.createdAt).toLocaleString()} · {analysis.model}</p></div>
          <div className="summary-card"><div><h3 className="summary-heading">Review summary</h3><p>{analysis.summary}</p></div><div className="metrics" aria-label="Requirement counts, not candidate scores"><div className="metric-evidenced"><strong>{counts.evidenced}</strong><span>Evidenced</span></div><div className="metric-partial"><strong>{counts.partial}</strong><span>Partial evidence</span></div><div className="metric-explore"><strong>{counts.not_evidenced}</strong><span>To explore</span></div></div></div>
          {analysis.warnings.map((warning) => <p key={warning} className="warning-message">{warning}</p>)}
          <p className="review-explainer">Quotes are checked against your supplied text; interpretations still need your review. Missing evidence does not mean missing ability. Counts describe this generated checklist, not a candidate score.</p>
          <div className="tabs no-print" role="tablist" aria-label="Review sections">
            {(["checklist", "interview", "sources"] as const).map((name, index, tabs) => <button role="tab" id={`tab-${name}`} aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} key={name} onClick={() => setTab(name)} onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault(); setTab(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus();
            }}>{name === "checklist" ? "Requirement checklist" : name === "interview" ? "Interview preparation" : "Source documents"}<span>{name === "checklist" ? analysis.requirements.length : name === "interview" ? analysis.interviewQuestions.length : 2}</span></button>)}
          </div>
          <div role="tabpanel" id="panel-checklist" aria-labelledby="tab-checklist" className={`report-panel ${tab !== "checklist" ? "inactive-panel" : ""}`}>
            <div className="filter-row no-print"><span>Trace every finding back to its source.</span><label>Show <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All requirements</option><option value="evidenced">Evidenced</option><option value="partial">Partly evidenced</option><option value="not_evidenced">Not evidenced</option></select></label></div>
            {analysis.requirements.map((r, index) => <article key={index} data-status={r.status} className={`requirement ${filter !== "all" && filter !== r.status ? "filtered-out" : ""}`}>
              <div className="requirement-title"><span className="requirement-index">{String(index + 1).padStart(2, "0")}</span><h3>{r.requirement}</h3><span className={`status-badge ${r.status}`}>{statusLabels[r.status]}</span></div>
              <p className="requirement-explanation">{r.explanation}</p>
              <div className="quote-grid"><div><span className="quote-label">FROM THE JOB DESCRIPTION</span><blockquote>{r.jobQuote}</blockquote></div><div><span className="quote-label">{r.cvQuote ? "FROM THE CV · QUOTE FOUND" : "FROM THE CV"}</span>{r.cvQuote ? <blockquote>{r.cvQuote}</blockquote> : <p className="no-evidence">No supporting quote identified. Explore this in conversation.</p>}</div></div>
            </article>)}
            {filter !== "all" && !analysis.requirements.some((r) => r.status === filter) && <p className="no-print empty-filter">No requirements in this category.</p>}
          </div>
          <div role="tabpanel" id="panel-interview" aria-labelledby="tab-interview" className={`report-panel ${tab !== "interview" ? "inactive-panel" : ""}`}>
            <h3 className="print-only">Interview preparation</h3>
            {analysis.interviewQuestions.map((q, index) => <article className="question-card" key={index}><span className="document-number">{index + 1}</span><div><h3>{q.question}</h3><p>{q.purpose}</p></div></article>)}
          </div>
          <div role="tabpanel" id="panel-sources" aria-labelledby="tab-sources" className={`report-panel source-panel no-print ${tab !== "sources" ? "inactive-panel" : ""}`}><div className="document-grid"><div><h3>Candidate CV</h3><pre>{documents.cv}</pre></div><div><h3>Job description</h3><pre>{documents.jobDescription}</pre></div></div></div>
          <div className="review-notes"><label htmlFor="notes">Your perspective matters.<span>Add interview observations, corrections, or follow-up notes.</span></label><textarea id="notes" className="no-print" value={notes} maxLength={10000} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} placeholder="What would you like to explore with this candidate?" /><p className="print-only print-notes">{notes || "No reviewer notes added."}</p><div className="notes-footer no-print"><span>{notes.length.toLocaleString()} / 10,000 · Notes save when you click Save review.</span><button className="button quiet" disabled={!storageReady} onClick={saveReview}>Save notes <Icon name="arrow" size={14} /></button></div></div>
          <p className="report-footer">Generated {new Date(analysis.createdAt).toLocaleString()} with {analysis.model}. AI-assisted review; verify findings against the original documents.</p>
          </div>
        </section>}
        <footer className="page-footer no-print"><span><Icon name="file" size={14} /> recruitment ai <span className="footer-divider">/</span> Evidence before decisions.</span><span>Local inference. Human perspective.</span></footer>
      </div>
    </main>
  </div>;
}
