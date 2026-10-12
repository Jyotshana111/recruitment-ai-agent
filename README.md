# Recruitment AI

A local document-review workspace built with Next.js, React, TypeScript, and Ollama's `gemma3:4b`. Compare a CV with a job description, inspect quoted evidence, prepare interviews, and save your own notes.

## Why this project

Recruitment reviews involve switching between a candidate's experience and a role's requirements. This project brings those documents together in a review that a person can inspect and question, rather than reducing a candidate to a match percentage.

It demonstrates an end-to-end, recruitment-focused AI workflow: PDF ingestion, local inference, structured output validation, source-quote verification, and a responsive review interface. It is an assistive prototype, not an autonomous hiring system or a trained recruitment model.

## Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript | Browser workspace and server-side API routes |
| Interface | Custom CSS, Tailwind CSS 4 tooling, inline SVG icons | Responsive layouts, typography, interaction states, and print styling |
| Local model runtime | Ollama | Runs inference on the machine hosting the app by default |
| Model | Gemma 3, `gemma3:4b` | Document comparison and optional image-to-text transcription |
| PDF processing | `pdf-parse` | Extracts selectable text and renders scanned pages for the vision model |
| Validation | Zod | Validates inputs, model responses, and saved-review data |
| Storage | Browser localStorage | Explicitly saved reviews and notes; no database required |
| Tests | Node.js test runner | Automated validation, provenance, export, and request-safety checks |

## Run locally

Requirements: Node.js 20.19+ (or a supported newer LTS), npm, and Ollama.

```bash
git clone https://github.com/Jyotshana111/recruitment-ai-agent.git
cd recruitment-ai-agent
npm ci
ollama pull gemma3:4b
npm run dev
```

