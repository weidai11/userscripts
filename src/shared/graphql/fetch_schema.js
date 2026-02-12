import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchSchema() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Navigating to LessWrong...');
    await page.goto('https://www.lesswrong.com/', { waitUntil: 'domcontentloaded' });

    console.log('Fetching schema...');

    try {
        const result = await page.evaluate(async (query) => {
            const response = await fetch('https://www.lesswrong.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            return response.json();
        }, INTROSPECTION_QUERY);

        if (result.errors) {
            console.error('GraphQL Errors:', result.errors);
            process.exit(1);
        }

        const schema = result.data;

        // --- Workaround for ForumMagnum Schema Bug ---
        // Some versions of the server return an EmptyViewInput with no fields, 
        // which is invalid according to GraphQL specifications and crashes graphql-codegen.
        const emptyViewInput = schema.__schema.types.find(t => t.name === 'EmptyViewInput');
        if (emptyViewInput && (!emptyViewInput.inputFields || emptyViewInput.inputFields.length === 0)) {
            console.log('Fixing EmptyViewInput bug in schema (adding dummy field)...');
            emptyViewInput.inputFields = [{
                name: "_unused",
                description: "Unused field to satisfy GraphQL-JS",
                type: { kind: "SCALAR", name: "Boolean", ofType: null },
                defaultValue: null
            }];
        }

        const outputPath = path.resolve(__dirname, 'lw_schema.json');
        // Note: We wrap it in { data: ... } to match the format expected by some tools if necessary,
        // but graphql-codegen usually wants the schema object directly or the { data } wrapper.
        // The previous successful codegen used a file with { data: { __schema: ... } }.
        fs.writeFileSync(outputPath, JSON.stringify({ data: schema }, null, 2));
        console.log(`Schema successfully saved to ${outputPath}`);
        console.log('You can now run "npm run codegen" to update type definitions.');

    } catch (err) {
        console.error('Failed to fetch schema:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

fetchSchema();
