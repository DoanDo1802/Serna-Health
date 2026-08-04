import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { modules } from './inventory.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const spec = YAML.parse(await readFile(path.join(root, 'contracts/openapi/medicore.openapi.yaml'), 'utf8'))
const expected = modules.flatMap(module => module.operations.map(operation => ({ module, operation })))
const actual = []
const errors = []
const ids = new Set()

for (const [apiPath, item] of Object.entries(spec.paths ?? {})) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const operation = item[method]
    if (!operation) continue
    actual.push({ path: apiPath, method, operation })
    if (!operation.operationId) errors.push(`${method.toUpperCase()} ${apiPath}: missing operationId`)
    else if (ids.has(operation.operationId)) errors.push(`${method.toUpperCase()} ${apiPath}: duplicate operationId ${operation.operationId}`)
    else ids.add(operation.operationId)
    for (const extension of ['x-medicore-module', 'x-medicore-permission', 'x-medicore-audit-action', 'x-medicore-stories', 'x-medicore-scenarios']) {
      if (operation[extension] === undefined) errors.push(`${operation.operationId}: missing ${extension}`)
    }
    if (!Array.isArray(operation.security)) errors.push(`${operation.operationId}: security must be explicit`)
  }
}

let typedCount = 0
for (const { module, operation } of expected) {
  const found = spec.paths?.[operation.path]?.[operation.method]
  if (!found) {
    errors.push(`inventory missing in bundle: ${operation.method.toUpperCase()} ${operation.path}`)
    continue
  }
  if (found.operationId !== operation.operationId) errors.push(`${operation.path}: expected operationId ${operation.operationId}`)
  if (found['x-medicore-module'] !== module.key) errors.push(`${operation.operationId}: wrong module owner`)
  const parameters = (found.parameters ?? []).map(parameter => resolve(parameter))
  const names = new Set(parameters.map(parameter => parameter.name))
  for (const required of ['X-Request-Id', 'X-Correlation-Id']) {
    if (!names.has(required)) errors.push(`${operation.operationId}: missing ${required}`)
  }
  if (operation.idempotent && !names.has('Idempotency-Key')) errors.push(`${operation.operationId}: missing Idempotency-Key`)
  if (operation.ifMatch && !names.has('If-Match')) errors.push(`${operation.operationId}: missing If-Match`)
  if (operation.csrf && !names.has('X-CSRF-Token')) errors.push(`${operation.operationId}: missing X-CSRF-Token`)
  for (const parameter of operation.queryParameters ?? []) {
    if (!names.has(parameter.name)) errors.push(`${operation.operationId}: missing query parameter ${parameter.name}`)
  }

  if (module.typed) {
    typedCount++
    const successCode = String(operation.success ?? (operation.method === 'delete' ? 204 : 200))
    const requestRef = found.requestBody?.content?.['application/json']?.schema?.$ref
    const responseRef = found.responses?.[successCode]?.content?.['application/json']?.schema?.$ref
    if (successCode !== '204' && !operation.response) errors.push(`${operation.operationId}: typed operation missing response metadata`)
    if (operation.body && componentName(requestRef) !== operation.body) errors.push(`${operation.operationId}: expected request schema ${operation.body}, found ${componentName(requestRef)}`)
    if (successCode !== '204' && ['Resource', 'CursorPage', 'GenericCommand'].includes(componentName(responseRef))) errors.push(`${operation.operationId}: generic success schema is forbidden`)
    if (operation.body && ['Resource', 'CursorPage', 'GenericCommand'].includes(operation.body)) errors.push(`${operation.operationId}: generic request schema is forbidden`)
  }
}

if (typedCount !== 28) errors.push(`R1-02 typed operation count must be 28, found ${typedCount}`)
if (actual.length !== expected.length) errors.push(`operation count mismatch: expected ${expected.length}, found ${actual.length}`)
if (spec.openapi !== '3.1.0') errors.push(`OpenAPI must be 3.1.0, found ${spec.openapi}`)
if (spec.servers?.[0]?.url !== '/api/v1') errors.push('first server must be /api/v1')

const optionalSession = spec.paths?.['/auth/email-verification-challenges']?.post?.security ?? []
if (!optionalSession.some(value => value.sessionCookie) || !optionalSession.some(value => Object.keys(value).length === 0)) {
  errors.push('requestEmailVerification must support optional session authentication')
}
for (const operationId of ['loginWithPassword', 'loginWithOtp']) {
  const found = actual.find(value => value.operation.operationId === operationId)?.operation
  const headers = found?.responses?.['200']?.headers ?? {}
  if (!headers['Set-Cookie'] || !headers['X-CSRF-Token']) errors.push(`${operationId}: missing session cookie or CSRF response contract`)
}

const forbiddenPaths = [
  /electronic-attestation/i,
  /diagnostic/i,
  /prescription/i,
  /refund/i,
  /reversal/i,
  /outbox/i,
  /webhook-inbox/i,
  /dead-letter/i,
  /\/actions\/(sign|publish)$/i,
]
for (const { path: apiPath, method, operation } of actual) {
  for (const pattern of forbiddenPaths) {
    if (pattern.test(apiPath)) errors.push(`${operation.operationId}: forbidden R1 path ${method.toUpperCase()} ${apiPath}`)
  }
}
if (spec.paths?.['/appointments']?.post) errors.push('direct Appointment creation is forbidden')
if (spec.paths?.['/charge-items']?.post) errors.push('public ChargeItem creation is forbidden')

if (errors.length) {
  console.error(`OpenAPI inventory check failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log(`OpenAPI inventory check passed: ${actual.length} operations, ${typedCount} typed R1-02 operations, ${modules.length} modules, 0 forbidden paths.`)

function resolve(value) {
  if (!value?.$ref?.startsWith('#/')) return value
  return value.$ref.slice(2).split('/').reduce((current, segment) => current?.[segment], spec)
}

function componentName(reference) {
  return reference?.split('/').at(-1)
}
