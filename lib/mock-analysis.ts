export type CandidateAnalysis = {
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  interviewQuestion: string;
};

const skills = [
  "react",
  "typescript",
  "javascript",
  "node.js",
  "node",
  "python",
  "sql",
  "aws",
  "azure",
  "docker",
  "git",
  "figma",
  "excel",
  "salesforce",
  "recruiting",
];

export function generateMockAnalysis(
  cv: string,
  jobDescription: string,
): CandidateAnalysis {
  const lowerCv = cv.toLowerCase();
  const lowerJobDescription = jobDescription.toLowerCase();

  const requiredSkills = skills.filter((skill) =>
    lowerJobDescription.includes(skill),
  );

  const candidateSkills = skills.filter((skill) => lowerCv.includes(skill));

  const matchingSkills = requiredSkills.filter((skill) =>
    candidateSkills.includes(skill),
  );

  const missingSkills = requiredSkills.filter(
    (skill) => !candidateSkills.includes(skill),
  );

  const score =
    requiredSkills.length === 0
      ? 50
      : Math.round((matchingSkills.length / requiredSkills.length) * 100);

  const interviewQuestion =
    missingSkills.length > 0
      ? `The job description mentions ${missingSkills[0]}. Tell us about your experience with it, or how you would learn it for this role.`
      : "Tell us about a challenging project relevant to this role and the impact you delivered.";

  return {
    score,
    matchingSkills,
    missingSkills,
    interviewQuestion,
  };
}