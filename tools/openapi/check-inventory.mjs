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

for (const { module, operation } of expected) {
  const found = spec.paths?.[operation.path]?.[operation.method]
  if (!found) errors.push(`inventory missing in bundle: ${operation.method.toUpperCase()} ${operation.path}`)
  else {
    if (found.operationId !== operation.operationId) errors.push(`${operation.path}: expected operationId ${operation.operationId}`)
    if (found['x-medicore-module'] !== module.key) errors.push(`${operation.operationId}: wrong module owner`)
    const names = new Set((found.parameters ?? []).map(parameter => parameter.name))
    if (operation.idempotent && !names.has('Idempotency-Key')) errors.push(`${operation.operationId}: missing Idempotency-Key`)
    if (operation.ifMatch && !names.has('If-Match')) errors.push(`${operation.operationId}: missing If-Match`)
    if (operation.csrf && !names.has('X-CSRF-Token')) errors.push(`${operation.operationId}: missing X-CSRF-Token`)
  }
}

if (actual.length !== expected.length) errors.push(`operation count mismatch: expected ${expected.length}, found ${actual.length}`)
if (spec.openapi !== '3.1.0') errors.push(`OpenAPI must be 3.1.0, found ${spec.openapi}`)
if (spec.servers?.[0]?.url !== '/api/v1') errors.push('first server must be /api/v1')

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
console.log(`OpenAPI inventory check passed: ${actual.length} operations, ${modules.length} modules, 0 forbidden paths.`)
