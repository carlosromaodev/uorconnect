#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiDirectory = join(scriptDirectory, '..');
const backendMoodleDirectory = join(apiDirectory, '..', 'backend', 'src', 'modules', 'moodle');
const redoclyCli = join(apiDirectory, 'node_modules', '@redocly', 'cli', 'bin', 'cli.js');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'uor-moodle-contract-'));
const bundledContractPath = join(temporaryDirectory, 'openapi.json');

const bundle = spawnSync(
  process.execPath,
  [redoclyCli, 'bundle', 'openapi.yaml', '--ext', 'json', '--output', bundledContractPath],
  {
    cwd: apiDirectory,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (bundle.status !== 0) {
  process.stderr.write(bundle.stderr || bundle.stdout);
  rmSync(temporaryDirectory, { recursive: true, force: true });
  process.exit(bundle.status ?? 1);
}

let contract;
try {
  contract = JSON.parse(readFileSync(bundledContractPath, 'utf8'));
} catch (error) {
  console.error(`Não foi possível interpretar o bundle OpenAPI: ${error.message}`);
  rmSync(temporaryDirectory, { recursive: true, force: true });
  process.exit(1);
}
rmSync(temporaryDirectory, { recursive: true, force: true });

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const expectedPaths = new Set([
  '/integrations/moodle/session',
  '/integrations/moodle/me',
  '/integrations/moodle/overview',
  '/integrations/moodle/courses',
  '/integrations/moodle/courses/{courseId}',
  '/integrations/moodle/courses/{courseId}/sections',
  '/integrations/moodle/courses/{courseId}/materials',
  '/integrations/moodle/materials',
  '/integrations/moodle/materials/{materialId}/open',
  '/integrations/moodle/sync',
  '/integrations/moodle/sync/status',
]);

const backendRoutesSource = readFileSync(join(backendMoodleDirectory, 'http', 'moodle.routes.ts'), 'utf8');
const backendSchemasSource = readFileSync(join(backendMoodleDirectory, 'http', 'moodle.schemas.ts'), 'utf8');
const backendModelsSource = readFileSync(join(backendMoodleDirectory, 'domain', 'models.ts'), 'utf8');
const backendErrorsSource = readFileSync(join(backendMoodleDirectory, 'domain', 'errors.ts'), 'utf8');
const backendPortsSource = readFileSync(join(backendMoodleDirectory, 'application', 'ports.ts'), 'utf8');
const backendGatewaySource = readFileSync(join(backendMoodleDirectory, 'domain', 'gateway.ts'), 'utf8');

const actualPaths = new Set(Object.keys(contract.paths ?? {}));
expect(contract.info?.version === '0.2.0', 'info.version deve ser 0.2.0.');
expect(actualPaths.size === expectedPaths.size, 'O contrato deve conter apenas os paths do MVP.');
for (const path of expectedPaths) {
  expect(actualPaths.has(path), `Path MVP ausente: ${path}`);
}
for (const path of actualPaths) {
  expect(path.startsWith('/integrations/moodle/'), `Prefixo interno inválido: ${path}`);
  expect(!path.startsWith('/api/'), `O path não deve duplicar o prefixo público /api: ${path}`);
}

const serverUrls = new Set((contract.servers ?? []).map((server) => server.url));
for (const url of [
  'http://127.0.0.1:3333',
  'http://127.0.0.1:8082/api',
  'https://api.uorconnect.ao',
]) {
  expect(serverUrls.has(url), `Servidor Swagger obrigatório ausente: ${url}`);
}

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
const sourceStatuses = new Set(['observed', 'partially-observed', 'derived', 'requires-admin']);
const documentedErrors = new Set();
let operationCount = 0;
const openApiOperations = new Set();

for (const [path, pathItem] of Object.entries(contract.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method)) continue;
    operationCount += 1;
    const label = `${method.toUpperCase()} ${path}`;
    openApiOperations.add(label);
    expect(operation['x-implementation-status'] === 'implemented', `${label} deve estar marcado como implemented.`);
    expect(sourceStatuses.has(operation['x-source-status']), `${label} sem x-source-status válido.`);
    expect(operation['x-phase'] === 'mvp', `${label} deve estar na fase mvp.`);
    expect(typeof operation['x-cache-ttl'] === 'number', `${label} sem x-cache-ttl numérico.`);
    expect(typeof operation['x-read-only'] === 'boolean', `${label} sem x-read-only booleano.`);
    expect(typeof operation['x-requires-moodle-admin'] === 'boolean', `${label} sem x-requires-moodle-admin booleano.`);
    expect(
      operation.responses?.['500']?.$ref === '#/components/responses/InternalError',
      `${label} deve documentar o envelope seguro de erro 500.`,
    );

    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      if (/^[45][0-9]{2}$/.test(status)) documentedErrors.add(status);
      if (!/^2[0-9]{2}$/.test(status)) continue;
      for (const [mediaType, media] of Object.entries(response.content ?? {})) {
        if (mediaType === 'application/octet-stream') continue;
        expect(Boolean(media.example || media.examples), `${label} ${status} deve ter exemplo 2xx útil para ${mediaType}.`);
      }
    }
  }
}

