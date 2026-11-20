import { expect, test } from "@playwright/test";

const collectErrors = (page: import("@playwright/test").Page): string[] => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
};

test.describe("launcher boot", () => {
  test("summons the launcher with the search field focused and no console errors", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await expect(search).toBeFocused();
    await expect(search).toHaveAttribute(
      "placeholder",
      "Search or ask… > SQL · # table · @ connection"
    );
    await expect(page.getByRole("option", { name: /Settings/ })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("filters commands and opens settings with Enter", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search commands" });

    await search.fill("sett");
    await expect(page.getByRole("option")).toHaveCount(1);
    await search.press("Enter");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByLabel("⌥ ⇧ Space")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(search).toBeVisible();
  });

  test("dismisses with Escape and returns on the launcher hotkey", async ({
    page,
  }) => {
    await page.goto("/");
    const panel = page.locator("[data-presence]");
    await expect(panel).toHaveAttribute("data-presence", "shown");

    await page.keyboard.press("Escape");
    await expect(panel).toHaveAttribute("data-presence", "hidden");

    await page.keyboard.press("Alt+Shift+Space");
    await expect(panel).toHaveAttribute("data-presence", "shown");
    await expect(
      page.getByRole("combobox", { name: "Search commands" })
    ).toBeFocused();
  });
});
