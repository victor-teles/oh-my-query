import { describe, expect, it } from "vitest";

import { formatSql } from "@/lib/format-sql";
import { mockTauri } from "@/test/tauri-mock";

describe("formatSql", () => {
  it("forwards the SQL and dialect to the bun-side formatter", async () => {
    mockTauri({
      formatSql: (payload) => {
        expect(payload).toStrictEqual({
          dialect: "postgresql",
          sql: "select 1",
        });
        return "SELECT 1;";
      },
    });

    await expect(formatSql("select 1", "postgresql")).resolves.toBe(
      "SELECT 1;"
    );
  });
});
