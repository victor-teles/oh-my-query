import type { CardResult } from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";

import type { CardSpec } from "@/lib/ipc";

import { askStateAfter, REVENUE, SIGNUPS } from "@/test/ask-fixtures";

const answerOf = (prompt: string) => {
  const { answer } = askStateAfter(prompt);
  if (!answer?.spec) {
    throw new Error(`the ${prompt} script has no card`);
  }
  return { result: answer.result, spec: answer.spec };
};

export const revenue = answerOf(REVENUE);
export const signups = answerOf(SIGNUPS);

export const kpi: { spec: CardSpec; result: CardResult } = {
  result: {
    columns: [
      { name: "total_mrr", typeName: "NUMERIC" },
      { name: "change_pct", typeName: "FLOAT8" },
    ],
    isTruncated: false,
    rowCount: 1,
    rows: [["475000", 0.54]],
  },
  spec: {
    formats: {
      change_pct: { kind: "percent" },
      total_mrr: { currency: "USD", kind: "currency" },
    },
    title: "Total MRR",
    version: CARD_SPEC_VERSION,
    view: {
      delta: "change_pct",
      kind: "kpi",
      label: "MRR in September",
      value: "total_mrr",
    },
  },
};
