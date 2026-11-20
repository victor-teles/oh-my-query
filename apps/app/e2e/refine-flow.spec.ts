import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: Record<string, unknown>;
}

const BASE_TITLE = "Monthly recurring revenue by region";
const EUROPE_TITLE = "Monthly recurring revenue in Europe";

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

test.describe("refine flow", () => {
  test("refines in place, steps back, pre-fills from chips and bars, saves the chain", async ({
    page,
  }) => {
    await seedDemoWorkspace(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("Revenue by region");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: BASE_TITLE })).toBeVisible();

    const card = page.locator('[data-testid="answer-stage"] section');
    await card.evaluate((element) => {
      element.setAttribute("data-probe", "first-card");
    });
    const input = page.getByRole("textbox", { name: "Ask a question" });
    await input.fill("only Europe");
    await input.press("Enter");
    await expect(
      page.getByRole("heading", { name: EUROPE_TITLE })
    ).toBeVisible();
    await expect(card).toHaveAttribute("data-probe", "first-card");

    const trail = page.getByRole("navigation", { name: "Question steps" });
    await expect(trail.getByRole("button")).toHaveCount(2);
    const asks = await ipcCalls(page, "ask");
    expect(asks).toHaveLength(2);
    expect(
      (asks[1]?.payload.refine as { turns: string[] } | undefined)?.turns
    ).toHaveLength(1);

    await input.press("ArrowUp");
    await expect(page.getByRole("heading", { name: BASE_TITLE })).toBeVisible();

    const assumptions = page.getByRole("list", { name: "Assumptions" });
    await assumptions
      .getByRole("button", { name: "Refine without s.status = 'active'" })
      .click();
    await expect(input).toHaveValue("without s.status = 'active'");
    await expect(input).toBeFocused();

    await input.fill("");
    await page.getByRole("radio", { name: "Bar" }).click();
    await page.locator(".recharts-bar-rectangle path").first().click();
    await expect(input).toHaveValue(
      /^break down region "North America", month "/
    );
    expect(await ipcCalls(page, "ask")).toHaveLength(2);

    await input.fill("");
    await input.press("ArrowDown");
    await expect(
      page.getByRole("heading", { name: EUROPE_TITLE })
    ).toBeVisible();
    await input.fill("as a table");
    await input.press("Enter");
    await expect(page.getByRole("radio", { name: "Table" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(await ipcCalls(page, "ask")).toHaveLength(2);

    await page.keyboard.press("Meta+s");
    await expect(
      page.getByRole("textbox", { name: "Widget name" })
    ).toHaveValue(EUROPE_TITLE);
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await ipcCalls(page, "saveWidget")).length)
      .toBe(1);
    const [saved] = await ipcCalls(page, "saveWidget");
    expect(saved?.payload.widget).toMatchObject({
      prompt: "Revenue by region · only Europe",
      sqlTemplate: expect.stringContaining("r.name = 'Europe'"),
      view: "table",
    });
    expect((await ipcCalls(page, "describeSql")).length).toBeGreaterThanOrEqual(
      2
    );
  });
});
