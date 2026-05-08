import { chromium, type Page, type BrowserContext } from 'playwright'
import { getChecksForStack } from '../lib/checks/registry'
import type { AuditContext, CheckResult } from '../lib/checks/types'

const AUDIT_TIMEOUT_MS = 5 * 60 * 1000
const CHECK_TIMEOUT_MS = 10 * 1000

function detectStack(source: string, headers: Record<string, string>): string[] {
  const stack: string[] = []
  if (source.includes('supabase') || headers['x-powered-by']?.includes('supabase')) stack.push('supabase')
  if (source.includes('stripe') || source.includes('js.stripe.com')) stack.push('stripe')
  if (headers['x-vercel-id'] || source.includes('__vercel')) stack.push('vercel')
  if (source.includes('_next/') || source.includes('__NEXT_DATA__')) stack.push('nextjs')
  return stack
}

export interface AuditRunResult {
  auditId: string
  status: 'COMPLETE' | 'FAILED'
  stack: string[]
  results: Array<{
    checkId: string
    category: string
    status: string
    severity: string
    message?: string
    detail?: string
    fixSuggestion?: string
    duration?: number
  }>
}

export async function runAudit(auditId: string, url: string): Promise<AuditRunResult> {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const context: AuditContext = {
    detectedStack: [],
    consoleErrors: [],
    networkRequests: [],
  }

  let page: Page | null = null

  try {
    const browserCtx: BrowserContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (compatible; VibeCheck/1.0; +https://vibecheck.dev)',
    })

    page = await browserCtx.newPage()

    page.on('console', (msg) => {
      if (msg.type() === 'error') context.consoleErrors.push(msg.text())
    })

    page.on('pageerror', (err) => {
      context.consoleErrors.push(`Uncaught (in promise): ${err.message}`)
    })

    page.on('response', (response) => {
      const url = response.url()
      if (url.startsWith('data:') || url.startsWith('blob:')) return
      context.networkRequests.push({
        url,
        status: response.status(),
        headers: response.headers() as Record<string, string>,
      })
    })

    let mainResponse: any
    try {
      mainResponse = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
    } catch {
      mainResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null)
    }

    if (!mainResponse) {
      return { auditId, status: 'FAILED', stack: [], results: [] }
    }

    await page.waitForTimeout(2000)

    const source = await page.content()
    const responseHeaders = mainResponse.headers() as Record<string, string>
    context.detectedStack = detectStack(source, responseHeaders)

    const checks = getChecksForStack(context.detectedStack)
    const results: AuditRunResult['results'] = []

    const deadline = Date.now() + AUDIT_TIMEOUT_MS
    for (const check of checks) {
      if (Date.now() > deadline) {
        results.push({
          checkId: check.id,
          category: check.category,
          status: 'SKIP',
          severity: check.severity,
          message: 'Audit time limit reached',
        })
        continue
      }

      const start = Date.now()
      let result: CheckResult

      try {
        result = await Promise.race([
          check.run(page, url, context),
          new Promise<CheckResult>((_, reject) =>
            setTimeout(() => reject(new Error('Check timeout')), CHECK_TIMEOUT_MS)
          ),
        ])
      } catch (err: any) {
        result = {
          status: 'ERROR',
          message: err.message?.substring(0, 200) || 'Check threw an error',
        }
      }

      results.push({
        checkId: check.id,
        category: check.category,
        status: result.status,
        severity: check.severity,
        message: result.message,
        detail: result.detail,
        fixSuggestion: result.fixSuggestion,
        duration: Date.now() - start,
      })

      // Reset viewport between checks
      try {
        await page.setViewportSize({ width: 1280, height: 800 })
      } catch {}
    }

    return {
      auditId,
      status: 'COMPLETE',
      stack: context.detectedStack,
      results,
    }
  } catch (err) {
    console.error('Audit runner error:', err)
    return { auditId, status: 'FAILED', stack: [], results: [] }
  } finally {
    await browser.close().catch(() => {})
  }
}
