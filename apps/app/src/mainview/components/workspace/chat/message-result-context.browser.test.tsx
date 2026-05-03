import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { ExecuteResult } from "@/lib/tauri";

import {
  MessageResultProvider,
  useOptionalMessageResult,
} from "./message-result-context";

const fakeResult = (rowCount: number): ExecuteResult => ({
  columns: [{ name: "n", typeName: "int" }],
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount,
  rows: Array.from({ length: rowCount }, (_, i) => [i]),
});

type Api = NonNullable<ReturnType<typeof useOptionalMessageResult>>;

const captured: { api: Api | null } = { api: null };

const captureApi = (api: ReturnType<typeof useOptionalMessageResult>) => {
  captured.api = api;
};

const getApi = (): Api | null => captured.api;

const Probe = () => {
  const api = useOptionalMessageResult();
  captureApi(api);
  return (
    <div>
      <span data-testid="rows">
        {api?.result && api.result.resultType === "tabular"
          ? String(api.result.rowCount)
          : "none"}
      </span>
      <span data-testid="source">{api?.record?.source ?? "none"}</span>
    </div>
  );
};

describe("messageResultProvider", () => {
  it("returns null outside the provider", () => {
    captured.api = null;
    render(<Probe />);
    expect(captured.api).toBeNull();
  });

  it("publishes a result and exposes it via the hook", async () => {
    captured.api = null;
    const screen = render(
      <MessageResultProvider>
        <Probe />
      </MessageResultProvider>
    );

    expect(screen.getByTestId("rows").element().textContent).toBe("none");
    expect(screen.getByTestId("source").element().textContent).toBe("none");

    getApi()?.publish(fakeResult(4), "auto");

    await expect.element(screen.getByTestId("rows")).toHaveTextContent("4");
    await expect
      .element(screen.getByTestId("source"))
      .toHaveTextContent("auto");
  });

  it("clears the published result", async () => {
    captured.api = null;
    const screen = render(
      <MessageResultProvider>
        <Probe />
      </MessageResultProvider>
    );

    getApi()?.publish(fakeResult(2), "manual");
    await expect.element(screen.getByTestId("rows")).toHaveTextContent("2");

    getApi()?.clear();
    await expect.element(screen.getByTestId("rows")).toHaveTextContent("none");
  });
});
