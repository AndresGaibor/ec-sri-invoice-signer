import { calculateMemoryDelta, summarizeDurations } from '../../benchmark/statistics';
import { describe, expect, it } from '@jest/globals';

describe('summarizeDurations', () => {
  it('calculates the median and nearest-rank p95 without mutating the source samples', () => {
    const samples = [9, 1, 5, 3, 7];

    expect(summarizeDurations(samples)).toEqual({
      minMs: 1,
      maxMs: 9,
      medianMs: 5,
      p95Ms: 9,
    });
    expect(samples).toEqual([9, 1, 5, 3, 7]);
  });

  it('rejects an empty set of samples', () => {
    expect(() => summarizeDurations([])).toThrow('At least one duration sample is required');
  });
});

describe('calculateMemoryDelta', () => {
  it('returns the RSS and heap changes in bytes', () => {
    expect(calculateMemoryDelta(
      { rss: 100, heapTotal: 80, heapUsed: 60, external: 0, arrayBuffers: 0 },
      { rss: 150, heapTotal: 90, heapUsed: 75, external: 0, arrayBuffers: 0 },
    )).toEqual({ rssBytes: 50, heapUsedBytes: 15 });
  });
});
