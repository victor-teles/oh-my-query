export interface FuzzyMatchResult {
  score: number;
  matches: number[];
}

const SCORE_START = 80;
const SCORE_BOUNDARY = 50;
const SCORE_CONSECUTIVE = 25;
const SCORE_MATCH = 10;
const SCORE_GAP_PENALTY = -2;
const SCORE_CASE_BONUS = 5;

const isWordBoundary = (text: string, idx: number): boolean => {
  if (idx === 0) {
    return true;
  }
  const prev = text[idx - 1] ?? "";
  return prev === "_" || prev === "-" || prev === "." || prev === " ";
};

export const fuzzyMatch = (
  candidate: string,
  query: string
): FuzzyMatchResult | null => {
  if (!query) {
    return { matches: [], score: 0 };
  }

  const lowerCandidate = candidate.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const matches: number[] = [];
  let score = 0;
  let queryIdx = 0;
  let lastMatchIdx = -1;
  let i = 0;

  while (i < lowerCandidate.length && queryIdx < lowerQuery.length) {
    if (lowerCandidate[i] !== lowerQuery[queryIdx]) {
      i += 1;
      continue;
    }

    matches.push(i);

    let charScore = SCORE_MATCH;
    if (i === 0) {
      charScore += SCORE_START;
    } else if (isWordBoundary(lowerCandidate, i)) {
      charScore += SCORE_BOUNDARY;
    }
    if (lastMatchIdx >= 0 && i === lastMatchIdx + 1) {
      charScore += SCORE_CONSECUTIVE;
    } else if (lastMatchIdx >= 0) {
      charScore += SCORE_GAP_PENALTY * (i - lastMatchIdx - 1);
    }
    if (candidate[i] === query[queryIdx]) {
      charScore += SCORE_CASE_BONUS;
    }

    score += charScore;
    lastMatchIdx = i;
    queryIdx += 1;
    i += 1;
  }

  if (queryIdx < lowerQuery.length) {
    return null;
  }

  score -= lowerCandidate.length - lowerQuery.length;

  return { matches, score };
};
