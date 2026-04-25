import { expect, test } from "@playwright/test";

test.describe("add a connection from the empty state", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("om-q:first-connection-seen", "true");
    });
  });

  test("opens the dialog and switches the database type to SQLite", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: /^add connection$/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: /add a connection/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Connection name")).toBeVisible();

    await dialog.getByLabel("Database type").click();
    await page.getByRole("option", { name: /sqlite/i }).click();

    await expect(dialog.getByLabel("File path")).toBeVisible();
  });

  test("persists a saved SQLite connection in localStorage", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /^add connection$/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: /add a connection/i });
    await dialog.getByLabel("Connection name").fill("Local SQLite");

    await dialog.getByLabel("Database type").click();
    await page.getByRole("option", { name: /sqlite/i }).click();

    await dialog.getByLabel("File path").fill("/tmp/e2e-test.db");

    await dialog.getByRole("button", { name: /save connection/i }).click();

    await expect(dialog).toBeHidden({ timeout: 5000 });

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("oh-my-query-connections")
    );
    expect(stored).not.toBeNull();
    expect(stored).toContain("Local SQLite");
    expect(stored).toContain("sqlite");
  });
});
