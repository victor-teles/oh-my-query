import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: Record<string, unknown>;
}

const ipcCalls = (page: Page, name: string) =>
  page.evaluate(
    (wanted) =>
      (
        globalThis as unknown as { __conchIpcLog: IpcCall[] }
      ).__conchIpcLog.filter((call) => call.name === wanted),
    name
  );

const seedDemoWorkspace = async (page: Page) => {
  await page.addInitScript(() => {
    const connection = {
      createdAt: "2026-11-01T00:00:00.000Z",
      database: "analytics",
      host: "localhost",
      id: "analytics",
      lastConnectedAt: null,
      name: "analytics",
      password: "",
      pinned: false,
      port: 5432,
      type: "postgresql",
      username: "postgres",
    };
    localStorage.setItem("conch-connections", JSON.stringify([connection]));
    localStorage.setItem(
      "conch-active-connection",
      JSON.stringify({ connectionId: "analytics", database: null })
    );
    localStorage.setItem(
      "conch-ai-settings",
      JSON.stringify({
        baseUrl: null,
        hasKey: true,
        keyHint: "abcd",
        model: null,
        provider: "anthropic",
      })
    );
  });
};

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

test.describe("ask flow", () => {
  test("streams SQL, runs it and answers with a line card that switches to a table", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedDemoWorkspace(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("Revenue by region");
    await search.press("Enter");

    await expect(page.getByRole("status")).toContainText("Writing SQL");
    await expect(
      page.getByRole("heading", { name: "Monthly recurring revenue by region" })
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "Line" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await page.getByRole("radio", { name: "Table" }).click();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(28);

    expect(errors).toStrictEqual([]);
  });

  test("takes the answer out through the ⌘K actions", async ({ page }) => {
    const errors = collectErrors(page);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedDemoWorkspace(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("Revenue by region");
    await search.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Monthly recurring revenue by region" })
    ).toBeVisible();

    const input = page.getByRole("textbox", { name: "Ask a question" });
    await input.press("Meta+k");
    await page.getByRole("menuitem", { name: "Copy as Markdown" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Copied 27 rows as Markdown" })
    ).toBeVisible();

    await input.press("Meta+k");
    await page.getByRole("menuitem", { name: "Save CSV to Downloads" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Saved monthly-recurring-revenue-by-region.csv" })
    ).toBeVisible();
    const saves = await ipcCalls(page, "saveToDownloads");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.payload).toMatchObject({ extension: "csv" });

    expect(errors).toStrictEqual([]);
  });

  test("refuses a question that would change data", async ({ page }) => {
    await seedDemoWorkspace(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("delete all users");
    await search.press("Enter");

    await expect(page.getByRole("alert")).toContainText(
      "This would change data"
    );
    await expect(
      page.getByRole("region", { name: "Generated SQL" })
    ).toContainText("delete from users");
  });
});

const seedEngineWorkspace = async (
  page: Page,
  connection: { id: string; name: string; type: string; port: number }
) => {
  await page.addInitScript((target) => {
    localStorage.setItem(
      "conch-connections",
      JSON.stringify([
        {
          createdAt: "2026-11-01T00:00:00.000Z",
          database: target.type === "redis" ? "0" : "shop",
          host: "localhost",
          lastConnectedAt: null,
          password: "",
          pinned: false,
          username: "",
          ...target,
        },
      ])
    );
    localStorage.setItem(
      "conch-active-connection",
      JSON.stringify({ connectionId: target.id, database: null })
    );
    localStorage.setItem(
      "conch-ai-settings",
      JSON.stringify({
        baseUrl: null,
        hasKey: true,
        keyHint: "abcd",
        model: null,
        provider: "anthropic",
      })
    );
  }, connection);
};

const ENGINES = [
  {
    answer: "Orders by status",
    connection: { id: "shop", name: "shop", port: 27_017, type: "mongodb" },
    heading: "Generated pipeline",
    offending: "$merge",
    question: "orders by status",
    write: "merge every order into the archive",
  },
  {
    answer: "Keys by pattern",
    connection: {
      id: "cache",
      name: "sessions-cache",
      port: 6379,
      type: "redis",
    },
    heading: "Generated commands",
    offending: "SET",
    question: "keys by pattern",
    write: "set the checkout flag off",
  },
] as const;

test.describe("ask flow on MongoDB and Redis", () => {
  for (const engine of ENGINES) {
    test(`answers and refuses on ${engine.connection.type}`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await seedEngineWorkspace(page, engine.connection);
      await page.goto("/");

      const search = page.getByRole("combobox", { name: "Search commands" });
      await search.fill(engine.question);
      await search.press("Enter");

      await expect(
        page.getByRole("heading", { name: engine.heading })
      ).toBeVisible();
      await expect(page.getByRole("status").first()).toContainText(
        `Read only on ${engine.connection.name}`
      );
      await expect(
        page.getByRole("heading", { name: engine.answer })
      ).toBeVisible();
      await expect(page.getByRole("radio", { name: "Bar" })).toHaveAttribute(
        "aria-checked",
        "true"
      );

      const input = page.getByRole("textbox", { name: "Ask a question" });
      await input.press("Meta+s");
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Saving works with SQL databases for now." })
      ).toBeVisible();
      expect(await ipcCalls(page, "saveWidget")).toHaveLength(0);
      expect(await ipcCalls(page, "describeSql")).toHaveLength(0);

      await input.fill(engine.write);
      await input.press("Meta+Enter");
      await expect(page.getByRole("alert")).toContainText(
        "This would change data"
      );
      const offending = page
        .getByRole("region", { name: engine.heading })
        .getByText(engine.offending, { exact: true });
      await expect(offending).toHaveClass(/underline/);
      expect(await ipcCalls(page, "saveWidget")).toHaveLength(0);

      expect(errors).toStrictEqual([]);
    });
  }
});
