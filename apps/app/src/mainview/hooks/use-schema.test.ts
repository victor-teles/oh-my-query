import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SchemaInfo } from "@/lib/tauri";

import { useSchema } from "@/hooks/use-schema";
import { useSchemaStore } from "@/stores/schema-store";
import { mockTauri } from "@/test/tauri-mock";

const resetSchemaStore = () => {
  useSchemaStore.setState({ byConnection: {} });
};

const sampleSchema: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          columns: [
            {
              dataType: "int4",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "users",
          rowEstimate: null,
        },
      ],
      views: [],
    },
  ],
};

describe("useSchema hook", () => {
  it("does nothing while disconnected", () => {
    resetSchemaStore();
    mockTauri({
      getSchema: () => {
        throw new Error("should not be called");
      },
      listConnectionDatabases: () => {
        throw new Error("should not be called");
      },
    });

    const { result } = renderHook(() => useSchema("conn-1", "id-a", false));
    expect(result.current.databases).toBeNull();
    expect(result.current.schema).toBeNull();
  });

  it("loads databases then the schema once connected", async () => {
    resetSchemaStore();
    mockTauri({
      getSchema: (payload) => {
        expect(payload).toMatchObject({
          connectionId: "conn-1",
          databaseName: "public",
        });
        return sampleSchema;
      },
      listConnectionDatabases: (payload) => {
        expect(payload).toMatchObject({ connectionId: "conn-1" });
        return ["public", "analytics"];
      },
    });

    const { result } = renderHook(() => useSchema("conn-1", "id-a", true));

    await waitFor(() => {
      expect(result.current.schema).not.toBeNull();
    });

    expect(result.current.databases).toStrictEqual(["public", "analytics"]);
    expect(result.current.selectedDatabase).toBe("public");
    expect(result.current.schema?.schemas[0]?.tables[0]?.name).toBe("users");
    expect(result.current.error).toBeNull();
  });

  it("falls back to the first database when public is absent", async () => {
    resetSchemaStore();
    mockTauri({
      getSchema: () => sampleSchema,
      listConnectionDatabases: () => ["alpha", "beta"],
    });

    const { result } = renderHook(() => useSchema("conn-1", "id-a", true));

    await waitFor(() => {
      expect(result.current.selectedDatabase).toBe("alpha");
    });
  });

  it("captures errors from list_connection_databases", async () => {
    resetSchemaStore();
    mockTauri({
      getSchema: () => sampleSchema,
      listConnectionDatabases: () => {
        throw new Error("boom");
      },
    });

    const { result } = renderHook(() => useSchema("conn-1", "id-a", true));

    await waitFor(() => {
      expect(result.current.error).toMatch(/boom/);
    });
    expect(result.current.isLoading).toBeFalsy();
  });

  it("switches database when setSelectedDatabase is called", async () => {
    resetSchemaStore();
    let lastDb = "";
    mockTauri({
      getSchema: (payload) => {
        lastDb = payload.databaseName as string;
        return sampleSchema;
      },
      listConnectionDatabases: () => ["public", "analytics"],
    });

    const { result } = renderHook(() => useSchema("conn-1", "id-a", true));

    await waitFor(() => expect(lastDb).toBe("public"));

    act(() => {
      result.current.setSelectedDatabase("analytics");
    });

    await waitFor(() => expect(lastDb).toBe("analytics"));
    expect(result.current.selectedDatabase).toBe("analytics");
  });

  it("reuses cached schema across remounts without refetching", async () => {
    resetSchemaStore();
    let listCalls = 0;
    let schemaCalls = 0;
    mockTauri({
      getSchema: () => {
        schemaCalls += 1;
        return sampleSchema;
      },
      listConnectionDatabases: () => {
        listCalls += 1;
        return ["public"];
      },
    });

    const first = renderHook(() => useSchema("conn-1", "id-a", true));
    await waitFor(() => expect(first.result.current.schema).not.toBeNull());

    expect(listCalls).toBe(1);
    expect(schemaCalls).toBe(1);

    first.unmount();

    const second = renderHook(() => useSchema("conn-1", "id-a", true));
    await waitFor(() => expect(second.result.current.schema).not.toBeNull());

    expect(listCalls).toBe(1);
    expect(schemaCalls).toBe(1);
    expect(second.result.current.databases).toStrictEqual(["public"]);
  });

  it("skips refetching when isConnected flips from true to false to true", async () => {
    resetSchemaStore();
    let schemaCalls = 0;
    mockTauri({
      getSchema: () => {
        schemaCalls += 1;
        return sampleSchema;
      },
      listConnectionDatabases: () => ["public"],
    });

    const { result, rerender } = renderHook(
      ({ isConnected }: { isConnected: boolean }) =>
        useSchema("conn-1", "id-a", isConnected),
      { initialProps: { isConnected: true } }
    );

    await waitFor(() => expect(result.current.schema).not.toBeNull());
    expect(schemaCalls).toBe(1);

    rerender({ isConnected: false });
    rerender({ isConnected: true });

    await waitFor(() => expect(result.current.schema).not.toBeNull());
    expect(schemaCalls).toBe(1);
  });

  it("refresh() forces a re-fetch of the current schema", async () => {
    resetSchemaStore();
    let schemaCalls = 0;
    mockTauri({
      getSchema: () => {
        schemaCalls += 1;
        return sampleSchema;
      },
      listConnectionDatabases: () => ["public"],
    });

    const { result } = renderHook(() => useSchema("conn-1", "id-a", true));
    await waitFor(() => expect(result.current.schema).not.toBeNull());
    expect(schemaCalls).toBe(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(schemaCalls).toBe(2));
  });

  it("refetches when identityKey changes for the same connectionId", async () => {
    resetSchemaStore();
    const databasesQueue: string[][] = [["alpha"], ["beta"], ["alpha"]];
    let listCalls = 0;
    mockTauri({
      getSchema: () => sampleSchema,
      listConnectionDatabases: () => {
        const databases = databasesQueue[listCalls] as string[];
        listCalls += 1;
        return databases;
      },
    });

    const { result, rerender } = renderHook(
      ({ identityKey }: { identityKey: string }) =>
        useSchema("conn-1", identityKey, true),
      { initialProps: { identityKey: "id-a" } }
    );

    await waitFor(() =>
      expect(result.current.databases).toStrictEqual(["alpha"])
    );
    expect(listCalls).toBe(1);

    rerender({ identityKey: "id-b" });

    await waitFor(() =>
      expect(result.current.databases).toStrictEqual(["beta"])
    );
    expect(listCalls).toBe(2);
  });
});
