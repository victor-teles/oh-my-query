import type { Spec, SpecIssue } from "@json-render/core";

import { autoFixSpec, validateSpec } from "@json-render/core";

import { knownComponentNames } from "@/lib/json-render";

export type SpecParseResult =
  | { status: "empty" }
  | { status: "invalid-json"; message: string }
  | { status: "invalid-shape"; message: string }
  | { status: "ok"; spec: Spec; issues: SpecIssue[]; appliedFixes: string[] };

const collectUnknownComponents = (spec: Spec): SpecIssue[] => {
  const issues: SpecIssue[] = [];
  for (const [key, element] of Object.entries(spec.elements)) {
    if (!knownComponentNames.has(element.type)) {
      issues.push({
        code: "missing_child",
        elementKey: key,
        message: `Unknown component "${element.type}". Use one of: ${[...knownComponentNames].toSorted().join(", ")}.`,
        severity: "error",
      });
    }
  }
  return issues;
};

const looksLikeSpec = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseAndValidateSpec = (code: string): SpecParseResult => {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { status: "empty" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Invalid JSON",
      status: "invalid-json",
    };
  }

  if (!looksLikeSpec(parsed)) {
    return {
      message: "Spec must be a JSON object with `root` and `elements` fields.",
      status: "invalid-shape",
    };
  }

  if (!("root" in parsed) || !("elements" in parsed)) {
    return {
      message: "Spec is missing required fields: `root` and `elements`.",
      status: "invalid-shape",
    };
  }

  const candidate = parsed as unknown as Spec;
  const { spec: fixedSpec, fixes } = autoFixSpec(candidate);
  const baseIssues = validateSpec(fixedSpec).issues;
  const unknownIssues = collectUnknownComponents(fixedSpec);
  return {
    appliedFixes: fixes,
    issues: [...baseIssues, ...unknownIssues],
    spec: fixedSpec,
    status: "ok",
  };
};

export const hasBlockingIssues = (issues: readonly SpecIssue[]): boolean =>
  issues.some((i) => i.severity === "error");
