"use client";
import { useRef, useState } from "react";
import { Icon } from "./icon";
import { MAX_TEXT } from "@/lib/analysis";

export type DocumentMeta = { name: string; pages: number; warning: string; method: string };
type Props = {
  id: string; number: string; title: string; description: string; text: string;
  meta: DocumentMeta | null; disabled: boolean; uploading: boolean;
  onChange: (text: string) => void; onUpload: (file: File, ocr: boolean) => void;
};
export function DocumentInput(props: Props) {
  const [ocr, setOcr] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  return <section className="document-card">
    <div className="card-heading"><span className="document-number">{props.number}</span><div><h2>{props.title}</h2><p>{props.description}</p></div><Icon name="file" /></div>
    <div className={`dropzone ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!props.disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!props.disabled && e.dataTransfer.files[0]) props.onUpload(e.dataTransfer.files[0], ocr); }}>
      <button type="button" className="upload-button" disabled={props.disabled} onClick={() => fileInput.current?.click()}>
        <span className="upload-icon"><Icon name={props.uploading ? "clock" : "upload"} /></span>
        <strong>{props.uploading ? "Reading your document…" : `Upload ${props.title} PDF`}</strong>
        <span>{props.uploading ? "Keep this tab open" : "Choose a file or drop it here"}</span>
      </button>
      <input ref={fileInput} aria-label={`Upload ${props.title}`} type="file" accept=".pdf,application/pdf" className="visually-hidden" disabled={props.disabled}
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) props.onUpload(file, ocr); }} />
      <div className="upload-options"><span>PDF · 5 MB max</span><label><input type="checkbox" checked={ocr} disabled={props.disabled} onChange={(e) => setOcr(e.target.checked)} /> Scanned PDF</label></div>
      {ocr && <p className="ocr-hint">Local AI transcription · up to 5 pages · may take several minutes</p>}
    </div>
    {props.meta && <div className="import-info"><strong><Icon name="check" size={14} /> {props.meta.name} · {props.meta.pages} page{props.meta.pages === 1 ? "" : "s"}</strong><span>{props.meta.warning}</span></div>}
    <div className="text-label"><label htmlFor={props.id}>{props.meta ? "Review & edit extracted text" : "Or paste the text"}</label><span>{props.text.length.toLocaleString()} / 20,000</span></div>
    <textarea id={props.id} value={props.text} maxLength={MAX_TEXT} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)} placeholder={props.id === "cv" ? "Add the candidate’s experience, skills, and qualifications…" : "Add the role, responsibilities, and essential requirements…"} />
    <div className="card-foot"><span className={`tiny-dot ${props.text.trim().length >= 30 ? "ready" : ""}`} />{props.text.trim().length >= 30 ? "Text ready for review" : "At least 30 characters to get started"}</div>
  </section>;
}
