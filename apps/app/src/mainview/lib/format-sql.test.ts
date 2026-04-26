import { describe, expect, it } from "vitest";

import { formatSql } from "@/lib/format-sql";
import { mockTauri } from "@/test/tauri-mock";

describe("formatSql", () => {
  it("returns the input unchanged in browser (non-Tauri) environments", async () => {
    await expect(formatSql("select 1", "postgresql")).resolves.toBe("select 1");
  });

  it("invokes the Tauri format_sql command in desktop environments", async () => {
    mockTauri({
      format_sql: (payload) => {
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
