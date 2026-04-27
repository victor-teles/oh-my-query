import { Star } from "lucide-react";
import { useMemo } from "react";

import type { SchemaInfo, SchemaItem, TableItem, ViewItem } from "@/lib/tauri";

import { fuzzyMatch } from "@/lib/fuzzy-match";

import { TableNode } from "./table-node";

interface SchemaTreeProps {
  schema: SchemaInfo;
  filter: string;
  favoriteTables: string[];
  onToggleFavorite: (tableName: string) => void;
}

interface ScoredTable {
  item: TableItem | ViewItem;
  isView: boolean;
  matches: number[];
  score: number;
}

const scoreItems = (schema: SchemaItem, query: string): ScoredTable[] => {
  const all: { item: TableItem | ViewItem; isView: boolean }[] = [
    ...schema.tables.map((t) => ({ isView: false, item: t })),
    ...schema.views.map((v) => ({ isView: true, item: v })),
  ];

  return all
    .map(({ item, isView }) => {
      const result = fuzzyMatch(item.name, query);
      if (!result) {
        return null;
      }
      return {
        isView,
        item,
        matches: result.matches,
        score: result.score,
      };
    })
    .filter((v): v is ScoredTable => v !== null)
    .toSorted((a, b) => b.score - a.score);
};

export const SchemaTree = ({
  schema,
  filter,
  favoriteTables,
  onToggleFavorite,
}: SchemaTreeProps) => {
  const [first] = schema.schemas;
  const trimmedFilter = filter.trim();
  const isSearching = trimmedFilter.length > 0;

  const searchResults = useMemo(() => {
    if (!(first && isSearching)) {
      return [];
    }
    return scoreItems(first, trimmedFilter);
  }, [first, isSearching, trimmedFilter]);

  const favoriteSet = useMemo(() => new Set(favoriteTables), [favoriteTables]);

  const favoriteItems = useMemo(() => {
    if (!first || isSearching) {
      return [];
    }
    const byName = new Map<string, TableItem>();
    for (const t of first.tables) {
      byName.set(t.name, t);
    }
    return favoriteTables
      .map((name) => byName.get(name))
      .filter((t): t is TableItem => t !== undefined);
  }, [first, favoriteTables, isSearching]);

  const tableItems = useMemo(() => {
    if (!first || isSearching) {
      return [];
    }
    return first.tables.filter((t) => !favoriteSet.has(t.name));
  }, [first, favoriteSet, isSearching]);

  const viewItems = first && !isSearching ? first.views : [];

  if (!first) {
    return null;
  }

  if (isSearching && searchResults.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
        No matches for &ldquo;{trimmedFilter}&rdquo;
      </div>
    );
  }

  if (
    !isSearching &&
    favoriteItems.length === 0 &&
    tableItems.length === 0 &&
    viewItems.length === 0
  ) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
        No tables or views found
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="px-1 py-1">
        {searchResults.map(({ item, isView, matches }) => (
          <TableNode
            highlightMatches={matches}
            isFavorite={favoriteSet.has(item.name)}
            isView={isView}
            key={`${isView ? "v" : "t"}:${item.name}`}
            onToggleFavorite={onToggleFavorite}
            table={item}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="px-1 py-1">
      {favoriteItems.length > 0 && (
        <>
          <div className="mb-0.5 flex items-center gap-1 px-2 text-section-label">
            <Star className="size-2.5" />
            Favorites ({favoriteItems.length})
          </div>
          {favoriteItems.map((table) => (
            <TableNode
              isFavorite
              key={`fav:${table.name}`}
              onToggleFavorite={onToggleFavorite}
              table={table}
            />
          ))}
        </>
      )}

      {tableItems.length > 0 && (
        <>
          {(favoriteItems.length > 0 || viewItems.length > 0) && (
            <div className="mb-0.5 mt-3 px-2 text-section-label">
              Tables ({tableItems.length})
            </div>
          )}
          {tableItems.map((table) => (
            <TableNode
              isFavorite={false}
              key={`tbl:${table.name}`}
              onToggleFavorite={onToggleFavorite}
              table={table}
            />
          ))}
        </>
      )}

      {viewItems.length > 0 && (
        <>
          <div className="mb-0.5 mt-3 px-2 text-section-label">
            Views ({viewItems.length})
          </div>
          {viewItems.map((view) => (
            <TableNode isView key={`view:${view.name}`} table={view} />
          ))}
        </>
      )}
    </div>
  );
};