expect(operationCount === 12, `Esperadas 12 operações MVP; encontradas ${operationCount}.`);
for (const status of ['401', '403', '404', '409', '415', '422', '429', '502', '503']) {
  expect(documentedErrors.has(status), `Cobertura de erro HTTP ${status} ausente.`);
}

const schemas = contract.components?.schemas ?? {};
const createSessionProperties = schemas.CreateSessionRequest?.properties ?? {};
expect(createSessionProperties.username?.writeOnly === true, 'username deve ser writeOnly.');
expect(createSessionProperties.password?.writeOnly === true, 'password deve ser writeOnly.');
expect(
  createSessionProperties.rememberCredentials?.enum?.length === 1
    && createSessionProperties.rememberCredentials.enum[0] === true,
  'rememberCredentials deve aceitar apenas true.',
);
expect(schemas.CourseSummary?.properties?.progressPercent?.nullable === true, 'progressPercent deve aceitar null.');

const paginationRequired = new Set(schemas.Pagination?.required ?? []);
for (const field of ['returned', 'limit', 'hasMore', 'nextCursor', 'total', 'totalStatus']) {
  expect(paginationRequired.has(field), `Pagination deve exigir ${field}.`);
}

const bannedPropertyNames = new Set([
  'sourceUrl',
  'moodleId',
  'moodleUserId',
  'moodleCourseId',
  'sesskey',
  'credentialsEnvelope',
  'sessionEnvelope',
]);

function inspectPublicProperties(value, location = 'components.schemas') {
  if (!value || typeof value !== 'object') return;
  if (value.properties && typeof value.properties === 'object') {
    for (const propertyName of Object.keys(value.properties)) {
      expect(!bannedPropertyNames.has(propertyName), `Campo público proibido ${location}.${propertyName}.`);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    inspectPublicProperties(child, `${location}.${key}`);
  }
}

inspectPublicProperties(schemas);

// Paridade com o backend real: inventário das rotas Fastify e schemas Zod.
const backendRouteMatches = [...backendRoutesSource.matchAll(/protectedApp\.(get|post|delete)\("([^"]+)"/g)];
const backendOperations = new Set(backendRouteMatches.map((match) => {
  const openApiPath = `/integrations/moodle${match[2].replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
  return `${match[1].toUpperCase()} ${openApiPath}`;
}));

for (const operation of openApiOperations) {
  expect(backendOperations.has(operation), `Operação OpenAPI sem rota Fastify real: ${operation}`);
}
for (const operation of backendOperations) {
  expect(openApiOperations.has(operation), `Rota Fastify Moodle ausente no OpenAPI: ${operation}`);
}

function balancedObjectAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Marcador Zod não encontrado: ${marker}`);
  const openingBrace = source.indexOf('{', markerIndex + marker.length - 1);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace + 1, index);
    }
  }
  throw new Error(`Objeto Zod sem fecho: ${marker}`);
}

function braceDelta(line) {
  let delta = 0;
  let quote = null;
  let escaped = false;
  for (const character of line) {
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') delta += 1;
    if (character === '}') delta -= 1;
  }
  return delta;
}

function topLevelFields(objectBody) {
  const fields = new Set();
  let depth = 0;
  for (const line of objectBody.split('\n')) {
    if (depth === 0) {
      const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*):/);
      if (match) fields.add(match[1]);
    }
    depth += braceDelta(line);
  }
  return fields;
}

function zodFields(exportName) {
  return topLevelFields(balancedObjectAfter(backendSchemasSource, `export const ${exportName} = z.object({`));
}

function nestedZodFields(parentBody, marker) {
  return topLevelFields(balancedObjectAfter(parentBody, marker));
}

function schemaFields(componentName) {
  return new Set(Object.keys(schemas[componentName]?.properties ?? {}));
}

