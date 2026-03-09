import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    all: args.has('--all'),
  };
};

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' });
  } catch {
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
  const modeMatch = meta.match(/i\/(\S+)\s+w\/(\S+)\s+attr\/(.+)$/);
  if (!modeMatch) return null;
  const [, iMode, wMode, attr] = modeMatch;
  return { iMode, wMode, attr, path };
};

const countLineEndingBytes = (path) => {
  const data = readFileSync(path);
  let crlf = 0;
  let cr = 0;
  let lf = 0;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    if (byte === 13) {
      cr += 1;
      if (i + 1 < data.length && data[i + 1] === 10) {
        crlf += 1;
      }
    } else if (byte === 10) {
      lf += 1;
    }
  }
  return {
    crlf,
    loneCr: cr - crlf,
    loneLf: lf - crlf,
  };
};

const { all } = parseArgs();
const changedFiles = getChangedFiles();
const eolOutput = run('git', ['ls-files', '--eol']);
const parsed = splitLines(eolOutput).map(parseEolLine).filter(Boolean);
const trackedLfPaths = new Set(parsed.filter((entry) => entry.attr.includes('eol=lf')).map((entry) => normalizePath(entry.path)));

const indexLegacyViolations = parsed.filter((entry) => {
  if (!entry.attr.includes('eol=lf')) return false;
  return entry.iMode === 'mixed' || entry.iMode === 'crlf';
});

const pathsToCheck = all
  ? [...trackedLfPaths]
  : [...changedFiles].filter((path) => trackedLfPaths.has(path));

const actionable = [];
for (const path of pathsToCheck) {
  const counts = countLineEndingBytes(path);
  if (counts.crlf > 0 || counts.loneCr > 0) {
    actionable.push({ path, counts });
  }
}

const nonBlocking = all ? [] : indexLegacyViolations.filter((entry) => !changedFiles.has(normalizePath(entry.path)));

if (nonBlocking.length > 0) {
  console.warn(`Found ${nonBlocking.length} pre-existing EOL issue(s) outside changed files (non-blocking):`);
  for (const entry of nonBlocking.slice(0, 20)) {
    console.warn(`- ${entry.path}: index has ${entry.iMode.toUpperCase()} endings`);
  }
  if (nonBlocking.length > 20) {
    console.warn(`...and ${nonBlocking.length - 20} more`);
  }
}

if (actionable.length === 0) {
  console.log(all ? 'No EOL issues found.' : 'No EOL issues found in changed files.');
  process.exit(0);
}

console.error(all ? 'EOL check failed:' : 'EOL check failed for changed files:');
for (const entry of actionable) {
  const issues = [];
  if (entry.counts.crlf > 0) issues.push('contains CRLF');
  if (entry.counts.loneCr > 0) issues.push('contains lone CR');
  console.error(`- ${entry.path}: ${issues.join(', ')}`);
}

console.error('Run `npm run fix:eol` to normalize changed files, or `npm run fix:eol -- --all` for full repo cleanup.');
process.exit(1);
