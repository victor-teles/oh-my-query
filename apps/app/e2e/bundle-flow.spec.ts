import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const seedWorkspace = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    const stamp = "2026-11-18T09:00:00.000Z";
    localStorage.setItem(
      "oh-my-query-connections",
      JSON.stringify([
        {
          createdAt: stamp,
          database: "analytics",
          host: "db.internal.example",
          id: "analytics",
          lastConnectedAt: null,
          name: "analytics",
          password: "",
          pinned: false,
          port: 5432,
          type: "postgresql",
          username: "reporting_user",
        },
      ])
    );
    localStorage.setItem(
      "oh-my-query-widgets",
      JSON.stringify([
        {
          connectionId: "analytics",
          createdAt: stamp,
          database: null,
          dialect: "postgresql",
          id: "w-orders",
          lastRunAt: null,
          lastValues: {},
          name: "Orders this period",
          params: [
            {
              default: { from: "2026-01-01", to: "2026-10-01" },
              label: "Period",
              name: "period",
              type: "dateRange",
            },
          ],
          prompt: "orders this period",
          spec: {
            formats: {},
            title: "Orders this period",
            version: 1,
            view: { kind: "table" },
          },
          sqlTemplate:
            "select * from orders where placed_at >= {{period.from}} and placed_at < {{period.to}}",
          updatedAt: stamp,
          view: "table",
        },
      ])
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

const rootInput = (page: Page) =>
  page.getByRole("combobox", { name: "Search commands" });

const selectOption = async (page: Page, name: RegExp) => {
  const option = page.getByRole("option", { name });
  for (let step = 0; step < 12; step += 1) {
    if ((await option.getAttribute("aria-selected")) === "true") {
      return;
    }
    await rootInput(page).press("ArrowDown");
  }
  await expect(option).toHaveAttribute("aria-selected", "true");
};

const runCatalogAction = async (page: Page, name: RegExp, action: string) => {
  await rootInput(page).fill(name.source.replaceAll("\\", ""));
  await selectOption(page, name);
  await rootInput(page).press("Meta+k");
  await page.getByRole("menuitem", { name: action }).click();
};

test.describe("bundle flow", () => {
  test("exports a widget and its board, then imports them back", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedWorkspace(page);
    await page.goto("/");

    await runCatalogAction(page, /Orders this period/, "Add to Board…");
    const picker = page.getByRole("combobox", { name: "Search boards" });
    await expect(picker).toBeFocused();
    await picker.press("Enter");
    await page.getByRole("textbox", { name: "Board name" }).fill("Finance");
    const opened = page.context().waitForEvent("page");
    await page.keyboard.press("Enter");
    await (await opened).close();

    await rootInput(page).fill("export widgets");
    await rootInput(page).press("Enter");
    await expect(page.getByRole("status")).toContainText(
      "Exported 1 widget, 1 board"
    );

    await runCatalogAction(page, /Finance/, "Delete");
    await page.getByRole("menuitem", { name: /Press ↵ again/ }).click();
    await rootInput(page).fill("Orders this period");
    await rootInput(page).press("Enter");
    await expect(page.getByText(/rows?/).first()).toBeVisible();
    await page.keyboard.press("Meta+k");
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("menuitem", { name: /Press ↵ again/ }).click();
    await expect(rootInput(page)).toBeVisible();
    await rootInput(page).fill("");
    await expect(
      page.getByRole("option", { name: /Orders this period/ })
    ).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Boards" })).toHaveCount(0);

    await rootInput(page).fill("import widgets");
    await rootInput(page).press("Enter");
    await page.getByRole("button", { name: /From Clipboard/ }).click();
    const mapping = page.getByRole("radiogroup", {
      name: "analytics · PostgreSQL",
    });
    await expect(mapping).toBeFocused();
    await expect(
      mapping.getByRole("radio", { name: /analytics/ })
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Import 1 widget, 1 board")).toBeVisible();
    await page.keyboard.press("Meta+Enter");
    await expect(
      page.getByText("Imported 1 widget and 1 board.")
    ).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("option", { name: /Orders this period/ })
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Boards" })).toContainText(
      "Finance"
    );
    const exported = await page.evaluate(() =>
      JSON.stringify(
        (globalThis as unknown as { __omqIpcLog: { name: string }[] })
          .__omqIpcLog
      )
    );
    expect(exported).not.toContain("db.internal.example");
    expect(exported).not.toContain("reporting_user");
    expect(errors).toStrictEqual([]);
  });
});
