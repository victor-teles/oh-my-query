import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { TtlChip } from "./ttl-chip";

describe("ttl-chip", () => {
  it("renders an em-dash and aria-hidden when no TTL is set", () => {
    const screen = render(<TtlChip ttlSecs={null} />);
    expect(screen.getByText("—")).toBeVisible();
  });

  it("formats sub-minute TTLs in seconds and flags expiring", () => {
    const screen = render(<TtlChip ttlSecs={45} />);
    expect(screen.getByText("45s")).toBeVisible();
  });

  it("formats minutes for sub-hour TTLs", () => {
    const screen = render(<TtlChip ttlSecs={120} />);
    expect(screen.getByText("2m")).toBeVisible();
  });

  it("formats hours for sub-day TTLs", () => {
    const screen = render(<TtlChip ttlSecs={3 * 3600} />);
    expect(screen.getByText("3h")).toBeVisible();
  });

  it("formats days for long TTLs", () => {
    const screen = render(<TtlChip ttlSecs={2 * 86_400} />);
    expect(screen.getByText("2d")).toBeVisible();
  });
});
