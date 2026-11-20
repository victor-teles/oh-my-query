import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const seedDemoWorkspace = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
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
    localStorage.setItem(
      "oh-my-query-connections",
      JSON.stringify([connection])
    );
    localStorage.setItem(
      "oh-my-query-active-connection",
      JSON.stringify({ connectionId: "analytics", database: null })
    );
    localStorage.setItem(
      "oh-my-query-ai-settings",
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

test.describe("widget flow", () => {
  test("saves an answer with inputs, finds it from root and reruns it with another region", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedDemoWorkspace(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("Revenue for Europe");
    await search.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Monthly recurring revenue in Europe" })
    ).toBeVisible();

    await page.keyboard.press("Meta+Shift+S");
    const inputs = page.getByRole("list", { name: "Inputs" });
    await expect(inputs.getByRole("listitem")).toHaveCount(2);
    await expect(
      inputs.getByRole("textbox", { name: "Label for region" })
    ).toHaveValue("Region");

    await page
      .getByRole("textbox", { name: "Widget name" })
      .fill("Revenue by region");
    await page.keyboard.press("Meta+Enter");

    const root = page.getByRole("combobox", { name: "Search commands" });
    await expect(root).toBeVisible();
    await root.fill("revenue by region");
    await root.press("ArrowDown");
    const widgetRow = page.getByRole("option", { name: /Revenue by region/ });
    await expect(widgetRow).toHaveAttribute("aria-selected", "true");

    await root.press("Tab");
    const region = page.getByRole("combobox", { name: "Region" });
    await expect(region).toBeFocused();
    await region.fill("north");
    await expect(
      page.getByRole("option", { name: "North America" })
    ).toBeVisible();
    await region.press("Enter");

    await expect(page.getByText(/9 rows/)).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Region" })).toHaveValue(
      "North America"
    );
    const card = page.getByRole("region", { name: "Revenue by region" });
    await expect(card).toContainText("North America");

    await page.reload();
    const again = page.getByRole("combobox", { name: "Search commands" });
    await again.fill("revenue by region");
    await expect(
      page.getByRole("option", { name: /North America/ })
    ).toBeVisible();

    expect(errors).toStrictEqual([]);
  });
});
