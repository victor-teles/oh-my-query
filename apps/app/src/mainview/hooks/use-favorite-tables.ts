import { useCallback, useEffect, useState } from "react";

import { getFavoriteTables, saveFavoriteTables } from "@/lib/favorite-tables";

export const useFavoriteTables = (connectionId: string) => {
  const [favoriteTables, setFavoriteTables] = useState<string[]>(() =>
    getFavoriteTables(connectionId)
  );

  useEffect(() => {
    setFavoriteTables(getFavoriteTables(connectionId));
  }, [connectionId]);

  const toggleFavorite = useCallback(
    (tableName: string) => {
      setFavoriteTables((prev) => {
        const next = prev.includes(tableName)
          ? prev.filter((t) => t !== tableName)
          : [...prev, tableName];
        saveFavoriteTables(connectionId, next);
        return next;
      });
    },
    [connectionId]
  );

  const isFavorite = useCallback(
    (tableName: string) => favoriteTables.includes(tableName),
    [favoriteTables]
  );

  return { favoriteTables, isFavorite, toggleFavorite };
};
