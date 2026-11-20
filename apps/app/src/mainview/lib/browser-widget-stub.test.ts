import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProposeParamsResult } from "@/lib/ipc";

import { REGION_REVENUE } from "./browser-ask-stub";
import { createWidgetEmulator } from "./browser-widget-stub";

const NOW = new Date(2026, 10, 18, 9, 0);

const setup = () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  return createWidgetEmulator(() => NOW);
};

const settle = async <T>(promise: Promise<T>): Promise<T> => {
  await vi.runAllTimersAsync();
  return promise;
};

const askParams = {
  askId: "a1",
  connectionId: "analytics",
  database: null,
  prompt: "Revenue for Europe",
};

const accepted = (proposal: ProposeParamsResult) => {
  if ("error" in proposal) {
    throw new Error(proposal.error);
  }
  return proposal;
};

describe("browser widget emulator", () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("proposes region and period inputs for the recorded regional ask", async () => {
    const emulator = setup();
    const proposal = await settle(
      emulator.proposeWidgetParams({ sql: REGION_REVENUE.sql })
    );
    expect(proposal).toMatchObject({
      params: [{ name: "region" }, { name: "period" }],
    });
    expect(accepted(proposal).template).toContain("{{region}}");
  });

  it("proposes no inputs for other SQL", async () => {
    const emulator = setup();
    await expect(
      settle(emulator.proposeWidgetParams({ sql: "select 1" }))
    ).resolves.toStrictEqual({ params: [], template: "select 1" });
  });

  it("saves, runs with bound values, and remembers the last values", async () => {
    const emulator = setup();
    const proposal = accepted(
      await settle(emulator.proposeWidgetParams({ sql: REGION_REVENUE.sql }))
    );
    const widget = emulator.saveWidget({
      widget: {
        connectionId: "analytics",
        database: null,
        dialect: "postgresql",
        lastValues: {},
        name: "Revenue by region",
        params: proposal.params,
        prompt: "revenue",
        spec: REGION_REVENUE.spec,
        sqlTemplate: proposal.template,
        view: "line",
      },
    });

    const outcome = await settle(
      emulator.runWidget({
        runId: "r1",
        values: { region: "North America" },
        widgetId: widget.id,
      })
    );
    expect(outcome.compiledSql).toContain("r.name = $1");
    expect(outcome.compiledSql).not.toContain("North America");
    expect(outcome.result.rowCount).toBe(9);
    expect(emulator.listWidgets()[0]?.lastValues).toMatchObject({
      region: "North America",
    });
  });

  it("rejects a region that isn't an option", async () => {
    const emulator = setup();
    const widget = emulator.saveWidget({
      widget: {
        connectionId: "analytics",
        database: null,
        dialect: "postgresql",
        lastValues: {},
        name: "Revenue",
        params: [
          {
            default: "Europe",
            label: "Region",
            name: "region",
            options: ["Europe"],
            type: "select",
          },
        ],
        prompt: "revenue",
        spec: REGION_REVENUE.spec,
        sqlTemplate: "select 1 where r = {{region}}",
        view: "line",
      },
    });
    await expect(
      emulator.runWidget({
        runId: "r1",
        values: { region: "Mars" },
        widgetId: widget.id,
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("reports a missing widget", async () => {
    const emulator = setup();
    await expect(
      emulator.runWidget({ runId: "r1", values: {}, widgetId: "missing" })
    ).rejects.toMatchObject({ code: "WIDGET_NOT_FOUND" });
  });

  it("remembers answered asks once per question", () => {
    const emulator = setup();
    emulator.rememberAsk(askParams, REGION_REVENUE);
    emulator.rememberAsk({ ...askParams, askId: "a2" }, REGION_REVENUE);
    expect(emulator.listRecentAsks().map((ask) => ask.id)).toStrictEqual([
      "a2",
    ]);
  });

  it("lists, removes and clears recent asks", () => {
    const emulator = setup();
    emulator.rememberAsk(askParams, REGION_REVENUE);
    emulator.rememberAsk(
      { ...askParams, askId: "a2", prompt: "signups" },
      REGION_REVENUE
    );
    const ids = (limit?: number) =>
      emulator.listRecentAsks({ limit }).map((ask) => ask.id);
    expect(ids(1)).toStrictEqual(["a2"]);
    emulator.deleteRecentAsk({ askId: "a2" });
    expect(ids()).toStrictEqual([askParams.askId]);
    emulator.clearRecentAsks();
    expect(ids()).toStrictEqual([]);
  });

  it("deletes widgets and lists options", async () => {
    const emulator = setup();
    const widget = emulator.saveWidget({
      widget: {
        connectionId: "analytics",
        database: null,
        dialect: "postgresql",
        lastValues: {},
        name: "Revenue",
        params: [],
        prompt: "revenue",
        spec: REGION_REVENUE.spec,
        sqlTemplate: "select 1",
        view: "line",
      },
    });
    emulator.deleteWidget({ widgetId: widget.id });
    expect(emulator.listWidgets()).toStrictEqual([]);
    await expect(settle(emulator.loadParamOptions())).resolves.toContain(
      "Europe"
    );
  });
});
