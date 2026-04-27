import { expect, test } from "@playwright/test";

test.describe("app boot", () => {
  test("renders the welcome state on first run with no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Welcome to oh-my-query" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /add your first connection/i })
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("shows the empty-list state once the welcome glow has been seen", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("om-q:first-connection-seen", "true");
    });

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /no connections yet/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^add connection$/i })
    ).toBeVisible();
  });
});
