const COUNT_FORMATTER = new Intl.NumberFormat("en-US");

export const formatCount = (count: number): string =>
  COUNT_FORMATTER.format(count);

export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)} s`;
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)} s`;
  }
  const mins = Math.floor(seconds / 60);
  const rem = Math.floor(seconds % 60);
  return `${mins}m ${rem}s`;
};
