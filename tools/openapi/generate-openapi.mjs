import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

await writeYaml(path.join(contractRoot, 'openapi.yaml'), await buildSpec(paths))
console.log(`Generated ${modules.reduce((sum, module) => sum + module.operations.length, 0)} operations across ${modules.length} modules.`)

async function buildSpec(allPaths) {
  return {
    openapi: '3.1.0',
    info: { title: 'MediCore API', version: 'v1', description: 'Source-first external API contract for MediCore Release 1.' },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    servers: [{ url: '/api/v1' }],
    tags: modules.map(module => ({ name: module.tag, description: `${module.key} module — ${module.story}` })),
    paths: allPaths,
    components: await sourceComponentAliases(),
  }
}

async function sourceComponentAliases() {
  const aliases = {}
  for (const file of ['common.yaml', 'errors.yaml', 'domain.yaml', 'security.yaml']) {
    const source = YAML.parse(await readFile(path.join(contractRoot, 'components', file), 'utf8'))
    for (const category of ['schemas', 'parameters', 'headers', 'responses', 'securitySchemes']) {
      for (const name of Object.keys(source[category] ?? {})) {
        const values = aliases[category] ??= {}
        if (values[name]) throw new Error(`Duplicate OpenAPI component ${category}.${name}`)
        values[name] = { $ref: `./components/${file}#/${category}/${name}` }
      }
    }
  }
  return aliases
}

function buildOperation(module, operation) {
  const safe = ['get', 'head', 'options'].includes(operation.method)
  const responseCode = String(operation.success ?? (operation.method === 'delete' ? 204 : 200))
  const parameters = [
    componentParameter('RequestId'),
    componentParameter('CorrelationId'),
    ...pathParameters(operation.path),
    ...(operation.list ? [componentParameter('Cursor'), componentParameter('Limit')] : []),
    ...(operation.queryParameters ?? []).map(parameter => query(parameter.name, Boolean(parameter.required), parameter.schema, parameter.description)),
    ...(operation.idempotent ? [componentParameter('IdempotencyKey')] : []),
    ...(operation.csrf ? [componentParameter('CsrfToken')] : []),
    ...(operation.ifMatch ? [componentParameter('IfMatch')] : []),
  ]
  const result = {
    tags: [module.tag],
    summary: humanize(operation.operationId),
    operationId: operation.operationId,
    parameters,
    security: operation.optionalSession ? [{ sessionCookie: [] }, {}] : operation.public ? [] : operation.webhook ? [{ paymentWebhookSignature: [] }] : [{ sessionCookie: [] }],
    responses: {
      [responseCode]: successResponse(operation, responseCode),
      '400': problem('Invalid request'),
      ...(!operation.public ? { '401': problem('Authentication required'), '403': problem('Contextual permission denied') } : {}),
      ...(['get', 'put', 'patch', 'delete'].includes(operation.method) || operation.path.includes('{') ? { '404': problem('Resource not found or intentionally concealed') } : {}),
      '409': problem('Domain state or idempotency conflict'),
      ...(operation.ifMatch ? { '412': problem('ETag precondition failed'), '428': problem('If-Match required') } : {}),
      '429': {
        ...problem('Rate limit exceeded'),
        headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } },
      },
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
  const schema = { $ref: `#/components/schemas/${operation.response ?? (operation.list ? 'CursorPage' : 'Resource')}` }
  const headers = {
    'X-Request-Id': { $ref: '#/components/headers/RequestId' },
    'X-Correlation-Id': { $ref: '#/components/headers/CorrelationId' },
    ...(code !== '202' ? { ETag: { $ref: '#/components/headers/ETag' } } : {}),
    ...(operation.sessionResponse ? {
      'Set-Cookie': {
        description: 'MEDICORE_SESSION opaque cookie with Secure, HttpOnly and SameSite=Lax attributes.',
        schema: { type: 'string' },
      },
      'X-CSRF-Token': {
        description: 'Session-bound CSRF token required for unsafe browser requests.',
        schema: { type: 'string', minLength: 16, maxLength: 512 },
      },
    } : {}),
  }
  return {
    description: code === '202' ? 'Request accepted without exposing resource existence.' : 'Successful response.',
    headers,
    content: { 'application/json': { schema } },
  }
}

function problem(description) { return { description, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } } }
function componentParameter(name) { return { $ref: `#/components/parameters/${name}` } }
function header(name, required, schema = { type: 'string', maxLength: 128 }) { return { name, in: 'header', required, schema } }
function query(name, required, schema, description) { return { name, in: 'query', required, schema, ...(description ? { description } : {}) } }
function pathParameters(value) { return [...value.matchAll(/\{([^}]+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: { type: 'string', format: match[1] === 'provider' ? undefined : 'uuid', maxLength: match[1] === 'provider' ? 64 : undefined } })) }
function humanize(value) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()) }
function mergePaths(target, source) { const merged = {}; for (const [p, item] of Object.entries(source)) merged[p] = { ...(target[p] ?? {}), ...item }; return merged }
async function writeYaml(file, data) { await writeFile(file, YAML.stringify(data, { lineWidth: 0 })) }
