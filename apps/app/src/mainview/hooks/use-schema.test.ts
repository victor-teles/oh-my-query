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
      get_schema: () => {
        throw new Error("should not be called");
      },
      list_connection_databases: () => {
        throw new Error("should not be called");
      },
    });

    const { result } = renderHook(() => useSchema("conn-1", false));
    expect(result.current.databases).toBeNull();
    expect(result.current.schema).toBeNull();
  });

  it("loads databases then the schema once connected", async () => {
    resetSchemaStore();
    mockTauri({
      get_schema: (payload) => {
        expect(payload).toMatchObject({
          connectionId: "conn-1",
          databaseName: "public",
        });
        return sampleSchema;
      },
      list_connection_databases: (payload) => {
        expect(payload).toMatchObject({ connectionId: "conn-1" });
        return ["public", "analytics"];
      },
    });

    const { result } = renderHook(() => useSchema("conn-1", true));

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
      get_schema: () => sampleSchema,
      list_connection_databases: () => ["alpha", "beta"],
    });

    const { result } = renderHook(() => useSchema("conn-1", true));

    await waitFor(() => {
      expect(result.current.selectedDatabase).toBe("alpha");
    });
  });

  it("captures errors from list_connection_databases", async () => {
    resetSchemaStore();
    mockTauri({
      get_schema: () => sampleSchema,
      list_connection_databases: () => {
        throw new Error("boom");
      },
    });

    const { result } = renderHook(() => useSchema("conn-1", true));

    await waitFor(() => {
      expect(result.current.error).toMatch(/boom/);
    });
    expect(result.current.isLoading).toBeFalsy();
  });

  it("switches database when setSelectedDatabase is called", async () => {
    resetSchemaStore();
    let lastDb = "";
    mockTauri({
      get_schema: (payload) => {
        lastDb = payload.databaseName as string;
        return sampleSchema;
      },
      list_connection_databases: () => ["public", "analytics"],
    });

    const { result } = renderHook(() => useSchema("conn-1", true));

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
      get_schema: () => {
        schemaCalls += 1;
        return sampleSchema;
      },
      list_connection_databases: () => {
        listCalls += 1;
        return ["public"];
      },
    });

    const first = renderHook(() => useSchema("conn-1", true));
    await waitFor(() => expect(first.result.current.schema).not.toBeNull());

    expect(listCalls).toBe(1);
    expect(schemaCalls).toBe(1);

    first.unmount();

    const second = renderHook(() => useSchema("conn-1", true));
    await waitFor(() => expect(second.result.current.schema).not.toBeNull());

    expect(listCalls).toBe(1);
    expect(schemaCalls).toBe(1);
    expect(second.result.current.databases).toStrictEqual(["public"]);
  });

  it("skips refetching when isConnected flips from true to false to true", async () => {
    resetSchemaStore();
    let schemaCalls = 0;
    mockTauri({
      get_schema: () => {
        schemaCalls += 1;
        return sampleSchema;
      },
      list_connection_databases: () => ["public"],
    });

    const { result, rerender } = renderHook(
      ({ isConnected }: { isConnected: boolean }) =>
        useSchema("conn-1", isConnected),
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
      get_schema: () => {
        schemaCalls += 1;
        return sampleSchema;
      },
      list_connection_databases: () => ["public"],
    });

    const { result } = renderHook(() => useSchema("conn-1", true));
    await waitFor(() => expect(result.current.schema).not.toBeNull());
    expect(schemaCalls).toBe(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(schemaCalls).toBe(2));
  });
});
