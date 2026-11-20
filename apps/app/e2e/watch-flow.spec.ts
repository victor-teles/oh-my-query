import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: unknown;
}

const seedKpiWidget = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    const stamp = "2026-11-19T09:00:00.000Z";
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
    localStorage.setItem(
      "conch-widgets",
      JSON.stringify([
        {
          connectionId: "analytics",
          createdAt: stamp,
          database: null,
          dialect: "postgresql",
          id: "w-mrr",
          lastRunAt: null,
          lastValues: {},
          name: "MRR",
          params: [],
          prompt: "monthly recurring revenue",
          spec: {
            formats: { mrr: { currency: "USD", kind: "currency" } },
            title: "MRR",
            version: 1,
            view: { kind: "kpi", value: "mrr" },
          },
          sqlTemplate: "select sum(mrr) as mrr from revenue",
          updatedAt: stamp,
          view: "kpi",
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

const ipcCalls = (page: Page, name: string) =>
  page.evaluate(
    (method) =>
      (
        (globalThis as unknown as { __conchIpcLog: IpcCall[] }).__conchIpcLog ??
        []
      ).filter((call) => call.name === method),
    name
  );

test.describe("watch flow", () => {
  test("watches a KPI below a threshold and opens the widget from the alert", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedKpiWidget(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("MRR");
    const row = page.getByRole("option", { name: /MRR/ });
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Meta+k");
    await page.getByRole("menuitem", { name: "Watch…" }).click();
    await expect(
      page.getByRole("heading", { name: "Watch MRR" })
    ).toBeVisible();

    await page.getByRole("radio", { name: "Below" }).click();
    await page.getByRole("textbox", { name: "Alert when below" }).fill("50000");
    await expect(page.getByText("$50k")).toBeVisible();
    await page.keyboard.press("Meta+Enter");

    await expect(page.getByText("Watching · every 5 min")).toBeVisible();
    await expect(search).toBeVisible();
    await expect(row.getByRole("img", { name: "Has an alert" })).toBeVisible();
    const saves = await ipcCalls(page, "saveWatch");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.payload).toMatchObject({
      watch: { alert: { kind: "below", threshold: 50_000 }, widgetId: "w-mrr" },
    });

    await search.fill("");
    const alerts = page.getByRole("group", { name: "Alerts" });
    await expect(alerts).toContainText("MRR below $50k");
    await expect(
      page.getByRole("option", { name: /MRR below \$50k/ })
    ).toHaveAttribute("aria-selected", "true");
    await search.press("Enter");

    await expect(
      page.getByRole("group", { exact: true, name: "MRR" })
    ).toBeVisible();
    expect(await ipcCalls(page, "acknowledgeAlert")).toHaveLength(1);
    expect(errors).toStrictEqual([]);
  });
});
