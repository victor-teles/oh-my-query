import type { RefObject } from "react";

import { useCallback, useRef } from "react";

import type { AskSave } from "@/components/widgets/use-ask-save";

// The panel's inputRef is shared with the root input, which clears it when it
// finishes exiting; refocusing after naming or a menu needs this view's field.
export const useAskInputFocus = (
  inputRef: RefObject<HTMLInputElement | null>,
  saving: AskSave
) => {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const attachField = useCallback(
    (element: HTMLInputElement | null) => {
      fieldRef.current = element;
      inputRef.current = element;
    },
    [inputRef]
  );
  const focusInput = useCallback(() => fieldRef.current?.focus(), []);
  const { cancelNaming, confirmName: saveNamed } = saving;
  const closeNaming = useCallback(() => {
    cancelNaming();
    focusInput();
  }, [cancelNaming, focusInput]);
  const confirmName = useCallback(
    (widgetName: string) => {
      saveNamed(widgetName);
      focusInput();
    },
    [focusInput, saveNamed]
  );
  return { attachField, closeNaming, confirmName, fieldRef, focusInput };
};
