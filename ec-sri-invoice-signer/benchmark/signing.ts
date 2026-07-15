import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { c14nCanonicalize } from '../src/canonicalization/c14n';
import { signInvoiceXml } from '../src/signature/signature';
import {
  extractPrivateKeyAndCertificateFromPkcs12,
  getHash,
  sign,
} from '../src/utils/cryptography';
import {
  calculateMemoryDelta,
  DurationSummary,
  MemoryDelta,
  summarizeDurations,
} from './statistics';

const sourceFixtureDirectory = path.resolve(__dirname, '../test/test-data');
const compiledFixtureDirectory = path.resolve(__dirname, '../../test/test-data');
const FIXTURE_DIRECTORY = fs.existsSync(sourceFixtureDirectory)
  ? sourceFixtureDirectory
  : compiledFixtureDirectory;
export const DEFAULT_BATCH_SIZES = [100, 1000] as const;
export const DEFAULT_ITERATIONS = 1;
export const DEFAULT_WARMUP_ITERATIONS = 0;

export type BenchmarkOptions = Readonly<{
  batchSizes?: readonly number[];
  iterations?: number;
  warmupIterations?: number;
  output?: 'table' | 'json';
}>;

export type StageBenchmarkResult = Readonly<DurationSummary & {
  millisecondsPerDocument: number;
  documentsPerSecond: number;
}>;

export type BenchmarkReport = Readonly<{
  environment: Readonly<{
    node: string;
    platform: string;
    architecture: string;
  }>;
  gcAvailable: boolean;
  scenarios: readonly Readonly<{
    documentCount: number;
    memory: MemoryDelta;
    stages: Readonly<{
      pkcs12: StageBenchmarkResult;
      canonicalization: StageBenchmarkResult;
      hash: StageBenchmarkResult;
      rsa: StageBenchmarkResult;
      endToEnd: StageBenchmarkResult;
    }>;
  }>[];
}>;

export const loadSigningFixtures = () => ({
  invoiceXml: fs.readFileSync(path.join(FIXTURE_DIRECTORY, 'invoice/original.xml'), 'utf8'),
  pkcs12Data: fs.readFileSync(path.join(FIXTURE_DIRECTORY, 'pkcs12/signature.p12')),
});

export const createFixtureBatch = (invoiceXml: string, count: number): string[] =>
  Array.from({ length: count }, () => invoiceXml);

const measure = <Result>(operation: () => Result) => {
  if (typeof global.gc === 'function') {
    global.gc();
  }

  const beforeMemory = process.memoryUsage();
  const start = performance.now();
  operation();
  const durationMs = performance.now() - start;
  const afterMemory = process.memoryUsage();

  return { durationMs, memory: calculateMemoryDelta(beforeMemory, afterMemory) };
};

const validateBenchmarkOptions = (options: BenchmarkOptions) => {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('options must be a non-null object');
  }

  if (options.batchSizes !== undefined && (
    !Array.isArray(options.batchSizes)
    || options.batchSizes.length === 0
    || options.batchSizes.some((batchSize) => !Number.isSafeInteger(batchSize) || batchSize <= 0)
  )) {
    throw new Error('batchSizes must be a non-empty array of positive safe integers');
  }

  if (options.iterations !== undefined
    && (!Number.isSafeInteger(options.iterations) || options.iterations <= 0)) {
    throw new Error('iterations must be a positive safe integer');
  }

  if (options.warmupIterations !== undefined
    && (!Number.isSafeInteger(options.warmupIterations) || options.warmupIterations < 0)) {
    throw new Error('warmupIterations must be a non-negative safe integer');
  }

  if (options.output !== undefined && options.output !== 'table' && options.output !== 'json') {
    throw new Error("output must be either 'table' or 'json'");
  }
};

