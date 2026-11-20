import { migrateLegacyAppDir } from "@conch/core";

export const migrateAppData = async (): Promise<void> => {
  try {
    await migrateLegacyAppDir();
  } catch (error) {
    console.error("[app-data] could not move the legacy data folder", error);
  }
};
