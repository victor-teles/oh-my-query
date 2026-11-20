import type { Pointer } from "bun:ffi";

import { CString, dlopen, FFIType, linkSymbols } from "bun:ffi";

import { cString, symbolAddress } from "./native-symbols.ts";

const LIBOBJC = "/usr/lib/libobjc.A.dylib";
const APPKIT = "/System/Library/Frameworks/AppKit.framework/AppKit";

const asPointer = (value: Pointer | bigint | null): Pointer | null =>
  typeof value === "bigint" ? null : value;

const openRuntime = () => {
  dlopen(APPKIT, { NSApplicationLoad: { args: [], returns: FFIType.bool } });
  const objc = dlopen(LIBOBJC, {
    objc_autoreleasePoolPop: { args: [FFIType.ptr], returns: FFIType.void },
    objc_autoreleasePoolPush: { args: [], returns: FFIType.ptr },
    objc_getClass: { args: [FFIType.ptr], returns: FFIType.ptr },
    sel_registerName: { args: [FFIType.ptr], returns: FFIType.ptr },
  });
  const msgSend = symbolAddress("objc_msgSend");
  const send = linkSymbols({
    sendCount: {
      args: [FFIType.ptr, FFIType.ptr],
      ptr: msgSend,
      returns: FFIType.u64,
    },
    sendIndex: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
      ptr: msgSend,
      returns: FFIType.ptr,
    },
    sendObject: {
      args: [FFIType.ptr, FFIType.ptr],
      ptr: msgSend,
      returns: FFIType.ptr,
    },
    sendWithObject: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],
      ptr: msgSend,
      returns: FFIType.ptr,
    },
  });
  const selector = (name: string) =>
    objc.symbols.sel_registerName(cString(name));
  const classNamed = (name: string) =>
    asPointer(objc.symbols.objc_getClass(cString(name)));
  return { classNamed, objc, selector, send: send.symbols };
};

type Runtime = ReturnType<typeof openRuntime>;

const nsString = (runtime: Runtime, text: string): Pointer | null => {
  const stringClass = runtime.classNamed("NSString");
  return stringClass
    ? asPointer(
        runtime.send.sendWithObject(
          stringClass,
          runtime.selector("stringWithUTF8String:"),
          cString(text)
        )
      )
    : null;
};

const pasteboardOf = (
  runtime: Runtime,
  name: string | null
): Pointer | null => {
  const pasteboardClass = runtime.classNamed("NSPasteboard");
  if (!pasteboardClass) {
    return null;
  }
  if (name === null) {
    return asPointer(
      runtime.send.sendObject(
        pasteboardClass,
        runtime.selector("generalPasteboard")
      )
    );
  }
  const nsName = nsString(runtime, name);
  return nsName
    ? asPointer(
        runtime.send.sendWithObject(
          pasteboardClass,
          runtime.selector("pasteboardWithName:"),
          nsName
        )
      )
    : null;
};

const typesOf = (runtime: Runtime, pasteboard: Pointer): string[] => {
  const { send, selector } = runtime;
  const types = asPointer(send.sendObject(pasteboard, selector("types")));
  if (!types) {
    return [];
  }
  const count = Number(send.sendCount(types, selector("count")));
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const type = asPointer(
      send.sendIndex(types, selector("objectAtIndex:"), index)
    );
    const utf8 = type
      ? asPointer(send.sendObject(type, selector("UTF8String")))
      : null;
    if (utf8) {
      names.push(new CString(utf8).toString());
    }
  }
  return names;
};

// Electrobun's clipboardAvailableFormats collapses the pasteboard to
// "text"/"image"/"files"/"html", which hides the concealed-item markers, so
// the real NSPasteboard types are read here. null means "unknown".
export const createPasteboardTypes = (
  pasteboardName: string | null = null
): (() => string[] | null) => {
  if (process.platform !== "darwin") {
    return () => null;
  }
  let runtime: Runtime;
  try {
    runtime = openRuntime();
  } catch (error) {
    console.error(`[clipboard] pasteboard types unavailable: ${String(error)}`);
    return () => null;
  }
  return () => {
    const pool = runtime.objc.symbols.objc_autoreleasePoolPush();
    try {
      const pasteboard = pasteboardOf(runtime, pasteboardName);
      return pasteboard ? typesOf(runtime, pasteboard) : null;
    } catch (error) {
      console.error(
        `[clipboard] could not read pasteboard types: ${String(error)}`
      );
      return null;
    } finally {
      runtime.objc.symbols.objc_autoreleasePoolPop(pool);
    }
  };
};
