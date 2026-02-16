import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const inputs = [
  'codegen.ts',
  'src/shared/graphql/queries.ts',
  'src/shared/graphql/lw_schema.json'
];

const outputs = [
  'src/generated/graphql.ts',
  'src/shared/graphql/lw_schema.graphql'
];

const schemaPath = 'src/shared/graphql/lw_schema.json';

if (!fs.existsSync(schemaPath)) {
  console.log(`Schema file ${schemaPath} not found. Fetching schema...`);
  try {
    execSync('node src/shared/graphql/fetch_schema.js', { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to fetch schema.');
    process.exit(1);
  }
}

function needsCodegen() {
  for (const out of outputs) {
    if (!fs.existsSync(out)) {
      console.log(`Output ${out} missing.`);
      return true;
    }
  }

  const latestInputMtime = Math.max(...inputs.map(file => {
    try {
      return fs.statSync(file).mtimeMs;
    } catch (e) {
      console.error(`Warning: Could not stat input file ${file}`);
      return 0;
    }
  }));

  const generatedMtime = fs.statSync(outputs[0]).mtimeMs;

  return latestInputMtime > generatedMtime;
}

if (needsCodegen()) {
  console.log('Detected changes in GraphQL queries or schema. Running codegen...');
  try {
    // Run the local graphql-codegen command directly to save a bit of time over npm run
    execSync('npx graphql-codegen --config codegen.ts', { stdio: 'inherit' });
  } catch (e) {
    console.error('Codegen failed.');
    process.exit(1);
  }
}
