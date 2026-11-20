import type { LookupEventMessage } from "@oh-my-query/rpc";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createClipboardEmulator,
  createLookupEmulator,
  DEMO_LOOKUP_UUID,
  lookupScriptFor,
  matchRecordingFor,
} from "./browser-lookup-stub";

const UUID = { kind: "uuid", value: DEMO_LOOKUP_UUID } as const;

const hitTables = (value: Parameters<typeof lookupScriptFor>[0]) =>
  lookupScriptFor(value)
    .map(([, event]) => event)
    .flatMap((event) => (event.type === "hit" ? [event.hit.table] : []));

describe("lookupScriptFor", () => {
  it.each([
    [UUID, ["users", "orders", "events"]],
    [{ kind: "email", value: "ada@example.com" }, ["users", "invoices"]],
    [{ kind: "integer", value: "42" }, ["orders"]],
    [{ kind: "integer", value: "7" }, []],
  ] as const)("streams the demo hits for %o", (value, tables) => {
    expect(hitTables(value)).toStrictEqual(tables);
  });

  it("plans first, reports progress for every probe and ends with done", () => {
    const events = lookupScriptFor(UUID).map(([, event]) => event);
    expect(events[0]).toMatchObject({ probes: 14, type: "planned" });
    expect(events.filter((event) => event.type === "progress")).toHaveLength(
      14
    );
    expect(events.at(-1)).toMatchObject({
      budgetExceeded: false,
      type: "done",
    });
  });
});

describe("matchRecordingFor", () => {
  it("returns the hit's rows, capped at 50, with marker SQL", () => {
    const recording = matchRecordingFor({
      column: "actor_id",
      kind: "match",
      schema: "public",
      table: "events",
      value: UUID,
    });
    expect(recording.rows).toHaveLength(50);
    expect(recording.sql).toBe(
      'SELECT * FROM "public"."events" WHERE "actor_id" = $1 LIMIT 50'
    );
    expect(recording.sql).not.toContain(DEMO_LOOKUP_UUID);
    expect(recording.title).toBe("events · actor_id");
  });
});

describe("createLookupEmulator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the script and stops on cancel", () => {
    const sent: LookupEventMessage[] = [];
    const emulator = createLookupEmulator((message) => sent.push(message));
    const request = {
      connectionId: "db",
      database: null,
      lookupId: "l1",
      value: UUID,
    };
    emulator.lookup(request);
    vi.advanceTimersByTime(100);
    emulator.cancel("l1");
    vi.advanceTimersByTime(5000);
    expect(sent.map((message) => message.event.type)).toStrictEqual([
      "planned",
      "error",
    ]);
    emulator.cancel("l1");
    expect(sent).toHaveLength(2);
  });
});

describe("createClipboardEmulator", () => {
  it("offers a classified value only when enabled", () => {
    const setting = { enabled: true };
    const clipboard = createClipboardEmulator(() => setting.enabled);
    const setClipboard = (
      globalThis as unknown as {
        __omqSetClipboard: (text: string) => void;
      }
    ).__omqSetClipboard;
    setClipboard(" ada@example.com ");
    expect(clipboard.offer()).toStrictEqual({
      kind: "email",
      value: "ada@example.com",
    });
    setting.enabled = false;
    expect(clipboard.offer()).toBeNull();
  });
});