Install Ollama before running the commands above. Keep the Ollama desktop app running, or run `ollama serve` in another terminal if it is not already serving. Open [localhost:3000](http://localhost:3000). If your environment cannot run Turbopack, use `npm run dev -- --webpack`.

No OpenAI key is required. The app uses system fonts, so builds do not need Google Fonts downloads.

For a local production build:

```bash
npm run build -- --webpack
npm run start -- --hostname 127.0.0.1
```

Model speed depends on your machine and document length. Scanned PDFs require substantially more processing than PDFs with selectable text.

## Features

- Responsive workspace with sample data, model connectivity check, loading states, and cancellation.
- Paste text or upload PDFs for both documents. Extracted text stays editable.
- Select **Scanned PDF** before uploading to transcribe page images using the local vision model.
- Requirement checklist: evidenced, partly evidenced, or not evidenced.
- Exact source quotations (allowing whitespace/Unicode normalization). Unverifiable CV quotes are removed and their findings downgraded; requirements with unverifiable job quotes are excluded.
- Interview questions with the purpose of each question.
- Up to 10 explicitly saved reviews in browser localStorage, including source text, analysis, and reviewer notes.
- Open, update, and delete saved reviews. Saving is explicit, not automatic.
- Download a plain-text report, or use **Print / PDF** and choose Save as PDF in the browser print dialog. The print report includes all checklist categories, interview questions, and notes, regardless of the active tab/filter.
- Three-step workflow indicator and a visually distinct results report with summary counts, evidence status labels, and separate source-quote panels.
- Site-wide readable typography, compact document cards, responsive phone/tablet layouts, visible keyboard focus, and keyboard navigation for results tabs (arrow keys, Home, and End).

## Try your first review

1. Check that the status reads **Ollama connected**. Click the status control to check again if needed.
2. Click **Try a sample** to use fictional frontend-developer documents, or paste your own CV and job description.
3. For PDFs, use the upload controls or drag files onto the document cards. Enable **Scanned PDF** before uploading an image-based document.
4. Review and correct the extracted text, then click **Build the review**.
5. Read the summary and filter the requirement checklist. Compare each finding with its job-description and CV quotes.
6. Switch to **Interview preparation** for follow-up questions or **Source documents** to reread the submitted text.
7. Name the review, add your notes, and click **Save review**. Download or print a copy if needed.

Saving is not automatic. Save before refreshing or closing the page. Use fictional or appropriately authorized documents when demonstrating the project.

## Data flow

1. **Input:** the browser accepts CV and job-description text, or sends uploaded PDFs to `/api/extract-pdf` for extraction.
2. **Request validation:** `/api/analyse` checks the document lengths and request size before inference.
3. **Model processing:** the server sends both documents, task instructions, and a JSON output schema to Ollama's `/api/chat`. The existing Gemma model identifies job requirements, relates them to CV evidence, and drafts a summary and interview questions. There is no custom training, vector database, or external web search in this workflow.
4. **Structured response:** Zod checks the returned JSON against the expected fields and limits. Malformed or incomplete responses produce an error rather than an unvalidated report.
5. **Quote checks:** the server checks whether each quoted passage occurs in its source text after Unicode/whitespace normalization. Unsupported job requirements are removed; unsupported CV quotes are removed and the relevant finding becomes **Not evidenced**. Duplicate requirement labels are removed.
6. **Output:** the browser displays the verified report structure, warnings, source quotes, evidence categories, and interview questions. A human reviews the interpretations and adds notes.

Quote checks confirm text provenance, not whether a quote actually proves a requirement. This distinction is important: a valid quotation can still be interpreted incorrectly by the model.

PDFs are parsed in server memory and are not saved by the app. Standard extraction does not send the PDF to Ollama. Scanned mode renders one page at a time and sends its image to the local model. Extracted text is reviewed before being submitted for analysis.

Documents are treated as data, not instructions. Zod validates input/output. The app limits request sizes and concurrent model operations per server process and returns actionable errors without logging CV content.

## Limits and interpretation

- PDF upload: 5 MB; standard extraction: 20 pages; scanned mode: 5 pages.
- Each text field: 30–20,000 characters; combined maximum: 30,000.
- Analysis: up to 16 model-identified requirements and 5 interview questions. A long job description may contain more requirements than the checklist covers.
- Inference has a 3-minute timeout per model call; scanned extraction has a 5-minute overall model-work budget.
- AI transcription can misread or invent text. Always check it against the original PDF. Quote checks apply to the supplied text, including any transcription errors.
- Quote verification establishes that text exists, not that a model's interpretation is correct. Summaries and questions also need human review.
- No candidate rankings, hiring recommendations, or model-generated match percentages. Checklist counts are not a validated measure of suitability.
- Prompts exclude protected characteristics; this does not prove fairness or eliminate bias.
- localStorage is not encrypted and is specific to a browser and origin. Use Save review deliberately and Delete to remove stored records. Downloads remain wherever you save them.
- This is a local, single-user prototype without authentication or a production database. Do not expose it as a public recruitment service without additional access controls, retention policies, and evaluation.
- Browser refresh/navigation can lose unsaved work. Save or download first.

## Configuration

Optional server environment variables in `.env.local`:

```env
OLLAMA_MODEL=gemma3:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

The default keeps inference local. Changing the URL sends documents/images to that host. Scanned mode needs a vision-capable model; analysis needs structured JSON support.

A Vercel deployment cannot reach Ollama on your laptop via localhost. Deploy the app with an accessible model service if you later host it.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Ollama offline | Start Ollama and click the connection-status control to retry. The default service address is `http://127.0.0.1:11434`. |
| Model not installed | Run `ollama pull gemma3:4b`, or pull the model configured in `OLLAMA_MODEL`. |
| PDF has little or no text | Enable **Scanned PDF** and upload again, or paste the relevant text manually. |
| Model response is incomplete or times out | Try shorter documents and check available memory. Only one model operation runs at a time per server process. |
| Saved reviews seem missing | Use the same browser and origin. `localhost:3000` and `127.0.0.1:3100` have separate browser storage. Unsaved reviews do not survive a refresh. |

## Checks

```bash
npm run lint
npm test
npm run build -- --webpack
```

Unit tests cover quote provenance, input limits, duplicate requirements, report/storage format, body limits, cross-origin requests, and the model-operation lock.

Manual workflow checks:
1. Try sample data and run an analysis with Ollama.
2. Import a text PDF and a scanned PDF; inspect the extracted text.
3. Save a named review with notes, reload, reopen, and delete it.
4. Filter the checklist, switch tabs, download text, and print to PDF.
5. Try malformed, oversized, empty, and locked PDFs.
6. Stop Ollama and verify the offline/error states.

## Security dependency status

Next.js and its ESLint configuration are pinned to 16.3.8. The audit on **2026-10-12** reported five high-severity development-dependency findings associated with `braces` in the Next.js ESLint dependency tree; the production-only audit reported zero vulnerabilities. These audit results are a point-in-time check, not a security guarantee. Avoid blindly running `npm audit fix --force`, which proposed a breaking downgrade of the ESLint configuration. Re-run `npm audit` and `npm audit --omit=dev` for current results.

The native resolver loads from its platform package without its fallback installation script; `allowScripts` records an explicit denial for that unnecessary script on npm versions supporting script policies.

## Project structure

- `app/page.tsx`: workspace, saved reviews, reports, and notes
- `components/document-input.tsx`: document text and PDF input
- `app/api/analyse/route.ts`: structured review generation
- `app/api/extract-pdf/route.ts`: text extraction and optional vision transcription
- `app/api/health/route.ts`: model connectivity
- `lib/analysis.ts`: schemas, quote checks, report generation
- `lib/ollama.ts`: inference timeout and concurrency handling
- `lib/server.ts`: request limits and errors
- `tests/core.test.mjs`: automated checks
