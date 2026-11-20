import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

import type { AskEvent, CardSpec, SqlAssumptions } from "@/lib/ipc";

import type { AskAction, AskState } from "./ask-reducer";

import { chainPromptOf, refineContextOf } from "./ask-chain";
import {
  askReducer,
  atTurnLimit,
  canRefine,
  initialAskState,
  isRefining,
  shownTurn,
} from "./ask-reducer";

const specFor = (title: string, mark: "bar" | "line" = "bar"): CardSpec => ({
  formats: {},
  title,
  version: CARD_SPEC_VERSION,
  view: { kind: "chart", mark, stacked: false, x: "region", y: ["mrr"] },
});

const answerEvents = (sql: string, spec: CardSpec): AskEvent[] => [
  { detail: "Writing SQL", phase: "sql", type: "phase" },
  { text: sql, type: "sqlDelta" },
  { dialect: "postgresql", lines: 1, sql, type: "sqlDone" },
  { detail: "Read only", phase: "run", type: "phase" },
  {
    columns: [
      { name: "region", typeName: "TEXT" },
      { name: "mrr", typeName: "NUMERIC" },
    ],
    executionTimeMs: 12,
    isTruncated: false,
    rowCount: 1,
    rows: [["Europe", "10"]],
    type: "result",
  },
  { detail: "Shaping", phase: "present", type: "phase" },
  { source: "model", spec, type: "card" },
  { type: "done" },
];

const run = (actions: AskAction[], from: AskState = initialAskState) => {
  let state = from;
  for (const action of actions) {
    state = askReducer(state, action);
  }
  return state;
};

const ASSUMED: SqlAssumptions = { items: [{ kind: "limit", rows: 500 }] };

const firstTurn = run([
  {
    askId: "chain-1",
    prompt: "MRR by region",
    source: "question",
    type: "start",
  },
  ...answerEvents("select 1", specFor("MRR by region")),
]);

const refined = (from: AskState, prompt: string, sql: string) =>
  run(
    [{ prompt, type: "refine" }, ...answerEvents(sql, specFor(prompt))],
    from
  );

const threeTurns = refined(
  refined(firstTurn, "only Europe", "select 2"),
  "by quarter",
  "select 3"
);

describe("a chain of turns", () => {
  it("records the first answer as turn one", () => {
    expect(firstTurn).toMatchObject({
      chainId: "chain-1",
      position: 0,
      status: "done",
      transition: "fresh",
    });
    expect(shownTurn(firstTurn)).toMatchObject({
      prompt: "MRR by region",
      sql: "select 1",
      view: "bar",
    });
  });

  it("starts a refine with the shown turn kept on screen", () => {
    const state = run(
      [
        { prompt: "only Europe", type: "refine" },
        ...answerEvents("select 2", specFor("x")).slice(0, 5),
      ],
      firstTurn
    );
    expect(isRefining(state)).toBeTruthy();
    expect(state).toMatchObject({ prompt: "only Europe", sql: "select 2" });
    expect(shownTurn(state)?.sql).toBe("select 1");
  });

  it("appends the refined turn and shows it", () => {
    const state = refined(firstTurn, "only Europe", "select 2");
    expect(state).toMatchObject({
      position: 1,
      prompt: "only Europe",
      sql: "select 2",
      status: "done",
      transition: "refine",
    });
    expect(state.turns).toHaveLength(2);
  });

  it("keeps a view the user switched to when the card kind stays the same", () => {
    const switched = run([{ type: "selectView", view: "table" }], firstTurn);
    expect(shownTurn(switched)?.view).toBe("table");
    expect(shownTurn(refined(switched, "only Europe", "select 2"))?.view).toBe(
      "table"
    );
  });

  it("branches from an earlier turn, dropping the later ones", () => {
    const back = run([{ to: 0, type: "stepTurn" }], threeTurns);
    const branched = refined(back, "only Asia", "select 4");
    expect(branched.turns.map((turn) => turn.prompt)).toStrictEqual([
      "MRR by region",
      "only Asia",
    ]);
  });

  it("restores the shown turn when a refine fails", () => {
    const state = run(
      [
        { prompt: "drop it", type: "refine" },
        {
          code: "NOT_READ_ONLY",
          message: "Only read-only queries can run here, not DELETE.",
          phase: "sql",
          sql: "delete from t",
          type: "error",
        },
      ],
      firstTurn
    );
    expect(state).toMatchObject({
      failure: { code: "NOT_READ_ONLY" },
      prompt: "drop it",
      sql: "delete from t",
      status: "error",
    });
    expect(shownTurn(state)?.sql).toBe("select 1");
    expect(canRefine(state)).toBeTruthy();
  });

  it.each<[string, AskAction]>([
    ["a stop", { type: "cancel" }],
    [
      "a cancelled event",
      {
        code: "CANCELLED",
        message: "cancelled",
        phase: "sql",
        type: "error",
      },
    ],
  ])("puts the shown turn back after %s", (_label, stop) => {
    const state = run(
      [
        { prompt: "by week", type: "refine" },
        { text: "select", type: "sqlDelta" },
        stop,
      ],
      firstTurn
    );
    expect(state).toMatchObject({
      prompt: "MRR by region",
      sql: "select 1",
      status: "done",
    });
    expect(state.turns).toHaveLength(1);
  });

  it("refuses a refine while working or without a shown turn", () => {
    const working = run([{ prompt: "a", type: "refine" }], firstTurn);
    expect(run([{ prompt: "b", type: "refine" }], working).prompt).toBe("a");
    expect(
      run([{ prompt: "b", type: "refine" }], initialAskState)
    ).toStrictEqual(initialAskState);
  });

  it("stops refining at the turn limit", () => {
    let state = firstTurn;
    for (const index of [2, 3, 4, 5, 6]) {
      state = refined(state, `turn ${index}`, `select ${index}`);
    }
    expect(state.turns).toHaveLength(6);
    expect(canRefine(state)).toBeFalsy();
    expect(atTurnLimit(state)).toBeTruthy();
    expect(run([{ prompt: "more", type: "refine" }], state)).toBe(state);
  });
});

