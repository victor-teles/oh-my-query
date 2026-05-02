import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type {
  IslandSnapshot,
  RunningQueryEntry,
} from "@/contexts/island-context";

import { DynamicIslandContent } from "./dynamic-island-content";

const makeRunner = (
  overrides: Partial<RunningQueryEntry> = {}
): RunningQueryEntry => ({
  connectionColor: undefined,
  connectionEmoji: undefined,
  connectionEnvironment: undefined,
  connectionId: "conn-1",
  connectionLabel: "analytics-db",
  onCancel: vi.fn(),
  startedAt: Date.now() - 2400,
  tabId: "tab-1",
  tabTitle: "Top users",
  ...overrides,
});

const makeRunningSnapshot = (runners: RunningQueryEntry[]): IslandSnapshot => ({
  headlineTabId: runners[0]?.tabId ?? "",
  kind: "query-running",
  onCancelAll: vi.fn(),
  onCancelHeadline: runners[0]?.onCancel ?? vi.fn(),
  runners,
});

const IslandShell = ({ snapshot }: { snapshot: IslandSnapshot }) => (
  <div className="dark flex items-center justify-center p-8">
    <div
      className="
        relative flex h-6 items-center gap-1.5 rounded-full border
        border-border/60 bg-background/85 px-2.5 shadow-sm backdrop-blur-xl
        backdrop-saturate-200
      "
    >
      <DynamicIslandContent snapshot={snapshot} />
    </div>
  </div>
);

