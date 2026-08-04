import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { modules } from './inventory.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const contractRoot = path.join(root, 'contracts/openapi')
await mkdir(path.join(contractRoot, 'modules'), { recursive: true })

const paths = {}
for (const module of modules) {
  const modulePaths = {}
  for (const operation of module.operations) {
    const item = modulePaths[operation.path] ??= {}
    item[operation.method] = buildOperation(module, operation)
  }
  await writeYaml(path.join(contractRoot, 'modules', `${module.key}.yaml`), { paths: modulePaths })
  Object.assign(paths, mergePaths(paths, modulePaths))
}

const rootSpec = buildSpec(paths, false)
const bundled = buildSpec(paths, true)
await writeYaml(path.join(contractRoot, 'openapi.yaml'), rootSpec)
await writeYaml(path.join(contractRoot, 'medicore.openapi.yaml'), bundled)
console.log(`Generated ${modules.reduce((sum, module) => sum + module.operations.length, 0)} operations across ${modules.length} modules.`)

function buildSpec(allPaths, bundledOutput) {
  const components = bundledOutput ? bundledComponents() : {
    securitySchemes: {
      sessionCookie: { $ref: './components/security.yaml#/securitySchemes/sessionCookie' },
      paymentWebhookSignature: { $ref: './components/security.yaml#/securitySchemes/paymentWebhookSignature' },
    },
    schemas: {
      Resource: { $ref: './components/common.yaml#/schemas/Resource' },
      CursorPage: { $ref: './components/common.yaml#/schemas/CursorPage' },
      Problem: { $ref: './components/errors.yaml#/schemas/Problem' },
      AuthRegistrationRequest: { $ref: './components/domain.yaml#/schemas/AuthRegistrationRequest' },
      OtpChallengeRequest: { $ref: './components/domain.yaml#/schemas/OtpChallengeRequest' },
      OtpSessionRequest: { $ref: './components/domain.yaml#/schemas/OtpSessionRequest' },
      PasswordSessionRequest: { $ref: './components/domain.yaml#/schemas/PasswordSessionRequest' },
      Session: { $ref: './components/domain.yaml#/schemas/Session' },
      SlotHoldRequest: { $ref: './components/domain.yaml#/schemas/SlotHoldRequest' },
      PaymentWebhookEvent: { $ref: './components/domain.yaml#/schemas/PaymentWebhookEvent' },
      ClinicalDraftRequest: { $ref: './components/domain.yaml#/schemas/ClinicalDraftRequest' },
      DiagnosisDraftRequest: { $ref: './components/domain.yaml#/schemas/DiagnosisDraftRequest' },
      PaymentRequest: { $ref: './components/domain.yaml#/schemas/PaymentRequest' },
    },
  }
  return {
    openapi: '3.1.0',
    info: { title: 'MediCore API', version: 'v1', description: 'Source-first external API contract for MediCore Release 1.' },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    servers: [{ url: '/api/v1' }],
    tags: modules.map(module => ({ name: module.tag, description: `${module.key} module — ${module.story}` })),
    paths: allPaths,
    components,
  }
}

function buildOperation(module, operation) {
  const safe = ['get', 'head', 'options'].includes(operation.method)
  const responseCode = String(operation.success ?? (operation.method === 'post' ? 200 : operation.method === 'delete' ? 204 : 200))
  const parameters = [
    header('X-Request-Id', false), header('X-Correlation-Id', false),
    ...pathParameters(operation.path),
    ...(operation.list ? [query('cursor', false, { type: 'string', maxLength: 1024 }), query('limit', false, { type: 'integer', minimum: 1, maximum: 100, default: 20 })] : []),
    ...(operation.idempotent ? [header('Idempotency-Key', true)] : []),
    ...(operation.csrf ? [header('X-CSRF-Token', true)] : []),
    ...(operation.ifMatch ? [header('If-Match', true, { type: 'string', pattern: '^"[0-9]+"$' })] : []),
  ]
  const result = {
    tags: [module.tag],
    summary: humanize(operation.operationId),
    operationId: operation.operationId,
    parameters,
    security: operation.public ? [] : operation.webhook ? [{ paymentWebhookSignature: [] }] : [{ sessionCookie: [] }],
    responses: {
      [responseCode]: successResponse(operation, responseCode),
      '400': problem('Invalid request'),
      ...(operation.public ? {} : { '401': problem('Authentication required'), '403': problem('Contextual permission denied') }),
      '409': problem('Domain state or idempotency conflict'),
      ...(operation.ifMatch ? { '412': problem('ETag precondition failed'), '428': problem('If-Match required') } : {}),
      '429': problem('Rate limit exceeded'),
    },
    'x-medicore-module': module.key,
    'x-medicore-permission': operation.permission,
    'x-medicore-audit-action': operation.permission,
    'x-medicore-stories': module.story.split(','),
    'x-medicore-scenarios': module.scenarios,
    'x-medicore-idempotent': Boolean(operation.idempotent),
  }
  if (operation.environments) result['x-medicore-environments'] = operation.environments
  if (!safe && responseCode !== '204') {
    result.requestBody = {
      required: true,
      content: {
        'application/json': { schema: { $ref: `#/components/schemas/${operation.body ?? 'Resource'}` } },
      },
    }
  }
  if (operation.webhook) {
    result.parameters.push(header('X-Provider-Event-Id', true), header('X-Provider-Timestamp', true))
  }
  return result
}

