import type { Completion, CompletionSource } from "@codemirror/autocomplete";
import type { SQLNamespace } from "@codemirror/lang-sql";
import type { SyntaxNode } from "@lezer/common";

import { syntaxTree } from "@codemirror/language";

import type { SchemaInfo } from "@/lib/tauri";

const EXCLUDED_NODES = new Set([
  "QuotedIdentifier",
  "String",
  "LineComment",
  "BlockComment",
  ".",
  "CompositeIdentifier",
]);

const TABLE_CLAUSE_KEYWORDS = new Set(["from", "join"]);

const CLAUSE_BOUNDARY_KEYWORDS = new Set([
  "where",
  "group",
  "having",
  "order",
  "union",
  "intersect",
  "except",
  "limit",
  "offset",
  "fetch",
  "for",
  "on",
  "set",
  "select",
  "into",
  "returning",
  "window",
  "values",
]);

export const schemaInfoToSQLNamespace = (schema: SchemaInfo): SQLNamespace => {
  const namespace: Record<
    string,
    { self: Completion; children: SQLNamespace }
  > = {};

  for (const schemaItem of schema.schemas) {
    const tables: Record<string, { self: Completion; children: SQLNamespace }> =
      {};

    for (const table of schemaItem.tables) {
      tables[table.name] = {
        children: table.columns.map((col) => ({
          detail: col.dataType,
          label: col.name,
          type: "column",
        })),
        self: { label: table.name, type: "table" },
      };
    }

    for (const view of schemaItem.views) {
      tables[view.name] = {
        children: view.columns.map((col) => ({
          detail: col.dataType,
          label: col.name,
          type: "column",
        })),
        self: { label: view.name, type: "view" },
      };
    }

    namespace[schemaItem.name] = {
      children: tables,
      self: { label: schemaItem.name, type: "namespace" },
    };
  }

  return namespace;
};

export const getDefaultSchema = (schema: SchemaInfo): string | undefined => {
  if (schema.schemas.some((s) => s.name === "public")) {
    return "public";
  }

  if (schema.schemas.some((s) => s.name === "main")) {
    return "main";
  }

  if (schema.schemas.length === 1) {
    return schema.schemas[0]?.name;
  }

  return undefined;
};

const buildColumnLookup = (schema: SchemaInfo): Map<string, Completion[]> => {
  const lookup = new Map<string, Completion[]>();

  for (const schemaItem of schema.schemas) {
    for (const table of schemaItem.tables) {
      const cols: Completion[] = table.columns.map((col) => ({
        boost: 1,
        detail: col.dataType,
        label: col.name,
        type: "column",
      }));
      lookup.set(table.name.toLowerCase(), cols);
    }

    for (const view of schemaItem.views) {
      const cols: Completion[] = view.columns.map((col) => ({
        boost: 1,
        detail: col.dataType,
        label: col.name,
        type: "column",
      }));
      lookup.set(view.name.toLowerCase(), cols);
    }
  }

  return lookup;
};

const findStatement = (node: SyntaxNode): SyntaxNode | null => {
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.name === "Statement") {
      return current;
    }
    current = current.parent;
  }
  return null;
};

const getNodeText = (
  node: SyntaxNode,
  doc: { sliceString: (from: number, to: number) => string }
): string => doc.sliceString(node.from, node.to);

const getCurrentClause = (
  stmt: SyntaxNode,
  pos: number,
  doc: { sliceString: (from: number, to: number) => string }
): string | null => {
  let clause: string | null = null;
  let child = stmt.firstChild;

  while (child) {
    if (child.from >= pos) {
      break;
    }

    if (child.name === "Keyword") {
      const text = getNodeText(child, doc).toLowerCase();
      if (
        TABLE_CLAUSE_KEYWORDS.has(text) ||
        CLAUSE_BOUNDARY_KEYWORDS.has(text)
      ) {
        clause = text;
      }
    }

    child = child.nextSibling;
  }

  return clause;
};

