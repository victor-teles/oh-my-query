import type { LookupValue } from "@conch/core/client";

export interface SummonPayload {
  clipboard: LookupValue | null;
}

// A clipboard problem must never keep the launcher from showing.
export const summonPayload = (
  offer: () => LookupValue | null
): SummonPayload => {
  try {
    return { clipboard: offer() };
  } catch (error) {
    console.error(`[launcher] clipboard offer failed: ${String(error)}`);
    return { clipboard: null };
  }
};
