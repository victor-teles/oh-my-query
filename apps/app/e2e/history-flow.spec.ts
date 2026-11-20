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

const QUESTIONS = [
  ["Revenue by region", "Monthly recurring revenue by region"],
  ["Signups by plan this quarter", "Weekly signups by plan"],
  ["Revenue for Europe", "Monthly recurring revenue in Europe"],
] as const;

const askFromRoot = async (page: Page, prompt: string, heading: string) => {
  const search = page.getByRole("combobox", { name: "Search commands" });
  await search.fill(prompt);
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeVisible();
};

test.describe("history flow", () => {
  test("finds a past ask, asks it again and removes another", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedDemoWorkspace(page);
    await page.goto("/");

    for (const [prompt, heading] of QUESTIONS) {
      await askFromRoot(page, prompt, heading);
    }

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.press("Meta+y");
    const history = page.getByRole("combobox", { name: "Search history" });
    await expect(history).toBeFocused();
    const pastAsks = page.getByRole("listbox", { name: "Past asks" });
    await expect(pastAsks.getByRole("group", { name: "Today" })).toContainText(
      "Revenue for Europe"
    );

    await history.fill("europe");
    const europe = pastAsks.getByRole("option", { name: /Revenue for Europe/ });
    await expect(europe).toHaveAttribute("aria-selected", "true");
    await history.press("Control+x");
    await expect(page.getByText("Removed from history")).toBeVisible();
    await expect(europe).toHaveCount(0);

    await history.fill("plan");
    await expect(
      pastAsks.getByRole("group", { name: "Matches" })
    ).toContainText("Signups by plan this quarter");
    await history.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Weekly signups by plan" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(history).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(search).toBeVisible();
    await search.fill("");
    const recent = page.getByRole("group", { name: "Recent" });
    await expect(recent).toContainText("Revenue by region");
    await expect(recent).not.toContainText("Revenue for Europe");

    expect(errors).toStrictEqual([]);
  });
});
