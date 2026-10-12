import { z } from "zod";

export const MAX_TEXT = 20000;
export const MAX_COMBINED_TEXT = 30000;
export const inputSchema = z.object({
  cv: z.string().trim().min(30).max(MAX_TEXT),
  jobDescription: z.string().trim().min(30).max(MAX_TEXT),
}).refine((data) => data.cv.length + data.jobDescription.length <= MAX_COMBINED_TEXT);

export const requirementSchema = z.object({
  requirement: z.string().min(1).max(300),
  jobQuote: z.string().min(1).max(700),
  status: z.enum(["evidenced", "partial", "not_evidenced"]),
  cvQuote: z.string().max(700),
  explanation: z.string().min(1).max(1000),
});
export const modelAnalysisSchema = z.object({
  summary: z.string().min(1).max(2500),
  requirements: z.array(requirementSchema).min(1).max(16),
  interviewQuestions: z.array(z.object({
    question: z.string().min(1).max(600),
    purpose: z.string().min(1).max(600),
  })).min(1).max(5),
});
export const analysisSchema = modelAnalysisSchema.extend({
  warnings: z.array(z.string()), model: z.string(), createdAt: z.string().datetime(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type Documents = z.infer<typeof inputSchema>;
export const statusLabels = { evidenced: "Evidenced", partial: "Partly evidenced", not_evidenced: "Not evidenced" } as const;

function normalize(text: string) { return text.normalize("NFKC").replace(/\s+/g, " ").trim(); }

// Checks provenance, not whether a model's interpretation of a quote is correct.
export function verifyAnalysis(raw: z.infer<typeof modelAnalysisSchema>, documents: Documents) {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const requirements = raw.requirements.flatMap((item) => {
    const jobQuote = normalize(item.jobQuote);
    if (!jobQuote || !normalize(documents.jobDescription).includes(jobQuote)) {
      warnings.push("A requirement without a matching job-description quote was removed. Review the checklist for completeness.");
      return [];
    }
    const key = normalize(item.requirement).toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    const cvQuote = normalize(item.cvQuote);
    if (item.status === "not_evidenced") return [{ ...item, cvQuote: "" }];
    if (!cvQuote || !normalize(documents.cv).includes(cvQuote)) {
      warnings.push("An unsupported CV quotation was removed and its requirement marked not evidenced. Check the original CV.");
      return [{ ...item, status: "not_evidenced" as const, cvQuote: "", explanation: "The model's supporting quote could not be located in the supplied CV. Verify this requirement manually." }];
    }
    return [item];
  });
  if (!requirements.length) throw new Error("No source-backed requirements returned.");
  return { ...raw, requirements, warnings: [...new Set(warnings)] };
}

export const savedReviewSchema = z.object({
  id: z.string(), title: z.string().min(1).max(120), savedAt: z.string().datetime(),
  documents: inputSchema, analysis: analysisSchema, notes: z.string().max(10000),
});
export type SavedReview = z.infer<typeof savedReviewSchema>;

export function reportText(title: string, analysis: Analysis, notes: string) {
  return [title, `Generated: ${analysis.createdAt}`, `Model: ${analysis.model}`,
    "AI-assisted document review. Verify interpretations; no hiring recommendation.",
    "\nSUMMARY", analysis.summary, ...analysis.warnings.map((w) => `Notice: ${w}`),
    "\nREQUIREMENT CHECKLIST",
    ...analysis.requirements.map((r, i) => `${i + 1}. ${r.requirement} — ${statusLabels[r.status]}\nJob description: ${r.jobQuote}\nCV: ${r.cvQuote || "No supporting quote identified"}\nReview: ${r.explanation}`),
    "\nINTERVIEW PREPARATION",
    ...analysis.interviewQuestions.map((q, i) => `${i + 1}. ${q.question}\nPurpose: ${q.purpose}`),
    "\nREVIEWER NOTES", notes || "No notes added.",
  ].join("\n\n");
}