function expectSameFields(label, backendFields, openApiFields) {
  const backend = [...backendFields].sort();
  const openApi = [...openApiFields].sort();
  expect(
    JSON.stringify(backend) === JSON.stringify(openApi),
    `${label} diverge: backend=[${backend.join(', ')}], OpenAPI=[${openApi.join(', ')}].`,
  );
}

const schemaParity = [
  ['CreateSessionRequest', zodFields('createMoodleSessionBodySchema')],
  ['ConnectionSummary', zodFields('moodleConnectionSchema')],
  ['Profile', zodFields('profileSchema')],
  ['CourseSummary', zodFields('courseSchema')],
  ['ModuleSummary', zodFields('moduleSummarySchema')],
  ['Section', zodFields('sectionSchema')],
  ['Material', zodFields('materialSchema')],
  ['SyncRun', zodFields('syncViewSchema')],
  ['ListMeta', zodFields('responseMetaSchema')],
];
for (const [componentName, backendFields] of schemaParity) {
  expectSameFields(componentName, backendFields, schemaFields(componentName));
}

const overviewEnvelopeBody = balancedObjectAfter(
  backendSchemasSource,
  'export const overviewEnvelopeSchema = z.object({',
);
const overviewDataBody = balancedObjectAfter(overviewEnvelopeBody, 'data: z.object({');
expectSameFields('Overview', topLevelFields(overviewDataBody), schemaFields('Overview'));
expectSameFields(
  'OverviewCounts',
  nestedZodFields(overviewDataBody, 'counts: z.object({'),
  schemaFields('OverviewCounts'),
);
expectSameFields(
  'TrackedProgress',
  nestedZodFields(overviewDataBody, 'progress: z.object({'),
  schemaFields('TrackedProgress'),
);
expectSameFields(
  'UnsupportedDeadlineList',
  nestedZodFields(overviewDataBody, 'nextDeadlines: z.object({'),
  schemaFields('UnsupportedDeadlineList'),
);

const errorEnvelopeBody = balancedObjectAfter(
  backendSchemasSource,
  'export const moodleErrorSchema = z.object({',
);
expectSameFields('Error', nestedZodFields(errorEnvelopeBody, 'error: z.object({'), schemaFields('Error'));
expectSameFields('ErrorEnvelope', topLevelFields(errorEnvelopeBody), schemaFields('ErrorEnvelope'));

function parseConstArray(source, constantName) {
  const match = source.match(new RegExp(`export const ${constantName} = \\[([\\s\\S]*?)\\] as const`));
  if (!match) throw new Error(`Constante de domínio não encontrada: ${constantName}`);
  return new Set([...match[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]));
}

for (const [componentName, constantName] of [
  ['CountStatus', 'moodleCountStatuses'],
  ['ConnectionStatus', 'moodleConnectionStatuses'],
  ['SyncStatus', 'moodleSyncStatuses'],
]) {
  expectSameFields(
    `${componentName}.enum`,
    parseConstArray(backendModelsSource, constantName),
    new Set(schemas[componentName]?.enum ?? []),
  );
}

const backendActionMatch = backendSchemasSource.match(/actionRequired:\s*z\.enum\(\[([^\]]+)\]\)/);
expect(Boolean(backendActionMatch), 'Enum actionRequired não encontrado no schema backend.');
if (backendActionMatch) {
  const backendActions = new Set(
    [...backendActionMatch[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]),
  );
  expectSameFields('ActionRequired.enum', backendActions, new Set(schemas.ActionRequired?.enum ?? []));
}

const backendErrorCodeMatch = backendErrorsSource.match(/export type MoodleErrorCode =([\s\S]*?);/);
expect(Boolean(backendErrorCodeMatch), 'Union MoodleErrorCode não encontrada no backend.');
if (backendErrorCodeMatch) {
  const backendErrorCodes = new Set(
    [...backendErrorCodeMatch[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]),
  );
  expectSameFields(
    'MoodleErrorCode.enum',
    backendErrorCodes,
    new Set(schemas.MoodleErrorCode?.enum ?? []),
  );
}

const backendMaterialTypeMatch = backendGatewaySource.match(
  /export type MoodleGatewayMaterialType =([\s\S]*?);/,
);
expect(Boolean(backendMaterialTypeMatch), 'Union MoodleGatewayMaterialType não encontrada no backend.');
if (backendMaterialTypeMatch) {
  const backendMaterialTypes = new Set(
    [...backendMaterialTypeMatch[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]),
  );
  expectSameFields(
    'MaterialType.enum',
    backendMaterialTypes,
    new Set(schemas.MaterialType?.enum ?? []),
  );
}

