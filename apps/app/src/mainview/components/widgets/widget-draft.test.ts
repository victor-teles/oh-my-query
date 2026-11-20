import { describe, expect, it } from "vitest";

import { makeWidget } from "@/test/widget-fixtures";

import {
  defaultWidgetName,
  draftFromAsk,
  draftFromWidget,
  duplicateDraft,
} from "./widget-draft";

const widget = makeWidget();
const answered = {
  connectionId: "analytics",
  dialect: "postgresql" as const,
  prompt: "revenue for europe",
  spec: widget.spec,
  sql: "select 1",
  view: "line" as const,
};

describe("widget drafts", () => {
  it("saves an answer as a widget without inputs", () => {
    expect(draftFromAsk(answered, "  Revenue  ")).toStrictEqual({
      connectionId: "analytics",
      database: null,
      dialect: "postgresql",
      lastValues: {},
      name: "Revenue",
      params: [],
      prompt: "revenue for europe",
      spec: widget.spec,
      sqlTemplate: "select 1",
      view: "line",
    });
  });

  it("uses a proposed template and inputs", () => {
    const draft = draftFromAsk(answered, "Revenue", {
      params: widget.params,
      template: widget.sqlTemplate,
    });
    expect(draft.sqlTemplate).toBe(widget.sqlTemplate);
    expect(draft.params).toHaveLength(2);
  });

  it("defaults the name to the card title", () => {
    expect(defaultWidgetName(widget.spec)).toBe(
      "Monthly recurring revenue in Europe"
    );
  });

  it("keeps the id when editing and drops it when duplicating", () => {
    expect(draftFromWidget(widget).id).toBe("w-revenue");
    const copy = duplicateDraft(widget);
    expect(copy.id).toBeUndefined();
    expect(copy.name).toBe("Revenue by region copy");
  });
});