function successResponse(operation, code) {
  if (code === '204') return { description: 'Command completed.' }
  if (code === '202') return { description: 'Request accepted without exposing resource existence.', content: { 'application/json': { schema: { type: 'object', properties: { accepted: { type: 'boolean', const: true }, requestId: { type: 'string' } }, required: ['accepted', 'requestId'] } } } }
  const schema = operation.list ? { $ref: '#/components/schemas/CursorPage' } : { $ref: `#/components/schemas/${operation.response ?? 'Resource'}` }
  return { description: 'Successful response.', headers: { ETag: { schema: { type: 'string' } }, 'X-Request-Id': { schema: { type: 'string' } }, 'X-Correlation-Id': { schema: { type: 'string' } } }, content: { 'application/json': { schema } } }
}

function problem(description) { return { description, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } } }
function header(name, required, schema = { type: 'string', maxLength: 128 }) { return { name, in: 'header', required, schema } }
function query(name, required, schema) { return { name, in: 'query', required, schema } }
function pathParameters(value) { return [...value.matchAll(/\{([^}]+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: { type: 'string', format: match[1] === 'provider' ? undefined : 'uuid', maxLength: match[1] === 'provider' ? 64 : undefined } })) }
function humanize(value) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()) }
function mergePaths(target, source) { const merged = {}; for (const [p, item] of Object.entries(source)) merged[p] = { ...(target[p] ?? {}), ...item }; return merged }
async function writeYaml(file, data) { await writeFile(file, YAML.stringify(data, { lineWidth: 0 })) }

function bundledComponents() {
  return {
    securitySchemes: {
      sessionCookie: { type: 'apiKey', in: 'cookie', name: 'MEDICORE_SESSION' },
      paymentWebhookSignature: { type: 'apiKey', in: 'header', name: 'X-Provider-Signature' },
    },
    schemas: {
      Resource: { type: 'object', additionalProperties: true, required: ['id'], properties: { id: { type: 'string', format: 'uuid' }, version: { type: 'integer', format: 'int64', minimum: 0 }, status: { type: 'string' } } },
      CursorPage: { type: 'object', additionalProperties: false, required: ['items', 'hasMore'], properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Resource' } }, nextCursor: { type: ['string', 'null'] }, hasMore: { type: 'boolean' } } },
      Problem: { type: 'object', additionalProperties: true, required: ['type', 'title', 'status', 'code', 'requestId'], properties: { type: { type: 'string' }, title: { type: 'string' }, status: { type: 'integer' }, detail: { type: 'string' }, code: { type: 'string' }, requestId: { type: 'string' }, correlationId: { type: ['string', 'null'] }, fieldErrors: { type: 'array', items: { type: 'object' } }, blockers: { type: 'array', items: { type: 'object' } } } },
      AuthRegistrationRequest: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 12, maxLength: 128, writeOnly: true } } },
      OtpChallengeRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      OtpSessionRequest: { type: 'object', required: ['email', 'code'], properties: { email: { type: 'string', format: 'email' }, code: { type: 'string', writeOnly: true } } },
      PasswordSessionRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', writeOnly: true } } },
      Session: { allOf: [{ $ref: '#/components/schemas/Resource' }, { type: 'object', properties: { accountId: { type: 'string', format: 'uuid' }, absoluteExpiresAt: { type: 'string', format: 'date-time' }, permissions: { type: 'array', items: { type: 'string' } } } }] },
      SlotHoldRequest: { type: 'object', required: ['slotId', 'patientId'], properties: { slotId: { type: 'string', format: 'uuid' }, patientId: { type: 'string', format: 'uuid' } } },
      PaymentWebhookEvent: { type: 'object', additionalProperties: true, required: ['eventId', 'providerOccurredAt', 'amount', 'currency'], properties: { eventId: { type: 'string' }, providerOccurredAt: { type: 'string', format: 'date-time' }, amount: { type: 'string', pattern: '^\\d{1,17}\\.\\d{2}$' }, currency: { type: 'string', const: 'VND' } } },
      ClinicalDraftRequest: { type: 'object', required: ['contentSchemaVersion', 'content'], properties: { contentSchemaVersion: { type: 'string' }, content: { type: 'object', additionalProperties: true } } },
      DiagnosisDraftRequest: { type: 'object', additionalProperties: true, properties: { code: { type: 'string' }, freeText: { type: 'string' }, diagnosisType: { type: 'string' }, clinicalStatus: { type: 'string' } } },
      PaymentRequest: { type: 'object', required: ['provider', 'transactionId', 'amount'], properties: { provider: { type: 'string', enum: ['CASH', 'MOCK'] }, transactionId: { type: 'string' }, amount: { type: 'object', required: ['amount', 'currency'], properties: { amount: { type: 'string', pattern: '^\\d{1,17}\\.\\d{2}$' }, currency: { type: 'string', const: 'VND' } } } } },
    },
  }
}