const successSchemaMarkers = new Map([
  ['POST /integrations/moodle/session', ['200: sessionEnvelopeSchema', '201: sessionEnvelopeSchema']],
  ['DELETE /integrations/moodle/session', ['200: sessionEnvelopeSchema']],
  ['GET /integrations/moodle/me', ['200: profileEnvelopeSchema']],
  ['GET /integrations/moodle/overview', ['200: overviewEnvelopeSchema']],
  ['GET /integrations/moodle/courses', ['200: courseListEnvelopeSchema']],
  ['GET /integrations/moodle/courses/{courseId}', ['200: courseEnvelopeSchema']],
  ['GET /integrations/moodle/courses/{courseId}/sections', ['200: sectionListEnvelopeSchema']],
  ['GET /integrations/moodle/courses/{courseId}/materials', ['200: materialListEnvelopeSchema']],
  ['GET /integrations/moodle/materials', ['200: materialListEnvelopeSchema']],
  ['POST /integrations/moodle/sync', ['202: syncEnvelopeSchema']],
  ['GET /integrations/moodle/sync/status', ['200: syncEnvelopeSchema']],
]);

const openApiSuccessSchemas = [
  ['post', '/integrations/moodle/session', '200', '#/components/schemas/SessionEnvelope'],
  ['post', '/integrations/moodle/session', '201', '#/components/schemas/SessionEnvelope'],
  ['delete', '/integrations/moodle/session', '200', '#/components/schemas/SessionEnvelope'],
  ['get', '/integrations/moodle/me', '200', '#/components/schemas/ProfileEnvelope'],
  ['get', '/integrations/moodle/overview', '200', '#/components/schemas/OverviewEnvelope'],
  ['get', '/integrations/moodle/courses', '200', '#/components/schemas/CourseListEnvelope'],
  ['get', '/integrations/moodle/courses/{courseId}', '200', '#/components/schemas/CourseDetailEnvelope'],
  ['get', '/integrations/moodle/courses/{courseId}/sections', '200', '#/components/schemas/SectionListEnvelope'],
  ['get', '/integrations/moodle/courses/{courseId}/materials', '200', '#/components/schemas/MaterialListEnvelope'],
  ['get', '/integrations/moodle/materials', '200', '#/components/schemas/MaterialListEnvelope'],
  ['post', '/integrations/moodle/sync', '202', '#/components/schemas/SyncRunEnvelope'],
  ['get', '/integrations/moodle/sync/status', '200', '#/components/schemas/SyncStatusEnvelope'],
];

for (const [method, path, status, expectedSchema] of openApiSuccessSchemas) {
  const actualSchema = contract.paths?.[path]?.[method]?.responses?.[status]
    ?.content?.['application/json']?.schema?.$ref;
  expect(
    actualSchema === expectedSchema,
    `${method.toUpperCase()} ${path} ${status} usa ${actualSchema ?? 'nenhum schema'}, esperado ${expectedSchema}.`,
  );
}

for (const [index, match] of backendRouteMatches.entries()) {
  const nextIndex = backendRouteMatches[index + 1]?.index ?? backendRoutesSource.length;
  const routeBlock = backendRoutesSource.slice(match.index, nextIndex);
  const operation = `${match[1].toUpperCase()} /integrations/moodle${match[2].replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
  for (const marker of successSchemaMarkers.get(operation) ?? []) {
    expect(routeBlock.includes(marker), `${operation} não usa o schema backend esperado: ${marker}.`);
  }
  if (operation === 'GET /integrations/moodle/materials/{materialId}/open') {
    expect(
      routeBlock.includes('reply.code(download.status)'),
      'Download deve propagar apenas o status 200 ou 206 já validado pela aplicação.',
    );
    expect(
      /export type MoodleDownload = \{[\s\S]*?status:\s*200\s*\|\s*206;/.test(backendPortsSource),
      'MoodleDownload.status deve restringir o proxy a 200 | 206.',
    );
    expect(
      Boolean(contract.paths['/integrations/moodle/materials/{materialId}/open'].get.responses['200'])
        && Boolean(contract.paths['/integrations/moodle/materials/{materialId}/open'].get.responses['206']),
      'OpenAPI deve documentar respostas de download 200 e 206.',
    );
  }
}

if (failures.length > 0) {
  console.error('Falhas de contrato Moodle:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Contrato Moodle verificado com paridade Fastify/Zod: ${actualPaths.size} paths, ${operationCount} operações, ${documentedErrors.size} classes de erro.`);
