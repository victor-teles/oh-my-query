export interface AccessibilityProbe {
  isTrusted(): boolean;
  prompt(): boolean;
}

export const TRUST_POLL_MS = 2000;
export const TRUST_WAIT_MS = 15 * 60 * 1000;

// Electrobun's GlobalShortcut is an NSEvent global monitor, which macOS only
// feeds key events once the app is trusted for Accessibility.
const noop = (): void => {
  // already trusted: nothing to cancel
};

export const requireAccessibility = (
  probe: AccessibilityProbe,
  onTrusted: () => void
): (() => void) => {
  if (probe.isTrusted()) {
    return noop;
  }
  console.log("[accessibility] not trusted; asking for permission");
  probe.prompt();
  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (probe.isTrusted()) {
      clearInterval(timer);
      console.log("[accessibility] granted");
      onTrusted();
    } else if (Date.now() - startedAt > TRUST_WAIT_MS) {
      clearInterval(timer);
    }
  }, TRUST_POLL_MS);
  return () => clearInterval(timer);
};
