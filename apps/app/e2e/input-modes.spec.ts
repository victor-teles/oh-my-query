import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: Record<string, unknown>;
}

const connection = (id: string, name: string) => ({
  createdAt: "2026-11-01T00:00:00.000Z",
  database: "analytics",
  host: "localhost",
  id,
  lastConnectedAt: null,
  name,
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
});

// No AI settings are seeded: every flow here must work without a key.
const seedWorkspace = async (page: Page) => {
  await page.addInitScript(
    (connections) => {
      if (sessionStorage.getItem("seeded")) {
        return;
      }
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "oh-my-query-connections",
        JSON.stringify(connections)
      );
      localStorage.setItem(
        "oh-my-query-active-connection",
        JSON.stringify({ connectionId: "analytics", database: null })
      );
    },
    [connection("analytics", "analytics"), connection("billing", "billing")]
  );
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

const requestNames = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as { __omqIpcLog: IpcCall[] }).__omqIpcLog.map(
      (call) => call.name
    )
  );

const searchBox = (page: Page) =>
  page.getByRole("combobox", { name: "Search commands" });

test.describe("launcher input modes", () => {
  test("runs typed SQL without asking the model", async ({ page }) => {
    const errors = collectErrors(page);
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill("> select region, mrr from revenue");
    await expect(page.getByText("Run on analytics · read only")).toBeVisible();
    await searchBox(page).press("Enter");

    await expect(
      page.getByRole("heading", { name: "Query on analytics" })
    ).toBeVisible();
    await expect(page.getByText("Your SQL")).toBeVisible();
    const names = await requestNames(page);
    expect(names).toContain("runSql");
    expect(names).not.toContain("ask");
    expect(errors).toStrictEqual([]);
  });

  test("refuses SQL that would change data", async ({ page }) => {
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill("> delete from orders");
    await searchBox(page).press("Enter");

    await expect(page.getByRole("alert")).toContainText(
      "The launcher only runs read-only queries."
    );
  });

  test("peeks a table and previews its rows", async ({ page }) => {
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill("#ord");
    await expect(page.getByRole("option", { name: /orders/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(
      page.getByRole("region", { name: "Columns of orders" })
    ).toContainText("customer_id");
    await searchBox(page).press("Enter");

    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("switches connection with @ and a space", async ({ page }) => {
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill("@");
    await expect(page.getByText("Switch connection")).toBeVisible();
    await searchBox(page).pressSequentially("bil ");

    await expect(
      page.getByRole("img", { name: "Active connection: billing" })
    ).toBeVisible();
    await expect(searchBox(page)).toHaveValue("");
  });

  test("saves a raw query as a widget and finds it from root", async ({
    page,
  }) => {
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill("> select region, mrr from revenue");
    await searchBox(page).press("Enter");
    await expect(
      page.getByRole("heading", { name: "Query on analytics" })
    ).toBeVisible();

    const askInput = page.getByRole("textbox", { name: "Ask a question" });
    await askInput.press("Meta+s");
    const name = page.getByRole("textbox", { name: "Widget name" });
    await name.fill("Raw revenue");
    await name.press("Enter");
    await expect(page.getByText("Saved · ⌥⏎ to run")).toBeVisible();

    await askInput.press("Escape");
    await searchBox(page).fill("Raw revenue");
    await expect(
      page.getByRole("option", { name: /Raw revenue/ })
    ).toBeVisible();
  });
});
