import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: { widgetId?: string };
}

const seedWidgets = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    const stamp = "2026-11-18T09:00:00.000Z";
    localStorage.setItem(
      "conch-connections",
      JSON.stringify([
        {
          createdAt: stamp,
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
        },
      ])
    );
    const period = {
      default: { from: "2026-01-01", to: "2026-10-01" },
      label: "Period",
      name: "period",
      type: "dateRange",
    };
    const spec = (title: string) => ({
      formats: {},
      title,
      version: 1,
      view: { kind: "table" },
    });
    const widget = (id: string, name: string, params: unknown[]) => ({
      connectionId: "analytics",
      createdAt: stamp,
      database: null,
      dialect: "postgresql",
      id,
      lastRunAt: null,
      lastValues: {},
      name,
      params,
      prompt: "",
      spec: spec(name),
      sqlTemplate:
        params.length > 0
          ? "select * from orders where placed_at >= {{period.from}} and placed_at < {{period.to}}"
          : "select count(*) from users",
      updatedAt: stamp,
      view: "table",
    });
    localStorage.setItem(
      "conch-widgets",
      JSON.stringify([
        widget("w-orders", "Orders this period", [period]),
        widget("w-refunds", "Refunds this period", [period]),
        widget("w-users", "Total users", []),
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

const widgetRuns = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as { __conchIpcLog: IpcCall[] }).__conchIpcLog
      .filter((call) => call.name === "runWidget")
      .map((call) => call.payload.widgetId)
  );

const addToBoard = async (page: Page, widgetName: string) => {
  const root = page.getByRole("combobox", { name: "Search commands" });
  await root.fill(widgetName);
  await root.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: new RegExp(widgetName) })
  ).toHaveAttribute("aria-selected", "true");
  await root.press("Meta+k");
  await page.getByRole("menuitem", { name: "Add to Board…" }).click();
};

test.describe("board flow", () => {
  test("builds a board from the launcher and reruns only the tiles that share a changed range", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedWidgets(page);
    await page.goto("/");

    await addToBoard(page, "Orders this period");
    const picker = page.getByRole("combobox", { name: "Search boards" });
    await expect(picker).toBeFocused();
    await picker.press("Enter");
    await page.getByRole("textbox", { name: "Board name" }).fill("Finance");
    const opened = page.context().waitForEvent("page");
    await page.keyboard.press("Enter");
    const boardId = new URL((await opened).url()).hash.replace("#/board/", "");
    expect(boardId).not.toBe("");

    await addToBoard(page, "Refunds this period");
    await page.getByRole("option", { name: /Finance/ }).click();
    await addToBoard(page, "Total users");
    await page.getByRole("option", { name: /Finance/ }).click();

    await page.goto(`/#/board/${boardId}`);
    await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByText("Updated just now")).toBeVisible();
    const before = (await widgetRuns(page)).length;

    await page.getByRole("button", { name: /^Period:/ }).click();
    await page.getByRole("option", { name: "Year to date" }).click();

    await expect
      .poll(async () => (await widgetRuns(page)).slice(before).toSorted())
      .toStrictEqual(["w-orders", "w-refunds"]);
    await page.waitForTimeout(500);
    expect((await widgetRuns(page)).slice(before)).toHaveLength(2);
    expect(errors).toStrictEqual([]);
  });
});