describe("dynamic-island", () => {
  it("welcome", async () => {
    const screen = render(<IslandShell snapshot={{ kind: "welcome" }} />);
    await expect.element(screen.getByText("Welcome")).toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("ambient", async () => {
    const screen = render(
      <IslandShell snapshot={{ connectionName: "my-db", kind: "ambient" }} />
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("connecting", async () => {
    const screen = render(
      <IslandShell
        snapshot={{ connectionName: "production-pg", kind: "connecting" }}
      />
    );
    await expect
      .element(screen.getByText(/production-pg/i))
      .toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("reconnecting", async () => {
    const screen = render(
      <IslandShell
        snapshot={{ connectionName: "staging-pg", kind: "reconnecting" }}
      />
    );
    await expect
      .element(screen.getByText(/Reconnecting to staging-pg/i))
      .toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("connectionError", async () => {
    const onReconnect = vi.fn();
    const screen = render(
      <IslandShell
        snapshot={{
          error: "ECONNREFUSED: Connection refused at 127.0.0.1:5432",
          kind: "connection-error",
          onReconnect,
        }}
      />
    );
    await expect
      .element(screen.getByRole("button", { name: /retry/i }))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("connectedIdle", async () => {
    const screen = render(
      <IslandShell
        snapshot={{
          color: "honey",
          connectionName: "analytics-db",
          database: "analytics",
          emoji: "🐝",
          environment: "prod",
          kind: "connected-idle",
          serverVersion: "16.2",
          username: "admin",
        }}
      />
    );
    await expect
      .element(
        screen.getByRole("button", { name: /Connected to analytics-db/i })
      )
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("connectedIdleNoEnv", async () => {
    const screen = render(
      <IslandShell
        snapshot={{
          color: "denim",
          connectionName: "local-dev",
          database: "myapp_dev",
          emoji: undefined,
          environment: undefined,
          kind: "connected-idle",
          serverVersion: null,
          username: "postgres",
        }}
      />
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryRunningSingle", async () => {
    const screen = render(
      <IslandShell
        snapshot={makeRunningSnapshot([
          makeRunner({ startedAt: Date.now() - 4200 }),
        ])}
      />
    );
    await expect.element(screen.getByText("Running")).toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryRunningThree", async () => {
    const screen = render(
      <IslandShell
        snapshot={makeRunningSnapshot([
          makeRunner({
            connectionEnvironment: "prod",
            connectionLabel: "analytics-db",
            startedAt: Date.now() - 12_400,
            tabId: "t1",
            tabTitle: "Top users",
          }),
          makeRunner({
            connectionColor: "denim",
            connectionLabel: "billing-db",
            startedAt: Date.now() - 4500,
            tabId: "t2",
            tabTitle: "Recent invoices",
          }),
          makeRunner({
            connectionColor: "moss",
            connectionEnvironment: "staging",
            connectionLabel: "search-staging",
            startedAt: Date.now() - 1100,
            tabId: "t3",
            tabTitle: "Index rebuild",
          }),
        ])}
      />
    );
    await expect.element(screen.getByText("+2")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryRunningOverflow", async () => {
    const screen = render(
      <IslandShell
        snapshot={makeRunningSnapshot(
          Array.from({ length: 6 }, (_, i) =>
            makeRunner({
              connectionLabel: `db-${i + 1}`,
              startedAt: Date.now() - (i + 1) * 2300,
              tabId: `t${i + 1}`,
              tabTitle: `Long-running query ${i + 1}`,
            })
          )
        )}
      />
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryRunningReducedMotion", async () => {
    const screen = render(
      <MotionConfig reducedMotion="always">
        <IslandShell
          snapshot={makeRunningSnapshot([
            makeRunner({ startedAt: Date.now() - 3300, tabId: "t1" }),
            makeRunner({ startedAt: Date.now() - 1100, tabId: "t2" }),
          ])}
        />
      </MotionConfig>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryStreaming", async () => {
    const screen = render(
      <IslandShell
        snapshot={{ kind: "query-streaming", tokensReceived: 128 }}
      />
    );
    await expect
      .element(screen.getByText("Streaming", { exact: true }))
      .toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryStreamingStart", async () => {
    const screen = render(
      <IslandShell snapshot={{ kind: "query-streaming", tokensReceived: 0 }} />
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryPlanning", async () => {
    const screen = render(
      <IslandShell snapshot={{ kind: "query-planning" }} />
    );
    await expect.element(screen.getByText("Planning…")).toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryCancelled", async () => {
    const screen = render(
      <IslandShell snapshot={{ kind: "query-cancelled" }} />
    );
    await expect
      .element(screen.getByText("Cancelled", { exact: true }))
      .toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("querySuccess", async () => {
    const screen = render(
      <IslandShell
        snapshot={{
          executionTimeMs: 142,
          kind: "query-success",
          rowCount: 2847,
        }}
      />
    );
    await expect
      .element(screen.getByText("2847", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("142ms", { exact: true }))
      .toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("querySuccessSlow", async () => {
    const screen = render(
      <IslandShell
        snapshot={{ executionTimeMs: 3200, kind: "query-success", rowCount: 1 }}
      />
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("queryError", async () => {
    const screen = render(
      <IslandShell
        snapshot={{
          error:
            'ERROR: column "user_idz" does not exist at character 8 (SQLSTATE 42703)',
          kind: "query-error",
        }}
      />
    );
    await expect.element(screen.getByText("Query failed:")).toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("allStates", async () => {
    const onReconnect = vi.fn();
    const onCancelStreaming = vi.fn();
    const onCancelPlanning = vi.fn();
    const snapshots: IslandSnapshot[] = [
      { kind: "welcome" },
      { connectionName: "local-dev", kind: "ambient" },
      { connectionName: "production-pg", kind: "connecting" },
      { connectionName: "staging-pg", kind: "reconnecting" },
      {
        error: "ECONNREFUSED at 127.0.0.1:5432",
        kind: "connection-error",
        onReconnect,
      },
      {
        color: "honey",
        connectionName: "analytics-db",
        database: "analytics",
        emoji: "🐝",
        environment: "prod",
        kind: "connected-idle",
        serverVersion: "16.2",
        username: "admin",
      },
      makeRunningSnapshot([makeRunner({ startedAt: Date.now() - 2400 })]),
      {
        kind: "query-streaming",
        onCancel: onCancelStreaming,
        tokensReceived: 128,
      },
      { kind: "query-planning", onCancel: onCancelPlanning },
      { kind: "query-cancelled" },
      { executionTimeMs: 142, kind: "query-success", rowCount: 2847 },
      {
        error: 'column "user_idz" does not exist',
        kind: "query-error",
      },
    ];
    const screen = render(
      <div className="dark flex flex-col gap-3">
        {snapshots.map((snapshot) => (
          <div className="flex items-center gap-4" key={snapshot.kind}>
            <span
              className="
                text-data w-36 text-right text-[10px] text-muted-foreground/50
              "
            >
              {snapshot.kind}
            </span>
            <div
              className="
                flex h-6 items-center gap-1.5 rounded-full border border-border/60
                bg-background/85 px-2.5 shadow-sm backdrop-blur-xl
                backdrop-saturate-200
              "
            >
              <DynamicIslandContent snapshot={snapshot} />
            </div>
          </div>
        ))}
      </div>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });
});
