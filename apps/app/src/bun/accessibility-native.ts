import { dlopen, FFIType, ptr, read } from "bun:ffi";

import type { AccessibilityProbe } from "./accessibility.ts";

import { symbolAddress } from "./native-symbols.ts";

const APPLICATION_SERVICES =
  "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices";
const CORE_FOUNDATION =
  "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation";
const openLibraries = () => ({
  ax: dlopen(APPLICATION_SERVICES, {
    AXIsProcessTrusted: { args: [], returns: FFIType.bool },
    AXIsProcessTrustedWithOptions: {
      args: [FFIType.ptr],
      returns: FFIType.bool,
    },
  }),
  cf: dlopen(CORE_FOUNDATION, {
    CFDictionaryCreate: {
      args: [
        FFIType.ptr,
        FFIType.ptr,
        FFIType.ptr,
        FFIType.i64,
        FFIType.ptr,
        FFIType.ptr,
      ],
      returns: FFIType.ptr,
    },
    CFRelease: { args: [FFIType.ptr], returns: FFIType.void },
  }),
});

type Libraries = ReturnType<typeof openLibraries>;

// AXIsProcessTrustedWithOptions({ kAXTrustedCheckOptionPrompt: true }) shows
// the system "allow this app to control your computer" prompt.
const promptForTrust = (libraries: Libraries): boolean => {
  const promptKey = read.ptr(symbolAddress("kAXTrustedCheckOptionPrompt"));
  const trueValue = read.ptr(symbolAddress("kCFBooleanTrue"));
  const keys = new BigUint64Array([BigInt(promptKey)]);
  const values = new BigUint64Array([BigInt(trueValue)]);
  const options = libraries.cf.symbols.CFDictionaryCreate(
    null,
    ptr(keys),
    ptr(values),
    1n,
    symbolAddress("kCFTypeDictionaryKeyCallBacks"),
    symbolAddress("kCFTypeDictionaryValueCallBacks")
  );
  try {
    return libraries.ax.symbols.AXIsProcessTrustedWithOptions(options);
  } finally {
    libraries.cf.symbols.CFRelease(options);
  }
};

export const createMacAccessibility = (): AccessibilityProbe | null => {
  if (process.platform !== "darwin") {
    return null;
  }
  try {
    const libraries = openLibraries();
    return {
      isTrusted: () => libraries.ax.symbols.AXIsProcessTrusted(),
      prompt: () => promptForTrust(libraries),
    };
  } catch (error) {
    console.error(`[accessibility] unavailable: ${String(error)}`);
    return null;
  }
};
