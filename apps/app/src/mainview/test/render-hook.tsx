import { render } from "vitest-browser-react";

const delay = (ms: number) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

export interface RenderHookResult<TProps, TResult> {
  result: { current: TResult };
  rerender: (...args: [] | [TProps]) => void;
  unmount: () => void;
}

export interface RenderHookOptions<TProps> {
  initialProps?: TProps;
}

export function renderHook<TProps, TResult>(
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- React harness
  callback: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps>
): RenderHookResult<TProps, TResult> {
  const result = { current: undefined as unknown as TResult };
  let currentProps = options?.initialProps as TProps;
  const Harness = ({ hookProps }: { hookProps: TProps }) => {
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- React harness
    result.current = callback(hookProps);
    return null;
  };
  const screen = render(<Harness hookProps={currentProps} />);
  return {
    rerender: (...args: [] | [TProps]) => {
      if (args.length > 0) {
        currentProps = args[0] as TProps;
      }
      screen.rerender(<Harness hookProps={currentProps} />);
    },
    result,
    unmount: () => screen.unmount(),
  };
}

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
}

export async function waitFor(
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- assertion poller
  fn: () => void | Promise<void>,
  { timeout = 1000, interval = 16 }: WaitForOptions = {}
): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- assertion poller
      await fn();
      return;
    } catch (error) {
      lastError = error;
      await delay(interval);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`waitFor timed out: ${String(lastError)}`);
}
