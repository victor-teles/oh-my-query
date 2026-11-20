import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const search = (page: Page) =>
  page.getByRole("combobox", { name: "Search commands" });

const addConnection = async (page: Page, name: string) => {
  await search(page).press("Enter");
  await expect(
    page.getByRole("heading", { name: "New Connection" })
  ).toBeVisible();
  await page.getByLabel("Connection name").fill(name);
  await page.getByLabel("Database", { exact: true }).fill("app");
  await page.keyboard.press("Meta+Enter");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(search(page)).toBeVisible();
};

test.describe("connection flow", () => {
  test("adds a connection, makes it active and keeps it across reloads", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("No databases yet")).toBeVisible();

    await addConnection(page, "fixtures");

    const row = page.getByRole("option", { name: /fixtures/ });
    await expect(row).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("PostgreSQL · localhost/app")).toBeVisible();

    await search(page).press("Enter");
    const chip = page.getByRole("img", { name: "Active connection: fixtures" });
    await expect(chip).toBeVisible();

    await page.reload();
    await expect(chip).toBeVisible();
    await expect(page.getByRole("option", { name: /fixtures/ })).toBeVisible();
  });

  test("deletes a connection with the two-step confirmation", async ({
    page,
  }) => {
    await page.goto("/");
    await addConnection(page, "scratch");

    await search(page).press("Meta+k");
    const menu = page.getByRole("menu", { name: "Actions for scratch" });
    await expect(menu).toBeFocused();

    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("menuitem", { name: /Press ↵ again to delete/ })
    ).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("option", { name: /scratch/ })).toHaveCount(0);
    await expect(page.getByText("No databases yet")).toBeVisible();
  });
});
