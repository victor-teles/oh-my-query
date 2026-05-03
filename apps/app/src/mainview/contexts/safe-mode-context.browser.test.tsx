import { useCallback } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { ConnectionEnvironment, DatabaseType } from "@/lib/connections";

import { SafeModeProvider, useSafeMode } from "@/contexts/safe-mode-context";
import { waitFor } from "@/test/render-hook";

interface ProbeProps {
  sql: string;
  environment?: ConnectionEnvironment;
  connectionType?: DatabaseType;
  connectionName?: string;
  startDisabled?: boolean;
  onResolved: (value: boolean) => void;
}

const Probe = ({
  sql,
  environment,
  connectionType,
  connectionName,
  startDisabled,
  onResolved,
}: ProbeProps) => {
  const { requestConfirmation, toggle, enabled } = useSafeMode();

  if (startDisabled && enabled) {
    toggle();
  }

  const handleClick = useCallback(async () => {
    const result = await requestConfirmation(sql, {
      connectionName,
      connectionType,
      environment,
    });
    onResolved(result);
  }, [
    connectionName,
    connectionType,
    environment,
    onResolved,
    requestConfirmation,
    sql,
  ]);

  return (
    <>
      <button onClick={handleClick} type="button">
        ask
      </button>
      <span>enabled:{enabled ? "on" : "off"}</span>
    </>
  );
};

const renderProbe = (props: Omit<ProbeProps, "onResolved">) => {
  const onResolved = vi.fn();
  const screen = render(
    <SafeModeProvider>
      <Probe {...props} onResolved={onResolved} />
    </SafeModeProvider>
  );
  return { onResolved, screen };
};

describe("safeModeProvider", () => {
  it("resolves true immediately for non-destructive SQL", async () => {
    const { screen, onResolved } = renderProbe({ sql: "SELECT 1" });
    await screen.getByRole("button", { name: "ask" }).click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("resolves true immediately when toggled off and environment is not prod", async () => {
    const { screen, onResolved } = renderProbe({
      sql: "DROP TABLE users",
      startDisabled: true,
    });
    await screen.getByRole("button", { name: "ask" }).click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("prompts and resolves true on confirm for destructive SQL when enabled", async () => {
    const { screen, onResolved } = renderProbe({ sql: "DROP TABLE users" });
    await screen.getByRole("button", { name: "ask" }).click();
    await page.getByRole("button", { name: "Run anyway" }).click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
  });

  it("prompts and resolves false on cancel", async () => {
    const { screen, onResolved } = renderProbe({ sql: "DROP TABLE users" });
    await screen.getByRole("button", { name: "ask" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(false));
  });

  it("prompts on prod even when toggled off", async () => {
    const { screen, onResolved } = renderProbe({
      connectionName: "prod-db",
      environment: "prod",
      sql: "DROP TABLE users",
      startDisabled: true,
    });
    await screen.getByRole("button", { name: "ask" }).click();
    await page.getByLabelText(/Type/).fill("prod-db");
    await page
      .getByRole("button", { name: "I understand — run against prod" })
      .click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
  });

  it("forwards dialect to the classifier (mongodb deleteMany prompts)", async () => {
    const { screen, onResolved } = renderProbe({
      connectionType: "mongodb",
      sql: "db.users.deleteMany({})",
    });
    await screen.getByRole("button", { name: "ask" }).click();
    await page.getByRole("button", { name: "Run anyway" }).click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
  });

  it("does not classify SQL keywords against a mongodb dialect", async () => {
    const { screen, onResolved } = renderProbe({
      connectionType: "mongodb",
      sql: "DROP TABLE users",
    });
    await screen.getByRole("button", { name: "ask" }).click();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
    expect(page.getByRole("dialog").query()).toBeNull();
  });
});
