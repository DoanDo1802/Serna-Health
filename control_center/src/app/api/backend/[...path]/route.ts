import { NextRequest } from "next/server"

const API_ORIGIN = process.env.MEDICORE_API_ORIGIN || "http://localhost:8080"
const API_PREFIX = "/api/v1"
const TAB_CONTEXT_HEADER = "x-medicore-tab-context"
const COOKIE_PREFIX = process.env.MEDICORE_SESSION_COOKIE_PREFIX || "MEDICORE_SESSION_"
const CONTEXT_PATTERN = /^[A-Za-z0-9_-]{22}$/
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "idempotency-key",
  "if-match",
  "x-csrf-token",
  "x-request-id",
  TAB_CONTEXT_HEADER,
] as const
const FORWARDED_RESPONSE_HEADERS = ["content-type", "location", "etag", "x-csrf-token", "x-request-id", "x-correlation-id"] as const

function selectedCookie(request: NextRequest): string | null {
  const context = request.headers.get(TAB_CONTEXT_HEADER)
  if (!context || !CONTEXT_PATTERN.test(context)) return null
  const name = `${COOKIE_PREFIX}${context}`
  const token = request.cookies.get(name)?.value
  return token ? `${name}=${token}` : null
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params
  const tabContext = request.headers.get(TAB_CONTEXT_HEADER)
  if (!tabContext || !CONTEXT_PATTERN.test(tabContext)) {
    return Response.json({ title: "Bad Request", detail: "X-MediCore-Tab-Context is required", status: 400 }, { status: 400 })
  }

  const url = new URL(`${API_PREFIX}/${path.map(encodeURIComponent).join("/")}`, API_ORIGIN)
  url.search = request.nextUrl.search
  const headers = new Headers()
  for (const header of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(header)
    if (value) headers.set(header, value)
  }
  const cookie = selectedCookie(request)
  if (cookie) headers.set("cookie", cookie)

  const method = request.method
  const upstream = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  })
  const responseHeaders = new Headers({ "Cache-Control": "no-store" })
  for (const header of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(header)
    if (value) responseHeaders.set(header, value)
  }
  for (const setCookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", setCookie)
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
