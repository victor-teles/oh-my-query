import { describe, expect, it } from "vitest";

import { localTime, makeStatus, makeWatch } from "@/test/watch-fixtures";

import { clockTime } from "./trend-delta";
import { savedLine, statusLine, watchingSentence } from "./watch-status-copy";

describe("watch status copy", () => {
  it("names the interval and the next run", () => {
    const status = makeStatus();
    expect(statusLine(makeWatch(), status)).toBe(
      `Every 5 min · next ${clockTime(localTime(9, 46))}`
    );
    expect(statusLine(makeWatch({ interval: "1h" }))).toBe("Every hour");
  });

  it("says paused, running or why it couldn't refresh", () => {
    expect(statusLine(makeWatch({ paused: true }), makeStatus())).toBe(
      "Paused"
    );
    expect(statusLine(makeWatch(), makeStatus(), true)).toBe("Paused");
    expect(statusLine(makeWatch(), makeStatus({ state: "running" }))).toBe(
      "Running…"
    );
    expect(
      statusLine(
        makeWatch(),
        makeStatus({
          error: { code: "QUERY_FAILED", message: "Timed out." },
          state: "error",
        })
      )
    ).toBe("Couldn't refresh: Timed out.");
  });

  it("writes the saved line and the announcement", () => {
    expect(savedLine({ interval: "5m" })).toBe("Watching · every 5 min");
    expect(watchingSentence("MRR", { interval: "15m" })).toBe(
      "Watching MRR every 15 minutes"
    );
  });
});
