import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { TypeBadge } from "./type-badge";

describe("type-badge", () => {
  it.each([
    ["STRING", "STR"],
    ["HASH", "HASH"],
    ["LIST", "LIST"],
    ["SET", "SET"],
    ["ZSET", "ZSET"],
    ["STREAM", "STRM"],
    ["UNKNOWN", "???"],
  ] as const)("renders %s as %s", (kind, label) => {
    const screen = render(<TypeBadge kind={kind} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
