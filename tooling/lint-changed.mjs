import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const JS_TS_EXT_RE = /\.(?:[cm]?js|ts|tsx)$/i;
const IGNORED_PREFIXES = [
  'dist/',
  'node_modules/',
  'historical/',
  'src/generated/',
  'playwright-report/',
  'test-results/',
  'archive/',
  'tests/fixtures/',
];

const splitLines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const runListCommand = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' });
  } catch {
    return '';
  }
};

const getChangedFiles = () => {
  const jjOutput = runListCommand('jj', ['--no-pager', 'diff', '--name-only']);
  const gitOutput = jjOutput ? '' : runListCommand('git', ['diff', '--name-only']);
  const raw = jjOutput || gitOutput;
  return splitLines(raw);
};

const normalizePathForMatch = (file) => file.replace(/\\/g, '/');

const shouldLint = (file) => {
  const normalized = normalizePathForMatch(file);
  if (!JS_TS_EXT_RE.test(normalized)) return false;
  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return existsSync(file);
};

const changedFiles = getChangedFiles().filter(shouldLint);

if (changedFiles.length === 0) {
  console.log('No changed JS/TS files to lint.');
  process.exit(0);
}

console.log(`Linting ${changedFiles.length} changed file(s)...`);

const eslintBin = join('node_modules', 'eslint', 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [eslintBin, '--no-warn-ignored', ...changedFiles], { stdio: 'inherit' });

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
