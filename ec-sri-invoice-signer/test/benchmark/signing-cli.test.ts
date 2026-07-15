import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const PROJECT_DIRECTORY = path.resolve(__dirname, '../..');
const STAGE_NAMES = ['pkcs12', 'canonicalization', 'hash', 'rsa', 'endToEnd'];
const COMPILATION_ARGUMENTS = [
  '--ignoreConfig',
  '--outDir', 'dist',
  '--rootDir', '.',
  '--target', 'ES2015',
  '--module', 'commonjs',
  '--lib', 'esnext,dom',
  '--esModuleInterop',
  '--strict',
  '--strictNullChecks',
  '--declaration',
  'benchmark/signing.ts',
];

const MOCK_PRELOAD = `
const Module = require('node:module');
const load = Module._load;
Module._load = (request, parent, isMain) => {
  if (request === '../src/canonicalization/c14n') {
    return { c14nCanonicalize: (xml) => xml };
  }
  if (request === '../src/signature/signature') {
    return { signInvoiceXml: () => '<signed />' };
  }
  if (request === '../src/utils/cryptography') {
    return {
      extractPrivateKeyAndCertificateFromPkcs12: () => ({ privateKey: {} }),
      getHash: () => 'hash',
      sign: () => 'signature',
    };
  }
  return load(request, parent, isMain);
};
`;

describe('signing benchmark CLI', () => {
  it('executes the compiled artifact and emits valid JSON with all stages', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_DIRECTORY, 'package.json'), 'utf8'));
    expect(packageJson.scripts['benchmark:signing'])
      .toBe('npm run build && node --expose-gc dist/benchmark/signing.js');

    // Evita medir criptografia real en la suite; el binario conserva su flujo CLI completo.
    execFileSync('npx', ['tsc', ...COMPILATION_ARGUMENTS], {
      cwd: PROJECT_DIRECTORY,
      stdio: 'pipe',
    });
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'signing-benchmark-cli-'));
    const preloadPath = path.join(temporaryDirectory, 'mock-cryptography.cjs');
    fs.writeFileSync(preloadPath, MOCK_PRELOAD);

    try {
      const output = execFileSync(
        process.execPath,
        ['--expose-gc', '--require', preloadPath, 'dist/benchmark/signing.js', '--json'],
        { cwd: PROJECT_DIRECTORY, encoding: 'utf8' },
      );
      const report = JSON.parse(output);

      expect(report.scenarios.map((scenario: { documentCount: number }) => scenario.documentCount))
        .toEqual([100, 1000]);
      report.scenarios.forEach((scenario: { stages: Record<string, object> }) => {
        expect(Object.keys(scenario.stages)).toEqual(STAGE_NAMES);
      });

      const tableOutput = execFileSync(
        process.execPath,
        ['--expose-gc', '--require', preloadPath, 'dist/benchmark/signing.js'],
        { cwd: PROJECT_DIRECTORY, encoding: 'utf8' },
      );
      expect(tableOutput).toContain('GC disponible: true');
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
