import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

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

describe("dATABASE_ICON_MAP", () => {
  it.each(TYPES)("renders an svg for %s", (type) => {
    const Icon = DATABASE_ICON_MAP[type];
    const screen = render(<Icon data-testid="icon" />);
    expect(screen.container.querySelector("svg")).not.toBeNull();
  });
});
