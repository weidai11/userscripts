import { defineConfig, devices } from '@playwright/test';

const specArgs = process.argv.filter(arg => /\.spec\.ts(:\d+)?$/.test(arg));
if (!process.env.PW_SINGLE_FILE_RUN) {
    process.env.PW_SINGLE_FILE_RUN = specArgs.length === 1 ? 'true' : 'false';
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    globalSetup: './tests/global-setup.ts',
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 4,
    reporter: [
        ['list'],
        ['json', { outputFile: 'last-test-report.json' }],
        ['./tests/reporters/file-reporter.ts']
    ],
    use: {
        trace: 'on-first-retry',
        headless: true,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: ['--disable-web-security'],
                },
            },
        },
    ],
});
