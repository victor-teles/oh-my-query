import { describe, expect, it } from "vitest";

import type { SpecParseResult } from "@/lib/json-render-validate";

import { parseAndValidateSpec } from "@/lib/json-render-validate";

type OkResult = Extract<SpecParseResult, { status: "ok" }>;
type InvalidShapeResult = Extract<SpecParseResult, { status: "invalid-shape" }>;

const expectOk = (result: SpecParseResult): OkResult => {
  expect(result.status).toBe("ok");
  return result as OkResult;
};

const expectInvalidShape = (result: SpecParseResult): InvalidShapeResult => {
  expect(result.status).toBe("invalid-shape");
  return result as InvalidShapeResult;
};

describe("json-render spec validation", () => {
  it("returns empty for blank input", () => {
    expect(parseAndValidateSpec("")).toStrictEqual({ status: "empty" });
    expect(parseAndValidateSpec("   \n  ")).toStrictEqual({ status: "empty" });
  });

  it("returns invalid-json for partial JSON (still streaming)", () => {
    const result = parseAndValidateSpec('{"root": "main", "elem');
    expect(result.status).toBe("invalid-json");
  });

  it("returns invalid-shape when required fields are missing", () => {
    const result = expectInvalidShape(
      parseAndValidateSpec(JSON.stringify({ root: "main" }))
    );
    expect(result.message).toMatch(/root.*elements/);
  });

  it("returns invalid-shape for non-object JSON", () => {
    expect(parseAndValidateSpec("[1,2,3]").status).toBe("invalid-shape");
    expect(parseAndValidateSpec('"hello"').status).toBe("invalid-shape");
    expect(parseAndValidateSpec("42").status).toBe("invalid-shape");
  });

  it("flags references to missing children as structural errors", () => {
    const spec = JSON.stringify({
      elements: {
        main: { children: ["ghost"], props: {}, type: "Card" },
      },
      root: "main",
    });
    const result = expectOk(parseAndValidateSpec(spec));
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("flags components that are not in the production catalog", () => {
    const spec = JSON.stringify({
      elements: {
        main: { props: {}, type: "MysteryComponent" },
      },
      root: "main",
    });
    const result = expectOk(parseAndValidateSpec(spec));
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toMatch(/Unknown component "MysteryComponent"/);
  });

  it("auto-fixes `visible` placed inside props", () => {
    const spec = JSON.stringify({
      elements: {
        main: { props: { visible: true }, type: "Card" },
      },
      root: "main",
    });
    const result = expectOk(parseAndValidateSpec(spec));
    expect(result.appliedFixes.length).toBeGreaterThan(0);
    expect(result.spec.elements.main?.visible).toBeTruthy();
    const props = result.spec.elements.main?.props as { visible?: unknown };
    expect(props.visible).toBeUndefined();
  });

  it("returns ok with no issues for a valid spec", () => {
    const spec = JSON.stringify({
      elements: {
        body: { props: { text: "World" }, type: "Text" },
        main: {
          children: ["body"],
          props: { title: "Hello" },
          type: "Card",
        },
      },
      root: "main",
    });
    const result = expectOk(parseAndValidateSpec(spec));
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toStrictEqual([]);
  });
});
