import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { SizeChip } from "./size-chip";

describe("size-chip", () => {
  it("renders an em-dash when size is null", () => {
    const screen = render(<SizeChip size={null} unit="bytes" />);
    expect(screen.getByText("—")).toBeVisible();
  });

  it("formats bytes under 1 KiB with the B suffix", () => {
    const screen = render(<SizeChip size={512} unit="bytes" />);
    expect(screen.getByText("512")).toBeVisible();
    expect(screen.getByText("B")).toBeVisible();
  });

  it("formats bytes in the kilobyte range", () => {
    const screen = render(<SizeChip size={2048} unit="bytes" />);
    expect(screen.getByText("2.0k")).toBeVisible();
  });

  it("formats bytes in the megabyte range", () => {
    const screen = render(<SizeChip size={2 * 1024 * 1024} unit="bytes" />);
    expect(screen.getByText("2.0M")).toBeVisible();
  });

  it("formats counts with locale separators for non-byte units", () => {
    const screen = render(<SizeChip size={12_345} unit="entries" />);
    expect(screen.getByText("12,345")).toBeVisible();
  });
});
