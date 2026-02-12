import fs from 'fs';
import path from 'path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

class FileReporter implements Reporter {
    private logFile: string;
    private logStream: fs.WriteStream;
    private isSingleFileRun = false;
    private testFileCount = 0;

    constructor() {
        const logDir = path.join(process.cwd(), 'test_logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') + '_' +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');

        const fileName = `test_run_${timestamp}.log`;
        this.logFile = path.resolve(logDir, fileName); // Use absolute path
        this.cleanupLogs(logDir);
        this.logStream = fs.createWriteStream(this.logFile);

        this.logStream.write(`=== Test Run Started at ${now.toISOString()} ===\n\n`);
    }

    private cleanupLogs(logDir: string) {
        try {
            const MAX_LOGS = 50;
            const files = fs.readdirSync(logDir)
                .filter(f => f.startsWith('test_run_') && f.endsWith('.log'))
                .sort(); // Oldest first (timestamp based)

            if (files.length > MAX_LOGS) {
                const toDelete = files.slice(0, files.length - MAX_LOGS);
                toDelete.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(logDir, file));
                    } catch (err) {
                        // ignore deletion errors
                    }
                });
            }
        } catch (e) {
            // ignore cleanup errors
        }
    }

    onBegin(_config: FullConfig, suite: Suite) {
        const files = new Set<string>();
        for (const test of suite.allTests()) {
            if (test.location?.file) files.add(test.location.file);
        }

        this.testFileCount = files.size;
        this.isSingleFileRun = files.size <= 1;
    }

    private isVerboseLine(line: string): boolean {
        if (!line) return false;
        if (line.startsWith('BROWSER ERROR:') || line.startsWith('BROWSER WARN:')) return false;
        if (line.startsWith('BROWSER DEBUG:')) return true;
        if (line.startsWith('BROWSER:')) return true;
        if (line.startsWith('[GRAPHQL]')) return true;
        return false;
    }

    private filterVerboseChunk(chunk: string | Buffer): string | null {
        if (this.isSingleFileRun) return chunk.toString();

        const text = chunk.toString();
        const hasTrailingNewline = /\r?\n$/.test(text);
        const lines = text.split(/\r?\n/);
        if (hasTrailingNewline) lines.pop();

        const kept = lines.filter(line => !this.isVerboseLine(line));
        if (kept.length === 0) return null;

        return hasTrailingNewline ? `${kept.join('\n')}\n` : kept.join('\n');
    }

    onStdOut(chunk: string | Buffer) {
        const filtered = this.filterVerboseChunk(chunk);
        if (filtered) this.logStream.write(filtered);
    }

    onStdErr(chunk: string | Buffer) {
        const filtered = this.filterVerboseChunk(chunk);
        if (filtered) this.logStream.write(filtered);
    }

    onTestBegin(test: TestCase) {
        this.logStream.write(`\n[START] ${test.title}\n`);
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const status = result.status === 'passed' ? 'PASS' : 'FAIL';
        this.logStream.write(`[END] ${test.title} (${status})\n`);
        if (result.errors?.length > 0) {
            result.errors.forEach((err: any) => {
                this.logStream.write(`Error message: ${err.message}\n`);
                if (err.stack) this.logStream.write(`Stack trace:\n${err.stack}\n`);
            });
        }
    }

    async onEnd(result: FullResult) {
        this.logStream.write(`\n=== Test Run Ended with status: ${result.status} ===\n`);
        this.logStream.end();

        process.stdout.write(`\n\x1b[32mTest run complete.\x1b[0m\n`);
        process.stdout.write(`\x1b[32mFull Log: \x1b[0m\x1b[36m${this.logFile}\x1b[0m\n`);
        if (!this.isSingleFileRun) {
            process.stdout.write(
                '\x1b[33mNote:\x1b[0m Debug/verbose browser logs are only written to the file log when running a single spec file. ' +
                'Re-run a single file (e.g. `npx playwright test tests/power-reader.spec.ts`) if you need them.\n'
            );
        }
    }
}

export default FileReporter;
