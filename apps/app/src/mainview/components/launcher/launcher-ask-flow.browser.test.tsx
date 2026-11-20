import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { AppProviders } from "@/components/app-providers";
import { scriptFor } from "@/lib/browser-ask-stub";
import { REVENUE } from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc } from "@/test/launcher-ipc";

import { LauncherPanel } from "./launcher-panel";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

const setup = () => {
  const asked: { askId: string; prompt: string }[] = [];
  const cancelled: unknown[] = [];
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      ask: (payload) => {
        asked.push(payload as { askId: string; prompt: string });
        return null;
      },
      cancelAsk: (payload) => {
        cancelled.push(payload.askId);
        return null;
      },
      getActiveConnection: () => ({
        connectionId: "analytics",
        database: null,
      }),
      getAiSettings: () => ({
        baseUrl: null,
        hasKey: true,
        keyHint: "abcd",
        model: null,
        provider: "anthropic",
      }),
    },
  });
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );
  return { asked, cancelled };
};

const replay = (askId: string, prompt: string) => {
  for (const [, event] of scriptFor(prompt, "analytics")) {
    emitIpcMessage("askEvent", { askId, event });
  }
};

const firstAskId = (asked: readonly { askId: string }[]): string =>
  asked[0]?.askId ?? "";

const search = () => page.getByRole("combobox", { name: "Search commands" });

describe("asking from the launcher", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("asks from the root, shows the card, and reopens it with ↑ after going back", async () => {
    const { asked } = setup();
    await search().fill(REVENUE);
    await expect
      .element(page.getByRole("option", { name: /Ask analytics/ }))
      .toBeVisible();
    await userEvent.keyboard("{Enter}");

    await expect
      .element(page.getByRole("textbox", { name: "Ask a question" }))
      .toHaveValue(REVENUE);
    await expect.poll(() => asked.length).toBe(1);
    replay(firstAskId(asked), REVENUE);
    await expect
      .element(
        page.getByRole("heading", {
          name: "Monthly recurring revenue by region",
        })
      )
      .toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect.element(search()).toBeVisible();
    await search().fill("");
    await expect.element(page.getByText("Last answer")).toBeVisible();
    await userEvent.keyboard("{ArrowUp}");
    await expect
      .element(
        page.getByRole("heading", {
          name: "Monthly recurring revenue by region",
        })
      )
      .toBeVisible();
    expect(asked).toHaveLength(1);
  });

  it("stops a running ask with Escape instead of leaving", async () => {
    const { asked, cancelled } = setup();
    await search().fill(REVENUE);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => asked.length).toBe(1);

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => cancelled).toStrictEqual([asked[0]?.askId]);
    await expect.element(page.getByRole("status")).toHaveTextContent("Stopped");
    await expect
      .element(page.getByRole("textbox", { name: "Ask a question" }))
      .toBeVisible();
  });
});
