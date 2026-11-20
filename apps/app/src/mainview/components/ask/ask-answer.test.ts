import { describe, expect, it } from "vitest";

import {
  askStateAfter,
  engineAskStateAfter,
  REFUSED,
  REVENUE,
} from "@/test/ask-fixtures";

import { answeredOf, saveUnavailableOf } from "./ask-answer";

describe("saving an answer", () => {
  it("saves a SQL answer as a widget", () => {
    const state = askStateAfter(REVENUE);
    expect(answeredOf(state, "analytics")).toMatchObject({
      connectionId: "analytics",
      dialect: "postgresql",
    });
    expect(saveUnavailableOf(state)).toBeFalsy();
  });

  it.each(["mongodb", "redis"] as const)(
    "explains instead of saving a %s answer",
    (language) => {
      const state = engineAskStateAfter("orders by status", language);
      expect(answeredOf(state, language)).toBeNull();
      expect(saveUnavailableOf(state)).toBeTruthy();
    }
  );

  it("has nothing to save or explain without an answer", () => {
    expect(saveUnavailableOf(askStateAfter(REFUSED))).toBeFalsy();
    expect(
      saveUnavailableOf(engineAskStateAfter("set the flag", "redis"))
    ).toBeFalsy();
  });
});
