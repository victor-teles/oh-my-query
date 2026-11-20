import { useRef } from "react";
import { expect, vi } from "vitest";
import { page } from "vitest/browser";

import type { AskState } from "@/components/ask/ask-reducer";
import type { AskSession } from "@/components/ask/use-ask";

import { AskView } from "@/components/ask/ask-view";
import { fakeSession } from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

const analytics = makeConnection({ id: "analytics", name: "analytics" });

function Harness({
  session,
  onOpenSettings,
}: {
  session: AskSession;
  onOpenSettings: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div data-testid="ask-harness" style={{ width: 760 }}>
      <AskView
        inputRef={inputRef}
        onAddToBoard={vi.fn()}
        onOpenSettings={onOpenSettings}
        onReviewInputs={vi.fn()}
        onRunWidget={vi.fn()}
        session={session}
      />
    </div>
  );
}

// Renders the ask view over a fixed session state on the analytics connection.
export const renderAskView = async (
  state: AskState,
  overrides: Partial<Omit<AskSession, "state">> = {}
) => {
  const store = mockLauncherIpc({ connections: [analytics] });
  store.active = { connectionId: "analytics", database: null };
  const session = fakeSession(state, overrides);
  const onOpenSettings = vi.fn();
  renderWithConnections(
    <Harness onOpenSettings={onOpenSettings} session={session} />
  );
  // Recharts adds a measuring span to <body>, which makes vitest-browser-react
  // locate the render container by its (changing) text, so query the page.
  const screen = page.getByTestId("ask-harness");
  await expect
    .element(screen.getByRole("img", { name: "Active connection: analytics" }))
    .toBeVisible();
  return { onOpenSettings, screen, session };
};
