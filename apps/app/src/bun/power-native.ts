import { dlopen, FFIType } from "bun:ffi";

import type { PowerSource } from "./watch-policy.ts";

const IOKIT = "/System/Library/Frameworks/IOKit.framework/IOKit";
// kIOPSTimeRemainingUnlimited: the Mac is drawing from an external source.
const UNLIMITED = -2;

export const createPowerProbe = (): (() => PowerSource) | null => {
  if (process.platform !== "darwin") {
    return null;
  }
  try {
    const iokit = dlopen(IOKIT, {
      IOPSGetTimeRemainingEstimate: { args: [], returns: FFIType.f64 },
    });
    return () =>
      iokit.symbols.IOPSGetTimeRemainingEstimate() === UNLIMITED
        ? "ac"
        : "battery";
  } catch (error) {
    console.error(`[power] unavailable: ${String(error)}`);
    return null;
  }
};
