import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

/**
 * Recursively find the newest modification time in a directory
 */
const getNewestMtime = (dirPath: string): number => {
    let maxMtime = 0;

    if (!fs.existsSync(dirPath)) return 0;

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            const nestedMtime = getNewestMtime(fullPath);
            maxMtime = Math.max(maxMtime, nestedMtime);
        } else {
            maxMtime = Math.max(maxMtime, stat.mtimeMs);
        }
    }
    return maxMtime;
};

/**
 * Global setup to ensure the build is fresh
 */
async function globalSetup() {
    console.log('\x1b[36m%s\x1b[0m', 'Global Setup: Checking build freshness...');

    // Config: Source dir (watch list) vs Output file
    // For now assuming we are mostly testing power-reader
    const sourceDirs = [
        path.join(ROOT_DIR, 'src/scripts/power-reader'),
        path.join(ROOT_DIR, 'src/shared')
    ];
    const outputFile = path.join(ROOT_DIR, 'dist/power-reader.user.js');

    // 1. Get output age
    let outMtime = 0;
    if (fs.existsSync(outputFile)) {
        outMtime = fs.statSync(outputFile).mtimeMs;
    }

    // 2. Get newest source age
    let srcMtime = 0;
    for (const dir of sourceDirs) {
        const mtime = getNewestMtime(dir);
        srcMtime = Math.max(srcMtime, mtime);
    }

    // 3. Compare
    if (srcMtime > outMtime || outMtime === 0) {
        console.log('\x1b[33m%s\x1b[0m', 'Build is stale or missing. Rebuilding power-reader...');
        try {
            // execSync inherits stdio so you see the build output
            execSync('npm run build:power-reader', { cwd: ROOT_DIR, stdio: 'inherit' });
            console.log('\x1b[32m%s\x1b[0m', 'Build complete.');
        } catch (e) {
            console.error('\x1b[31m%s\x1b[0m', 'Build failed!');
            throw e;
        }
    } else {
        console.log('\x1b[32m%s\x1b[0m', 'Build is fresh. Skipping rebuild.');
    }
}

export default globalSetup;
