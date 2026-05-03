import { useCallback } from "react";
import { toast } from "sonner";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { ThemeProvider } from "@/components/theme-provider";

import { Button } from "./button";
import { Toaster } from "./sonner";

const noop = () => {
  // noop
};

function DeleteConnectionDemo() {
  const handleClick = useCallback(() => {
    toast('"Production" deleted', {
      action: { label: "Undo", onClick: noop },
      duration: 5000,
    });
  }, []);
  return (
    <Button onClick={handleClick} variant="outline">
      Delete connection
    </Button>
  );
}

describe("sonner", () => {
  it("connectionDeletedUndo", async () => {
    const screen = render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <DeleteConnectionDemo />
        <Toaster />
      </ThemeProvider>
    );
    await screen.getByRole("button", { name: "Delete connection" }).click();
    expect(page.getByText('"Production" deleted')).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
