import { NextResponse } from "next/server";
import { z } from "zod";

const CandidateAnalysisSchema = z.object({
  requirementCoverage: z.number().min(0).max(100),
  summary: z.string(),
  matchingSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  interviewQuestion: z.string(),
});

const analysisJsonSchema = z.toJSONSchema(CandidateAnalysisSchema);

export async function POST(request: Request) {
  try {
    const { cv, jobDescription } = await request.json();

    if (
      typeof cv !== "string" ||
      typeof jobDescription !== "string" ||
      !cv.trim() ||
      !jobDescription.trim()
    ) {
      return NextResponse.json(
        { error: "A CV and job description are required." },
        { status: 400 },
      );
    }

    if (cv.length > 20000 || jobDescription.length > 20000) {
      return NextResponse.json(
        { error: "Please keep each field below 20,000 characters." },
        { status: 400 },
      );
    }

    const ollamaResponse = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b",
        stream: false,
        format: analysisJsonSchema,
        options: {
          temperature: 0,
        },
        messages: [
          {
            role: "system",
            content: `
You are a recruitment analysis assistant.

Compare only job-relevant skills, qualifications, and experience explicitly
written in the candidate CV and job description.

Do not infer or use age, gender, race, nationality, religion, disability,
marital status, or any other protected characteristic.
Do not make a hiring decision or recommendation.

Return only valid JSON matching this schema:
${JSON.stringify(analysisJsonSchema)}
            `,
          },
          {
            role: "user",
            content: `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE CV:\n${cv}`,
          },
        ],
      }),
    });

    if (!ollamaResponse.ok) {
      const details = await ollamaResponse.text();
      console.error("Ollama error:", details);
      throw new Error("Ollama did not complete the analysis.");
    }

    const result = await ollamaResponse.json();
    const content = result?.message?.content;

    if (typeof content !== "string") {
      throw new Error("Ollama returned an unexpected response.");
    }

    const analysis = CandidateAnalysisSchema.parse(JSON.parse(content));

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);

    return NextResponse.json(
      { error: "Unable to analyse the candidate right now. Please try again." },
      { status: 500 },
    );
  }
}