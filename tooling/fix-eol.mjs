import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    all: args.has('--all'),
  };
};

const run = (cmd, args, { required = false } = {}) => {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    if (required) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to run "${cmd} ${args.join(' ')}": ${message}`);
      process.exit(2);
    }
    return '';
  }
};

const splitLines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const normalizePath = (file) => file.replace(/\\/g, '/');

const getChangedFiles = () => {
  const jjOutput = run('jj', ['--no-pager', 'diff', '--name-only']);
  const gitOutput = jjOutput ? '' : run('git', ['diff', '--name-only']);
  const changed = splitLines(jjOutput || gitOutput);
  return new Set(changed.map(normalizePath));
};

const parseEolLine = (line) => {
  const tabIndex = line.indexOf('\t');
  if (tabIndex === -1) return null;
  const meta = line.slice(0, tabIndex);
  const path = line.slice(tabIndex + 1);
  const modeMatch = meta.match(/i\/(\S+)\s+w\/(\S+)\s+attr\/(.*)$/);
  if (!modeMatch) return null;
  const [, iMode, wMode, attr] = modeMatch;
  return { iMode, wMode, attr, path };
};

const normalizeLf = (buffer) => {
  const hasUtf8Bom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const body = hasUtf8Bom ? buffer.slice(3).toString('utf8') : buffer.toString('utf8');
  const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalizedBody = Buffer.from(normalized, 'utf8');
  return hasUtf8Bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), normalizedBody]) : normalizedBody;
};

const isLikelyBinary = (buffer) => buffer.includes(0);

const { all } = parseArgs();
const changedFiles = getChangedFiles();
const eolOutput = run('git', ['ls-files', '--eol'], { required: true });
const parsed = splitLines(eolOutput).map(parseEolLine).filter(Boolean);
const trackedLfPaths = new Set(parsed.filter((entry) => entry.attr.includes('eol=lf')).map((entry) => normalizePath(entry.path)));

const candidates = all
  ? parsed.filter((entry) => entry.attr.includes('eol=lf'))
  : parsed.filter((entry) => trackedLfPaths.has(normalizePath(entry.path)) && changedFiles.has(normalizePath(entry.path)));

if (candidates.length === 0) {
  console.log(all ? 'No EOL fixes needed.' : 'No EOL fixes needed for changed files.');
  process.exit(0);
}

let changedCount = 0;
for (const entry of candidates) {
  if (!existsSync(entry.path)) continue;
  const original = readFileSync(entry.path);
  if (isLikelyBinary(original)) {
    console.warn(`Skipping binary-like file: ${entry.path}`);
    continue;
  }
  const normalized = normalizeLf(original);
  if (Buffer.compare(original, normalized) === 0) continue;
  writeFileSync(entry.path, normalized);
  changedCount += 1;
  console.log(`Normalized line endings: ${entry.path}`);
}

console.log(`EOL normalization complete. Updated ${changedCount} file(s).`);
