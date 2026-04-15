import { describe, expect, it } from "vitest";

import type { RedisKey } from "@/lib/tauri";

import {
  buildNamespaceTree,
  defaultExpansion,
} from "@/components/workspace/redis/namespace";

const mk = (name: string): RedisKey => ({
  kind: "STRING",
  name,
  size: 10,
  sizeUnit: "bytes",
  ttlSecs: null,
});

describe("namespace tree builder", () => {
  it("nests keys by `:` segments", () => {
    const tree = buildNamespaceTree([
      mk("user:1:profile"),
      mk("user:1:orders"),
    ]);
    expect(tree.children).toHaveLength(1);
    const [userNode] = tree.children;
    expect(userNode?.segment).toBe("user");
    expect(userNode?.children).toHaveLength(1);
    expect(userNode?.children[0]?.segment).toBe("1");
    expect(userNode?.children[0]?.children).toHaveLength(2);
  });

  it("tracks recursive key count", () => {
    const tree = buildNamespaceTree([
      mk("user:1:profile"),
      mk("user:1:orders"),
      mk("user:2:profile"),
    ]);
    const [userNode] = tree.children;
    expect(userNode?.totalKeys).toBe(3);
    expect(userNode?.children[0]?.totalKeys).toBe(2);
  });

  it("puts leaf folders last at the same level", () => {
    const tree = buildNamespaceTree([
      mk("zoo"),
      mk("user:1"),
      mk("session:abc"),
    ]);
    const segments = tree.children.map((c) => c.segment);
    expect(segments.indexOf("zoo")).toBeGreaterThan(segments.indexOf("user"));
    expect(segments.indexOf("zoo")).toBeGreaterThan(
      segments.indexOf("session")
    );
  });

  it("handles a hybrid: a key that is also a prefix", () => {
    const tree = buildNamespaceTree([mk("user:1"), mk("user:1:profile")]);
    const [userNode] = tree.children;
    const oneNode = userNode?.children[0];
    expect(oneNode?.key?.name).toBe("user:1");
    expect(oneNode?.children).toHaveLength(1);
    expect(oneNode?.children[0]?.key?.name).toBe("user:1:profile");
  });

  it("stores key at the leaf when there are no sub-keys", () => {
    const tree = buildNamespaceTree([mk("hello")]);
    expect(tree.children[0]?.key?.name).toBe("hello");
    expect(tree.children[0]?.children).toHaveLength(0);
  });
});

describe("namespace default expansion", () => {
  it("auto-expands the first two levels", () => {
    const tree = buildNamespaceTree([
      mk("user:1:profile"),
      mk("user:1:orders"),
      mk("session:abc"),
    ]);
    const expanded = defaultExpansion(tree);
    expect(expanded.has("user")).toBeTruthy();
    expect(expanded.has("user:1")).toBeTruthy();
  });

  it("does not expand beyond maxAutoExpand", () => {
    const tree = buildNamespaceTree([mk("a:b:c:d:e")]);
    const expanded = defaultExpansion(tree, 2);
    expect(expanded.has("a")).toBeTruthy();
    expect(expanded.has("a:b")).toBeTruthy();
    expect(expanded.has("a:b:c")).toBeFalsy();
  });
});
