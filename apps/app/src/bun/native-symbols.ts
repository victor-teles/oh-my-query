import type { Pointer } from "bun:ffi";

import { dlopen, FFIType } from "bun:ffi";

const LIBSYSTEM = "/usr/lib/libSystem.B.dylib";
const RTLD_DEFAULT = -2n;

const libc = dlopen(LIBSYSTEM, {
  dlsym: { args: [FFIType.i64, FFIType.ptr], returns: FFIType.ptr },
});

export const cString = (value: string): Buffer => Buffer.from(`${value}\0`);

// Data symbols (CF constants, objc_msgSend) need their address, which
// bun:ffi's dlopen does not expose.
export const symbolAddress = (name: string): Pointer => {
  const address = libc.symbols.dlsym(RTLD_DEFAULT, cString(name));
  if (!address || typeof address === "bigint") {
    throw new Error(`missing symbol ${name}`);
  }
  return address;
};
