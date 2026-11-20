import { describe, expect, it } from "vitest";

import type { KeyChord } from "./accelerator";

import { matchesAccelerator } from "./accelerator";

const chord = (code: string, modifiers: Partial<KeyChord> = {}): KeyChord => ({
  altKey: false,
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("matchesAccelerator", () => {
  it("matches the default launcher hotkey by key code", () => {
    expect(
      matchesAccelerator(
        chord("Space", { altKey: true, shiftKey: true }),
        "Option+Shift+Space"
      )
    ).toBeTruthy();
  });

  it("requires the exact modifiers", () => {
    expect(
      matchesAccelerator(chord("Space", { altKey: true }), "Option+Shift+Space")
    ).toBeFalsy();
    expect(
      matchesAccelerator(
        chord("Space", { altKey: true, metaKey: true, shiftKey: true }),
        "Option+Shift+Space"
      )
    ).toBeFalsy();
  });

  it("understands letters, digits and modifier aliases", () => {
    expect(
      matchesAccelerator(chord("KeyK", { metaKey: true }), "CommandOrControl+K")
    ).toBeTruthy();
    expect(
      matchesAccelerator(chord("Digit1", { ctrlKey: true }), "Ctrl+1")
    ).toBeTruthy();
    expect(matchesAccelerator(chord("KeyK"), "")).toBeFalsy();
  });
});
