import type { Pointer } from "bun:ffi";

import { dlopen, FFIType, linkSymbols } from "bun:ffi";

import { cString, symbolAddress } from "./native-symbols.ts";

const LIBOBJC = "/usr/lib/libobjc.A.dylib";

// bun:ffi hands back a bigint only for addresses past 2^53, which never
// occur for live Objective-C objects; treat one as unusable.
const asPointer = (value: Pointer | bigint | null): Pointer | null =>
  typeof value === "bigint" ? null : value;

const openRuntime = () => {
  const objc = dlopen(LIBOBJC, {
    objc_getClass: { args: [FFIType.ptr], returns: FFIType.ptr },
    sel_registerName: { args: [FFIType.ptr], returns: FFIType.ptr },
  });
  const msgSend = symbolAddress("objc_msgSend");
  const send = linkSymbols({
    sendObject: {
      args: [FFIType.ptr, FFIType.ptr],
      ptr: msgSend,
      returns: FFIType.ptr,
    },
    sendOnMainThread: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.bool],
      ptr: msgSend,
      returns: FFIType.void,
    },
  });
  const selector = (name: string) =>
    objc.symbols.sel_registerName(cString(name));
  const classNamed = (name: string) =>
    asPointer(objc.symbols.objc_getClass(cString(name)));
  return { classNamed, selector, send };
};

export interface AppActivation {
  hide(): void;
  deactivate(): void;
}

// Electrobun's GlobalShortcut is a global NSEvent monitor, which never sees
// keys while this app stays active. Hiding the app is the documented way to
// give up activation (macOS 14+ ignores activating another app on our behalf);
// deactivating gives it up without hiding open board windows.
export const createAppActivation = (): AppActivation | null => {
  if (process.platform !== "darwin") {
    return null;
  }
  try {
    const { classNamed, selector, send } = openRuntime();
    const appClass = classNamed("NSApplication");
    const app = appClass
      ? asPointer(
          send.symbols.sendObject(appClass, selector("sharedApplication"))
        )
      : null;
    if (!app) {
      return null;
    }
    const performOnMain = selector(
      "performSelectorOnMainThread:withObject:waitUntilDone:"
    );
    const onMain = (name: string) => {
      const target = selector(name);
      return () =>
        send.symbols.sendOnMainThread(app, performOnMain, target, null, false);
    };
    return { deactivate: onMain("deactivate"), hide: onMain("hide:") };
  } catch (error) {
    console.error(`[launcher] cannot change app activation: ${String(error)}`);
    return null;
  }
};
