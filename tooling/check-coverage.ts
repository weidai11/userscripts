
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

    // 1. Extract all [PR-XXX-00] IDs from SPEC
    const idRegex = /\[PR-[A-Z]+-[0-9]+\]/g;
    const allIds = Array.from(new Set(specContent.match(idRegex) || []));

    console.log(`
📊 Power Reader Coverage Audit`);
    console.log(`===============================`);
    console.log(`Total Requirements found in SPEC: ${allIds.length}`);

    // 2. Extract results from report
    // We need to traverse the suite tree in the JSON report
    const testResults = new Map<string, 'passed' | 'failed' | 'skipped'>();
    const idsInTests = new Set<string>();

    function processSuite(suite: any, parentTitle: string = '') {
        const fullSuiteTitle = parentTitle ? `${parentTitle} ${suite.title}` : suite.title;

        if (suite.specs) {
            suite.specs.forEach((spec: any) => {
                const title = `${fullSuiteTitle} ${spec.title}`;
                const status = spec.ok ? 'passed' : 'failed';
                // Find all IDs in this combined title
                const matches = title.match(idRegex);
                if (matches) {
                    matches.forEach((id: string) => {
                        idsInTests.add(id);
                        // If multiple tests cover same ID, 'failed' takes precedence
                        const current = testResults.get(id);
                        if (current !== 'failed') {
                            testResults.set(id, status);
                        }
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
        const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
        // Only scan the most recent few logs to avoid excessive processing
        logFiles.sort().reverse().slice(0, 5).forEach(file => {
            const content = fs.readFileSync(path.join(logDir, file), 'utf8');
            const matches = content.match(idRegex);
            if (matches) {
                matches.forEach(id => idsInTests.add(id));
            }
        });
    }

    // 3. Generate Report
    const covered = allIds.filter(id => testResults.has(id));
    const missing = allIds.filter(id => !testResults.has(id));
    const passing = covered.filter(id => testResults.get(id) === 'passed');
    const failing = covered.filter(id => testResults.get(id) === 'failed');
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
    console.log(`  ⚠️  Missing: ${missing.length}`);
    console.log(`===============================
`);

    if (failing.length > 0 || missing.length > 0) {
        // process.exit(1); // Optionally fail CI if coverage is missing
    }
}

main();
