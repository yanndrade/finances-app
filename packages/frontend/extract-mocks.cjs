const fs = require('fs');
const appTest = fs.readFileSync('src/App.test.tsx', 'utf-8');

const importsMatch = appTest.match(/import type \{[\s\S]*?\} from "\.\/lib\/api";/)[0];
const vitestImport = `import { vi } from "vitest";\n`;

const buildersStartIndex = appTest.indexOf('function buildAccount');
const installFetchStartIndex = appTest.indexOf('function installAppFetchMock');
const builders = appTest.substring(buildersStartIndex, installFetchStartIndex);

const installFetchEndIndex = appTest.indexOf('describe("App Flow"', installFetchStartIndex);
let fetchMock = appTest.substring(installFetchStartIndex, installFetchEndIndex);

const allocateStart = appTest.indexOf('function allocateMockInvoices');
const nextDescribe = appTest.indexOf('describe(', allocateStart);
const allocateFn = nextDescribe !== -1 ? appTest.substring(allocateStart, nextDescribe) : appTest.substring(allocateStart);

const output = vitestImport + '\n' + importsMatch + '\n\n' + builders + '\n' + allocateFn + '\n' + fetchMock;

// Replace 'function ' with 'export function '
const finalOutput = output.replace(/^function /gm, 'export function ');
fs.writeFileSync('src/mock-fix.ts', finalOutput);
