import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DatabaseType } from "@/lib/connections";

import { DATABASE_ICON_MAP } from "./database-icons";

const TYPES: DatabaseType[] = [
  "postgresql",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
  "clickhouse",
  "duckdb",
  "mssql",
];

describe("DATABASE_ICON_MAP", () => {
  it.each(TYPES)("renders an svg for %s", (type) => {
    const Icon = DATABASE_ICON_MAP[type];
    const { container } = render(<Icon data-testid="icon" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