describe("stepping and restoring", () => {
  it("shows an earlier turn without asking", () => {
    const state = run([{ to: 1, type: "stepTurn" }], threeTurns);
    expect(state).toMatchObject({
      position: 1,
      prompt: "only Europe",
      sql: "select 2",
      transition: "step",
    });
  });

  it("ignores a step out of range or while working", () => {
    expect(run([{ to: 9, type: "stepTurn" }], threeTurns)).toBe(threeTurns);
    const working = run([{ prompt: "x", type: "refine" }], threeTurns);
    expect(run([{ to: 0, type: "stepTurn" }], working)).toBe(working);
  });

  it("marks a reopened chain as restored", () => {
    expect(run([{ type: "restore" }], threeTurns).transition).toBe("restore");
    expect(run([{ type: "restore" }], initialAskState)).toBe(initialAskState);
  });

  it("remembers a view per turn", () => {
    const state = run(
      [
        { to: 0, type: "stepTurn" },
        { type: "selectView", view: "table" },
        { to: 2, type: "stepTurn" },
        { to: 0, type: "stepTurn" },
      ],
      threeTurns
    );
    expect(state.view).toBe("table");
  });
});

describe("assumptions", () => {
  it("applies to the live SQL and to the turn it completes", () => {
    const state = run(
      [
        {
          askId: "a",
          prompt: "q",
          source: "question",
          type: "start",
        },
        ...answerEvents("select 9", specFor("q")).slice(0, 3),
        { sql: "select 9", type: "assumptions", value: ASSUMED },
        ...answerEvents("select 9", specFor("q")).slice(3),
      ],
      initialAskState
    );
    expect(shownTurn(state)?.assumptions).toStrictEqual(ASSUMED);
  });

  it("fills in a turn when the description arrives late", () => {
    const state = run(
      [{ sql: "select 1", type: "assumptions", value: ASSUMED }],
      threeTurns
    );
    expect(state.turns[0]?.assumptions).toStrictEqual(ASSUMED);
  });

  it("drops a description for SQL that is no longer anywhere", () => {
    expect(
      run(
        [{ sql: "select 42", type: "assumptions", value: ASSUMED }],
        firstTurn
      )
    ).toBe(firstTurn);
  });
});

describe("chain selectors", () => {
  it("sends only the turns up to the shown one as context", () => {
    const back = run([{ to: 1, type: "stepTurn" }], threeTurns);
    expect(refineContextOf(back)).toStrictEqual({
      chainId: "chain-1",
      spec: specFor("only Europe"),
      sql: "select 2",
      turns: ["MRR by region", "only Europe"],
    });
    expect(chainPromptOf(back)).toBe("MRR by region · only Europe");
  });

  it("has no context before an answer", () => {
    expect(refineContextOf(initialAskState)).toBeNull();
    expect(chainPromptOf(initialAskState)).toBe("");
  });
});
