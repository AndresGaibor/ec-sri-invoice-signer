import { describe, expect, it } from '@jest/globals';
import {
  BenchmarkOptions,
  createFixtureBatch,
  DEFAULT_BATCH_SIZES,
  DEFAULT_ITERATIONS,
  DEFAULT_WARMUP_ITERATIONS,
  loadSigningFixtures,
  runSigningBenchmark,
} from '../../benchmark/signing';

const runWithRuntimeOptions = (options: unknown) =>
  runSigningBenchmark(options as unknown as BenchmarkOptions);

describe('signing benchmark fixtures', () => {
  it('uses one measurement without warmup by default while retaining both batch sizes', () => {
    expect(DEFAULT_BATCH_SIZES).toEqual([100, 1000]);
    expect(DEFAULT_ITERATIONS).toBe(1);
    expect(DEFAULT_WARMUP_ITERATIONS).toBe(0);
  });

  it('loads the existing invoice and PKCS#12 fixtures', () => {
    const fixtures = loadSigningFixtures();

    expect(fixtures.invoiceXml).toContain('<factura');
    expect(fixtures.pkcs12Data.length).toBeGreaterThan(0);
  });

  it('creates in-memory batches of the requested size', () => {
    expect(createFixtureBatch('<factura />', 3)).toEqual([
      '<factura />',
      '<factura />',
      '<factura />',
    ]);
  });

  it('creates the required benchmark batch sizes without writing output files', () => {
    const fixtures = loadSigningFixtures();

    expect(createFixtureBatch(fixtures.invoiceXml, 100)).toHaveLength(100);
    expect(createFixtureBatch(fixtures.invoiceXml, 1000)).toHaveLength(1000);
  });

  it.each([[0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1]])(
    'rejects an invalid batch size: %p',
    (batchSize) => {
      expect(() => runSigningBenchmark({ batchSizes: [batchSize] }))
        .toThrow('batchSizes must be a non-empty array of positive safe integers');
    },
  );

  it.each([null, '1', {}, [null]])('rejects a runtime-invalid batchSizes value: %p', (batchSizes) => {
    expect(() => runWithRuntimeOptions({ batchSizes }))
      .toThrow('batchSizes must be a non-empty array of positive safe integers');
  });

  it('rejects an empty batchSizes array', () => {
    expect(() => runSigningBenchmark({ batchSizes: [] }))
      .toThrow('batchSizes must be a non-empty array of positive safe integers');
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid iteration count: %p',
    (iterations) => {
      expect(() => runSigningBenchmark({ iterations }))
        .toThrow('iterations must be a positive safe integer');
    },
  );

  it('rejects null iterations', () => {
    expect(() => runWithRuntimeOptions({ iterations: null }))
      .toThrow('iterations must be a positive safe integer');
  });

  it.each(['1', {}, []])('rejects a runtime-invalid iteration count: %p', (iterations) => {
    expect(() => runWithRuntimeOptions({ iterations }))
      .toThrow('iterations must be a positive safe integer');
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid warmup iteration count: %p',
    (warmupIterations) => {
      expect(() => runSigningBenchmark({ warmupIterations }))
        .toThrow('warmupIterations must be a non-negative safe integer');
    },
  );

  it('rejects null warmup iterations', () => {
    expect(() => runWithRuntimeOptions({ warmupIterations: null }))
      .toThrow('warmupIterations must be a non-negative safe integer');
  });

  it.each(['0', {}, []])('rejects runtime-invalid warmup iterations: %p', (warmupIterations) => {
    expect(() => runWithRuntimeOptions({ warmupIterations }))
      .toThrow('warmupIterations must be a non-negative safe integer');
  });

  it.each(['csv', '', 'TABLE'])('rejects an invalid output: %p', (output) => {
    expect(() => runSigningBenchmark({ output: output as 'table' | 'json' }))
      .toThrow("output must be either 'table' or 'json'");
  });

  it('rejects null output', () => {
    expect(() => runWithRuntimeOptions({ output: null }))
      .toThrow("output must be either 'table' or 'json'");
  });

  it.each([{}, []])('rejects a runtime-invalid output: %p', (output) => {
    expect(() => runWithRuntimeOptions({ output }))
      .toThrow("output must be either 'table' or 'json'");
  });

  it.each([null, 'invalid', []])('rejects invalid runtime options: %p', (options) => {
    expect(() => runWithRuntimeOptions(options))
      .toThrow('options must be a non-null object');
  });

  it.each(['table', 'json'] as const)('accepts the valid output: %s', (output) => {
    expect(() => runSigningBenchmark({
      batchSizes: [1],
      iterations: 1,
      warmupIterations: 0,
      output,
    })).not.toThrow();
  });

  it('returns stage results for a minimal executable scenario', () => {
    const report = runSigningBenchmark({
      batchSizes: [1],
      iterations: 1,
      warmupIterations: 0,
      output: 'json',
    });

    expect(report.scenarios.map((scenario) => scenario.documentCount)).toEqual([1]);
    expect(Object.keys(report.scenarios[0].stages)).toEqual([
      'pkcs12',
      'canonicalization',
      'hash',
      'rsa',
      'endToEnd',
    ]);
  });
});
