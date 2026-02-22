
import fs from 'fs';
import path from 'path';

const SPEC_PATH = path.resolve(process.cwd(), 'src/scripts/power-reader/SPEC.md');
const REPORT_PATH = path.resolve(process.cwd(), 'last-test-report.json');

function main() {
    if (!fs.existsSync(SPEC_PATH)) {
        console.error(`Spec file not found at ${SPEC_PATH}`);
        process.exit(1);
    }
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`Report file not found at ${REPORT_PATH}. Run tests first.`);
        process.exit(1);
    }

    const specContent = fs.readFileSync(SPEC_PATH, 'utf8');
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

    // 1. Extract all requirement IDs from SPEC (supports dotted IDs like [PR-FOO-01.1])
    const idRegex = /\[PR-[A-Z]+-[0-9]+(?:\.[0-9]+)?\]/g;
    const allSpecIds = new Set<string>();
    const specLines = specContent.split(/\r?\n/);
    for (const line of specLines) {
        const matches = line.match(idRegex);
        if (!matches) continue;
        matches.forEach(id => allSpecIds.add(id));
    }
    const allIds = Array.from(allSpecIds);

    console.log(`
📊 Power Reader Coverage Audit`);
    console.log(`===============================`);
    console.log(`Total Requirements found in SPEC: ${allIds.length}`);
    // 2. Extract results from report
    // We need to traverse the suite tree in the JSON report
    const testResults = new Map<string, 'passed' | 'failed' | 'skipped'>();
    const idsInTests = new Set<string>();

    type RequirementStatus = 'passed' | 'failed' | 'skipped';
    function mergeStatus(existing: RequirementStatus | undefined, incoming: RequirementStatus): RequirementStatus {
        if (existing === 'failed' || incoming === 'failed') return 'failed';
        if (existing === 'passed' || incoming === 'passed') return 'passed';
        return 'skipped';
    }

    function getSpecStatus(spec: any): RequirementStatus {
        const rawStatuses: string[] = [];
        if (Array.isArray(spec.tests)) {
            spec.tests.forEach((testEntry: any) => {
                if (Array.isArray(testEntry.results)) {
                    testEntry.results.forEach((result: any) => {
                        if (typeof result?.status === 'string') {
                            rawStatuses.push(result.status);
                        }
                    });
                }
            });
        }

        if (rawStatuses.length === 0) {
            return spec.ok ? 'passed' : 'failed';
        }
        if (rawStatuses.some(s => ['failed', 'timedOut', 'interrupted'].includes(s))) {
            return 'failed';
        }
        if (rawStatuses.some(s => s === 'passed')) {
            return 'passed';
        }
        return 'skipped';
    }

    function processSuite(suite: any, parentTitle: string = '') {
        const fullSuiteTitle = parentTitle ? `${parentTitle} ${suite.title}` : suite.title;

        if (suite.specs) {
            suite.specs.forEach((spec: any) => {
                const title = `${fullSuiteTitle} ${spec.title}`;
                const status = getSpecStatus(spec);
                // Find all IDs in this combined title
                const matches = title.match(idRegex);
                if (matches) {
                    matches.forEach((id: string) => {
                        idsInTests.add(id);
                        const current = testResults.get(id);
                        testResults.set(id, mergeStatus(current, status));
                    });
                }
            });
        }
        if (suite.suites) {
            suite.suites.forEach((s: any) => processSuite(s, fullSuiteTitle));
        }
    }

    report.suites.forEach((s: any) => processSuite(s));

    // 2b. Scan test logs for any mentioned IDs (even if not in test title)
    const logDir = path.resolve(process.cwd(), 'test_logs');
    if (fs.existsSync(logDir)) {
        const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log')).sort().reverse();
        // Scan only the latest run log to avoid stale IDs from prior runs.
        const latestLog = logFiles[0];
        if (latestLog) {
            const content = fs.readFileSync(path.join(logDir, latestLog), 'utf8');
            const matches = content.match(idRegex);
            if (matches) {
                matches.forEach(id => idsInTests.add(id));
            }
        }
    }

    // 3. Generate Report
    const covered = allIds.filter(id => testResults.has(id));
    const missing = allIds.filter(id => !testResults.has(id));
    const passing = covered.filter(id => testResults.get(id) === 'passed');
    const failing = covered.filter(id => testResults.get(id) === 'failed');
    const skipped = covered.filter(id => testResults.get(id) === 'skipped');
    const orphans = Array.from(idsInTests).filter(id => !allIds.includes(id));

    if (failing.length > 0) {
        console.log(`
❌ FAILING REQUIREMENTS:`);
        failing.forEach(id => console.log(`  - ${id}`));
    }

    if (missing.length > 0) {
        console.log(`
⚠️  MISSING COVERAGE:`);
        missing.forEach(id => console.log(`  - ${id}`));
    }

    if (skipped.length > 0) {
        console.log(`
⏭️  SKIPPED REQUIREMENTS:`);
        skipped.forEach(id => console.log(`  - ${id}`));
    }

    if (orphans.length > 0) {
        console.log(`
🚨 ORPHAN TAGS (Found in tests but NOT in SPEC):`);
        orphans.forEach(id => console.log(`  - ${id}`));
    }

    console.log(`
-------------------------------`);
    console.log(`Requirements with test coverage: ${covered.length} (${Math.round(covered.length / allIds.length * 100)}%)`);
    console.log(`Total unique IDs found in tests: ${idsInTests.size}`);
    console.log(`  ✅ Passing: ${passing.length}`);
    console.log(`  ❌ Failing: ${failing.length}`);
    console.log(`  ⏭️  Skipped: ${skipped.length}`);
    console.log(`  ⚠️  Missing: ${missing.length}`);
    console.log(`===============================
`);

    if (failing.length > 0 || missing.length > 0 || skipped.length > 0) {
        process.exit(1);
    }
}

main();