const getReferencedTables = (
  stmt: SyntaxNode,
  doc: { sliceString: (from: number, to: number) => string }
): string[] => {
  const tables: string[] = [];
  let child = stmt.firstChild;
  let inTableContext = false;

  while (child) {
    if (child.name === "Keyword") {
      const text = getNodeText(child, doc).toLowerCase();
      if (TABLE_CLAUSE_KEYWORDS.has(text)) {
        inTableContext = true;
      } else if (text !== "as" && CLAUSE_BOUNDARY_KEYWORDS.has(text)) {
        inTableContext = false;
      }
      child = child.nextSibling;
      continue;
    }

    if (!inTableContext) {
      child = child.nextSibling;
      continue;
    }

    if (child.name === "Identifier" || child.name === "QuotedIdentifier") {
      const name = getNodeText(child, doc);
      tables.push(name.replaceAll(/^["'`[\]]+|["'`[\]]+$/g, "").toLowerCase());
      child = child.nextSibling;
      continue;
    }

    if (child.name === "CompositeIdentifier") {
      const last = child.lastChild;
      if (
        last &&
        (last.name === "Identifier" || last.name === "QuotedIdentifier")
      ) {
        const name = getNodeText(last, doc);
        tables.push(
          name.replaceAll(/^["'`[\]]+|["'`[\]]+$/g, "").toLowerCase()
        );
      }
      child = child.nextSibling;
      continue;
    }

    child = child.nextSibling;
    continue;
  }

  return tables;
};

const getColumnsForTables = (
  lookup: Map<string, Completion[]>,
  tables: string[]
): Completion[] => {
  const seen = new Set<string>();
  const result: Completion[] = [];

  for (const table of tables) {
    const cols = lookup.get(table);
    if (cols) {
      for (const col of cols) {
        if (!seen.has(col.label)) {
          seen.add(col.label);
          result.push(col);
        }
      }
    }
  }

  return result;
};

const getAllColumns = (lookup: Map<string, Completion[]>): Completion[] => {
  const seen = new Set<string>();
  const result: Completion[] = [];

  for (const cols of lookup.values()) {
    for (const col of cols) {
      if (!seen.has(col.label)) {
        seen.add(col.label);
        result.push(col);
      }
    }
  }

  return result;
};

export const createTableCompletionSource = (
  schema: SchemaInfo
): CompletionSource => {
  const completions: Completion[] = [];

  for (const schemaItem of schema.schemas) {
    for (const table of schemaItem.tables) {
      completions.push({
        apply: `"${table.name}"`,
        boost: 2,
        label: table.name,
        type: "table",
      });
    }

    for (const view of schemaItem.views) {
      completions.push({
        apply: `"${view.name}"`,
        boost: 2,
        label: view.name,
        type: "view",
      });
    }
  }

  return (context) => {
    const tree = syntaxTree(context.state);
    const node = tree.resolveInner(context.pos, -1);

    if (EXCLUDED_NODES.has(node.name)) {
      return null;
    }

    const word = context.matchBefore(/\w*/);
    if (!word && !context.explicit) {
      return null;
    }

    const from = word?.from ?? context.pos;

    if (from > 0 && context.state.sliceDoc(from - 1, from) === ".") {
      return null;
    }

    const stmt = findStatement(node);
    if (stmt) {
      const clause = getCurrentClause(stmt, context.pos, context.state.doc);
      if (!clause || !TABLE_CLAUSE_KEYWORDS.has(clause)) {
        return null;
      }
    } else {
      const textBefore = context.state.sliceDoc(Math.max(0, from - 100), from);
      if (!/\b(from|join)\s*$/i.test(textBefore)) {
        return null;
      }
    }

    return {
      from,
      options: completions,
      validFor: /^\w*$/,
    };
  };
};

export const createColumnCompletionSource = (
  schema: SchemaInfo
): CompletionSource => {
  const columnsByTable = buildColumnLookup(schema);

  return (context) => {
    const tree = syntaxTree(context.state);
    const node = tree.resolveInner(context.pos, -1);

    if (EXCLUDED_NODES.has(node.name)) {
      return null;
    }

    const stmt = findStatement(node);
    if (!stmt) {
      return null;
    }

    const clause = getCurrentClause(stmt, context.pos, context.state.doc);

    if (clause && TABLE_CLAUSE_KEYWORDS.has(clause)) {
      return null;
    }

    const tables = getReferencedTables(stmt, context.state.doc);
    const completions =
      tables.length > 0
        ? getColumnsForTables(columnsByTable, tables)
        : getAllColumns(columnsByTable);

    if (completions.length === 0) {
      return null;
    }

    const word = context.matchBefore(/\w*/);
    if (!word && !context.explicit) {
      return null;
    }

    return {
      from: word?.from ?? context.pos,
      options: completions,
      validFor: /^\w*$/,
    };
  };
};
