import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Compile only the modules under test in memory; also works on Node 20.
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { inputSchema, verifyAnalysis, savedReviewSchema, reportText } = require("../lib/analysis.ts");
const { readLimited, checkOrigin, AppError } = require("../lib/server.ts");
const { withModel } = require("../lib/ollama.ts");

const documents = { cv: "Built React applications and wrote automated tests.", jobDescription: "Essential: React applications and automated tests. Docker is desirable." };
const requirement = { requirement: "React", jobQuote: "React applications", status: "evidenced", cvQuote: "Built React applications", explanation: "The supplied CV describes React work." };
const raw = { summary: "React experience is described.", requirements: [requirement], interviewQuestions: [{ question: "How did you test your application?", purpose: "Explore testing depth." }] };

test("input boundaries reject empty and excessive combined text", () => {
  assert.equal(inputSchema.safeParse(documents).success, true);
  assert.equal(inputSchema.safeParse({ ...documents, cv: " " }).success, false);
  assert.equal(inputSchema.safeParse({ cv: "a".repeat(20000), jobDescription: "b".repeat(20000) }).success, false);
});
test("source quote validation tolerates whitespace but rejects fabricated evidence", () => {
  const valid = verifyAnalysis({ ...raw, requirements: [{ ...requirement, cvQuote: "Built\nReact applications" }] }, documents);
  assert.equal(valid.requirements[0].status, "evidenced");
  const invalid = verifyAnalysis({ ...raw, requirements: [{ ...requirement, cvQuote: "Built Docker containers" }] }, documents);
  assert.equal(invalid.requirements[0].status, "not_evidenced");
  assert.equal(invalid.requirements[0].cvQuote, "");
  assert.equal(invalid.warnings.length, 1);
});
test("invented and blank job quotes cannot become requirements", () => {
  for (const jobQuote of ["Kubernetes is required", "   "]) {
    assert.throws(() => verifyAnalysis({ ...raw, requirements: [{ ...requirement, jobQuote }] }, documents));
  }
});
test("duplicate requirements are not double counted", () => {
  assert.equal(verifyAnalysis({ ...raw, requirements: [requirement, requirement] }, documents).requirements.length, 1);
});
test("review storage and export include evidence, questions and reviewer notes", () => {
  const analysis = { ...verifyAnalysis(raw, documents), model: "gemma3:4b", createdAt: new Date().toISOString() };
  const review = { id: "test", title: "Frontend review", savedAt: analysis.createdAt, documents, analysis, notes: "Explore testing." };
  assert.equal(savedReviewSchema.safeParse(review).success, true);
  assert.equal(savedReviewSchema.safeParse({ ...review, analysis: {} }).success, false);
  const report = reportText(review.title, analysis, review.notes);
  assert.match(report, /Built React applications/);
  assert.match(report, /How did you test/);
  assert.match(report, /Explore testing/);
});
test("body size is enforced even without content-length", async () => {
  const request = new Request("http://localhost/api", { method: "POST", body: "123456" });
  await assert.rejects(readLimited(request, 5), (error) => error instanceof AppError && error.status === 413);
});
test("cross-origin requests are rejected", () => {
  assert.throws(() => checkOrigin(new Request("http://localhost/api", { headers: { origin: "https://unrelated.example" } })), /must come from/);
  assert.doesNotThrow(() => checkOrigin(new Request("http://localhost/api", { headers: { origin: "http://localhost" } })));
  assert.doesNotThrow(() => checkOrigin(new Request("http://localhost:3100/api", { headers: { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" } })));
});
test("model operations cannot overlap and failures release the lock", async () => {
  let release;
  const first = withModel(() => new Promise((resolve) => { release = resolve; }));
  await assert.rejects(withModel(async () => "second"), /Another analysis/);
  release("done");
  await first;
  await assert.rejects(withModel(async () => { throw new Error("failed"); }), /failed/);
  assert.equal(await withModel(async () => "next"), "next");
});
