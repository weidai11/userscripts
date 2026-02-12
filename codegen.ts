import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    overwrite: true,
    schema: "src/shared/graphql/lw_schema.json",
    documents: "src/shared/graphql/queries.ts",
    generates: {
        "src/generated/graphql.ts": {
            plugins: ["typescript", "typescript-operations"],
            config: {
                skipTypename: false,
                withHooks: false,
                withHOC: false,
                withComponent: false,
            }
        },
        "src/shared/graphql/lw_schema.graphql": {
            plugins: ["schema-ast"]
        }
    }
};

export default config;
