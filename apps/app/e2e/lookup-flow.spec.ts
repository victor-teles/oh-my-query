import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: Record<string, unknown>;
}

const DEMO_UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";

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

// No AI settings are seeded: looking up an id never needs a model.
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
    [connection("analytics", "analytics")]
  );
};

const requestNames = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as { __omqIpcLog: IpcCall[] }).__omqIpcLog.map(
      (call) => call.name
    )
  );

const setClipboard = (page: Page, text: string) =>
  page.evaluate((value) => {
    (
      globalThis as unknown as { __omqSetClipboard: (text: string) => void }
    ).__omqSetClipboard(value);
  }, text);

const searchBox = (page: Page) =>
  page.getByRole("combobox", { name: "Search commands" });

const hitRows = (page: Page) =>
  page
    .getByRole("listbox", { name: "Tables holding the value" })
    .getByRole("option");

const enableClipboardLookups = async (page: Page) => {
  await page.keyboard.press("Meta+Comma");
  const box = page.getByRole("checkbox", {
    name: "Suggest lookups from the clipboard",
  });
  await box.click();
  await expect(box).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(searchBox(page)).toBeVisible();
};

const resummon = async (page: Page) => {
  const panel = page.locator("[data-presence]");
  await searchBox(page).press("Escape");
  await expect(panel).toHaveAttribute("data-presence", "hidden");
  await expect.poll(() => requestNames(page)).toContain("hideLauncher");
  await page.keyboard.press("Alt+Shift+Space");
  await expect(panel).toHaveAttribute("data-presence", "shown");
};

test.describe("id and email lookup", () => {
  test("finds every table that holds a pasted UUID and opens its rows", async ({
    page,
  }) => {
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill(DEMO_UUID);
    const findRow = page.getByRole("option", { name: /Find 3f2a1b…c91e/ });
    await expect(findRow).toHaveAttribute("aria-selected", "true");
    await searchBox(page).press("Enter");

    await expect(page.getByText(/Found in 3 tables/)).toBeVisible();
    await expect(hitRows(page)).toHaveText([/^users/, /^orders/, /^events/]);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Orders · user_id" })
    ).toBeVisible();
    await expect(page.getByText("Matching rows")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(hitRows(page)).toHaveCount(3);
    await expect(page.getByText(/Found in 3 tables/)).toBeVisible();
    expect(await requestNames(page)).not.toContain("ask");
  });

  test("stops a slow lookup on Esc", async ({ page }) => {
    await seedWorkspace(page);
    await page.goto("/");

    await searchBox(page).fill("slow@example.com");
    await searchBox(page).press("Enter");
    await expect(page.getByText(/Searching 12 tables/)).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByText(/^Stopped/)).toBeVisible();
    expect(await requestNames(page)).toContain("cancelLookup");
  });

  test("offers an email from the clipboard and runs nothing until ↵", async ({
    page,
  }) => {
    await seedWorkspace(page);
    await page.goto("/");
    await enableClipboardLookups(page);

    await setClipboard(page, "ada@example.com");
    await resummon(page);

    const offer = page.getByRole("option", { name: /from your clipboard/ });
    await expect(page.getByText("From clipboard")).toBeVisible();
    await expect(offer).toBeVisible();
    expect(await requestNames(page)).not.toContain("lookup");

    await offer.click();
    await expect(page.getByText(/Found in 2 tables/)).toBeVisible();
    expect(await requestNames(page)).toContain("lookup");
  });

  test("offers nothing for clipboard text that isn't an id or email", async ({
    page,
  }) => {
    await seedWorkspace(page);
    await page.goto("/");
    await enableClipboardLookups(page);

    await setClipboard(page, "hello world");
    await resummon(page);

    await expect(
      page.getByText("Recent").or(page.getByText("Commands")).first()
    ).toBeVisible();
    await expect(page.getByText("From clipboard")).toHaveCount(0);
  });
});
