export type DurationSummary = Readonly<{
  minMs: number;
  maxMs: number;
  medianMs: number;
  p95Ms: number;
}>;

export type MemoryDelta = Readonly<{
  rssBytes: number;
  heapUsedBytes: number;
}>;

export const summarizeDurations = (durationsMs: readonly number[]): DurationSummary => {
  if (durationsMs.length === 0) {
    throw new Error('At least one duration sample is required');
  }

  const sorted = [...durationsMs].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;

  return {
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    medianMs,
    p95Ms: sorted[p95Index],
  };
};

export const calculateMemoryDelta = (
  before: NodeJS.MemoryUsage,
  after: NodeJS.MemoryUsage,
): MemoryDelta => ({
  rssBytes: after.rss - before.rss,
  heapUsedBytes: after.heapUsed - before.heapUsed,
});
