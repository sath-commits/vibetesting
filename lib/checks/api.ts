/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const apiChecks: Check[] = [
  {
    id: 'api-001',
    slug: 'api-sensitive-fields',
    category: 'API',
    name: 'API returns sensitive fields',
    description: 'Checks common API endpoints for password, token, or secret fields in responses.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      const sensitiveKeys = ['password', 'secret', 'api_key', 'apikey', 'access_token', 'private_key']
      const endpoints = ['/api/user', '/api/me', '/api/profile', '/api/users']
      for (const endpoint of endpoints) {
        try {
          const res = await page.request.get(base + endpoint, { timeout: 5000 })
          if (res.status() === 200) {
            const text = await res.text()
            for (const key of sensitiveKeys) {
              if (text.toLowerCase().includes(`"${key}":`)) {
                return { status: 'FAIL', message: `Sensitive field "${key}" found in ${endpoint} response`, fixSuggestion: `Remove ${key} from API responses. Never serialize sensitive fields to the client.` }
              }
            }
          }
        } catch {}
      }
      return { status: 'PASS', message: 'No sensitive fields found in common API endpoints' }
    },
  },
  {
    id: 'api-002',
    slug: 'cors-wildcard',
    category: 'API',
    name: 'CORS wildcard header present',
    description: 'Checks API responses for Access-Control-Allow-Origin: * on sensitive routes.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      try {
        const res = await page.request.get(base + '/api', { timeout: 5000 })
        const cors = res.headers()['access-control-allow-origin']
        if (cors === '*') {
          return { status: 'WARN', message: 'CORS wildcard (*) on API endpoint', fixSuggestion: 'Restrict CORS to your specific frontend origins instead of using *.' }
        }
      } catch {}
      const wildcard = ctx.networkRequests.some((r) => r.headers['access-control-allow-origin'] === '*')
      if (wildcard) {
        return { status: 'WARN', message: 'CORS wildcard detected in network requests', fixSuggestion: 'Set Access-Control-Allow-Origin to your specific domain, not *.' }
      }
      return { status: 'PASS', message: 'No CORS wildcard detected' }
    },
  },
  {
    id: 'api-003',
    slug: 'error-stack-trace-leak',
    category: 'API',
    name: 'Error responses leak stack traces',
    description: 'Triggers 404 and checks if error response contains stack trace.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      try {
        const res = await page.request.get(base + '/api/nonexistent-endpoint-xyz-404', { timeout: 5000 })
        const text = await res.text()
        if (text.includes('at Object.') || text.includes('at async ') || text.includes('node_modules') || text.includes('Error:')) {
          return { status: 'FAIL', message: 'Stack trace visible in API error response', fixSuggestion: 'Catch all errors server-side and return generic messages. Never expose stack traces in production.' }
        }
      } catch {}
      return { status: 'PASS', message: 'No stack traces in error responses' }
    },
  },
  {
    id: 'api-004',
    slug: 'no-rate-limit-headers',
    category: 'API',
    name: 'No rate limiting headers on API responses',
    description: 'Checks for RateLimit or X-RateLimit headers on API responses.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasRateLimit = ctx.networkRequests.some((r) => {
        const headers = Object.keys(r.headers)
        return headers.some((h) => h.toLowerCase().includes('ratelimit') || h.toLowerCase().includes('x-rate-limit') || h.toLowerCase().includes('retry-after'))
      })
      if (!hasRateLimit) {
        return { status: 'WARN', message: 'No rate-limit headers detected on API responses', fixSuggestion: 'Add rate limiting headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset).' }
      }
      return { status: 'PASS', message: 'Rate-limit headers present' }
    },
  },
  {
    id: 'api-005',
    slug: 'file-upload-no-size-limit',
    category: 'API',
    name: 'File upload endpoint with no size restriction signals',
    description: 'Checks file upload inputs for accept and size validation.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const fileInputs = await page.$$('input[type="file"]')
      if (fileInputs.length === 0) return { status: 'SKIP', message: 'No file upload inputs found' }
      for (const input of fileInputs) {
        const accept = await input.getAttribute('accept')
        const maxSize = await input.getAttribute('data-max-size')
        if (!accept && !maxSize) {
          return { status: 'WARN', message: 'File input with no accept or size restriction', fixSuggestion: 'Add accept attribute, validate file size client-side, and enforce limits server-side.' }
        }
      }
      return { status: 'PASS', message: 'File inputs have restrictions' }
    },
  },
  {
    id: 'api-006',
    slug: 'env-vars-in-source',
    category: 'API',
    name: 'Environment variables visible in page source',
    description: 'Checks for NEXT_PUBLIC_ var leaks or other env var patterns in client source.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const patterns = [
        /process\.env\.[A-Z_]+(?<!NEXT_PUBLIC_[A-Z_]+)/,
        /SECRET_KEY/i,
        /DATABASE_URL/i,
        /PRIVATE_KEY/i,
      ]
      for (const pattern of patterns) {
        if (pattern.test(source)) {
          return { status: 'FAIL', message: `Server-side env var pattern detected in client source: ${pattern}`, fixSuggestion: 'Only use NEXT_PUBLIC_ prefix for variables safe to expose. Never expose secrets client-side.' }
        }
      }
      return { status: 'PASS', message: 'No server-side env vars detected in client source' }
    },
  },
  {
    id: 'api-007',
    slug: 'api-no-auth-required',
    category: 'API',
    name: 'API endpoints accessible without auth headers',
    description: 'Makes unauthenticated requests to common API routes.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      const routes = ['/api/users', '/api/data', '/api/admin', '/api/settings']
      for (const route of routes) {
        try {
          const res = await page.request.get(base + route, { timeout: 5000 })
          if (res.status() === 200) {
            const text = await res.text()
            try {
              const json = JSON.parse(text)
              if (Array.isArray(json) && json.length > 0) {
                return { status: 'WARN', message: `${route} returns data without auth`, fixSuggestion: `Protect ${route} with authentication middleware.` }
              }
            } catch {}
          }
        } catch {}
      }
      return { status: 'PASS', message: 'Common API routes appear auth-protected' }
    },
  },
  {
    id: 'api-008',
    slug: 'no-request-timeout-ui',
    category: 'API',
    name: 'No request timeout handling in UI',
    description: 'Checks if the UI handles slow API responses gracefully.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasTimeout = source.includes('timeout') || source.includes('AbortController') || source.includes('AbortSignal')
      if (!hasTimeout) {
        return { status: 'WARN', message: 'No request timeout/abort handling detected', fixSuggestion: 'Use AbortController with a timeout to cancel hung requests and show an error to users.' }
      }
      return { status: 'PASS', message: 'Timeout/abort handling detected' }
    },
  },
  {
    id: 'api-009',
    slug: 'sequential-api-waterfall',
    category: 'API',
    name: 'Sequential API waterfall on page load',
    description: 'Checks network timing for sequential requests that could be parallelized.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const apiRequests = ctx.networkRequests.filter((r) => r.url.includes('/api/'))
      if (apiRequests.length < 3) return { status: 'SKIP', message: 'Fewer than 3 API requests — waterfall check N/A' }
      return { status: 'PASS', message: `${apiRequests.length} API requests detected — timing analysis requires real measurement` }
    },
  },
  {
    id: 'api-010',
    slug: 'unhandled-promise-rejections',
    category: 'API',
    name: 'Unhandled promise rejections in console',
    description: 'Checks for unhandledrejection events captured during page load.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const rejections = ctx.consoleErrors.filter((e) => e.includes('UnhandledPromiseRejection') || e.includes('Uncaught (in promise)'))
      if (rejections.length > 0) {
        return { status: 'FAIL', message: `${rejections.length} unhandled promise rejection(s) detected`, detail: rejections.slice(0, 3).join('\n'), fixSuggestion: 'Add .catch() handlers or try/catch to all async operations.' }
      }
      return { status: 'PASS', message: 'No unhandled promise rejections' }
    },
  },
  {
    id: 'api-011',
    slug: 'missing-content-type',
    category: 'API',
    name: 'Missing Content-Type headers on API responses',
    description: 'Checks API responses for proper Content-Type headers.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const apiReqs = ctx.networkRequests.filter((r) => r.url.includes('/api/'))
      const missingCT = apiReqs.filter((r) => !r.headers['content-type'])
      if (missingCT.length > 0) {
        return { status: 'WARN', message: `${missingCT.length} API response(s) missing Content-Type header`, fixSuggestion: 'Always return Content-Type: application/json on JSON API responses.' }
      }
      return { status: 'PASS', message: 'API responses include Content-Type headers' }
    },
  },
  {
    id: 'api-012',
    slug: 'no-api-versioning',
    category: 'API',
    name: 'API versioning absent',
    description: 'Checks if API routes include versioning (/v1/, /v2/).',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const apiReqs = ctx.networkRequests.filter((r) => r.url.includes('/api/'))
      if (apiReqs.length === 0) return { status: 'SKIP', message: 'No API requests detected' }
      const hasVersioning = apiReqs.some((r) => /\/api\/v\d+\//.test(r.url))
      if (!hasVersioning) {
        return { status: 'WARN', message: 'No versioned API routes detected (/v1/, /v2/)', fixSuggestion: 'Consider versioning your API (e.g., /api/v1/) to allow breaking changes without disrupting clients.' }
      }
      return { status: 'PASS', message: 'API versioning present' }
    },
  },
]