export const runSigningBenchmark = (options: BenchmarkOptions = {}): BenchmarkReport => {
  validateBenchmarkOptions(options);
  const fixtures = loadSigningFixtures();
  const batchSizes = options.batchSizes ?? DEFAULT_BATCH_SIZES;
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const warmupIterations = options.warmupIterations ?? DEFAULT_WARMUP_ITERATIONS;
  const scenarios = batchSizes.map((documentCount) => {
    const documents = createFixtureBatch(fixtures.invoiceXml, documentCount);
    const stageSamples = {
      pkcs12: [] as number[],
      canonicalization: [] as number[],
      hash: [] as number[],
      rsa: [] as number[],
      endToEnd: [] as number[],
    };
    let memory: MemoryDelta = { rssBytes: 0, heapUsedBytes: 0 };

    const runScenario = () => {
      const parsed = extractPrivateKeyAndCertificateFromPkcs12(fixtures.pkcs12Data);
      stageSamples.pkcs12.push(measure(() =>
        documents.forEach(() => extractPrivateKeyAndCertificateFromPkcs12(fixtures.pkcs12Data)),
      ).durationMs);
      const canonicalXml = c14nCanonicalize(fixtures.invoiceXml);
      stageSamples.canonicalization.push(measure(() =>
        documents.forEach(() => c14nCanonicalize(fixtures.invoiceXml)),
      ).durationMs);
      stageSamples.hash.push(measure(() =>
        documents.forEach(() => getHash(canonicalXml)),
      ).durationMs);
      stageSamples.rsa.push(measure(() =>
        documents.forEach(() => sign(canonicalXml, parsed.privateKey)),
      ).durationMs);
      const fullMeasurement = measure(() =>
        documents.forEach((document) => signInvoiceXml(document, fixtures.pkcs12Data)),
      );
      stageSamples.endToEnd.push(fullMeasurement.durationMs);
      memory = fullMeasurement.memory;
    };

    for (let index = 0; index < warmupIterations; index += 1) {
      runScenario();
    }
    Object.values(stageSamples).forEach((samples) => samples.splice(0));
    for (let index = 0; index < iterations; index += 1) {
      runScenario();
    }

    const summarize = (samples: number[]): StageBenchmarkResult => {
      const duration = summarizeDurations(samples);
      return {
        ...duration,
        millisecondsPerDocument: duration.medianMs / documentCount,
        documentsPerSecond: documentCount / (duration.medianMs / 1000),
      };
    };

    return {
      documentCount,
      memory,
      stages: {
        pkcs12: summarize(stageSamples.pkcs12),
        canonicalization: summarize(stageSamples.canonicalization),
        hash: summarize(stageSamples.hash),
        rsa: summarize(stageSamples.rsa),
        endToEnd: summarize(stageSamples.endToEnd),
      },
    };
  });

  return {
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    gcAvailable: typeof global.gc === 'function',
    scenarios,
  };
};

const formatNumber = (value: number) => value.toFixed(2);
const formatBytes = (value: number) => `${(value / 1024 / 1024).toFixed(2)} MiB`;

const formatTable = (report: BenchmarkReport) => {
  const rows = report.scenarios.flatMap((scenario) =>
    Object.entries(scenario.stages).map(([stage, result]) => ({
      documents: scenario.documentCount,
      stage,
      'p50 ms': formatNumber(result.medianMs),
      'p95 ms': formatNumber(result.p95Ms),
      'ms/doc': formatNumber(result.millisecondsPerDocument),
      'docs/s': formatNumber(result.documentsPerSecond),
      'RSS delta': formatBytes(scenario.memory.rssBytes),
      'heap delta': formatBytes(scenario.memory.heapUsedBytes),
    })),
  );

  console.table(rows);
};

if (require.main === module) {
  const output = process.argv.includes('--json') ? 'json' : 'table';
  const report = runSigningBenchmark({ output });

  if (!report.gcAvailable) {
    console.error('Warning: run Node.js with --expose-gc to stabilize memory measurements.');
  }

  if (output === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Node ${report.environment.node} on ${report.environment.platform}/${report.environment.architecture}`);
    console.log(`GC disponible: ${report.gcAvailable}`);
    formatTable(report);
  }
}
