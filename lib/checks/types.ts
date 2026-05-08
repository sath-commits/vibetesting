import type { Page } from 'playwright'

export type CheckCategory =
  | 'AUTH'
  | 'PAYMENTS'
  | 'DATABASE'
  | 'API'
  | 'FRONTEND'
  | 'MOBILE'
  | 'PERFORMANCE'
  | 'SECURITY'
  | 'EMAIL'

export type CheckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'ERROR'

export interface CheckResult {
  status: CheckStatus
  message: string
  detail?: string
  fixSuggestion?: string
  duration?: number
}

export interface AuditContext {
  detectedStack: string[]
  consoleErrors: string[]
  networkRequests: Array<{ url: string; status: number; headers: Record<string, string> }>
}

export interface Check {
  id: string
  slug: string
  category: CheckCategory
  name: string
  description: string
  severity: CheckSeverity
  stacks: string[]
  run: (page: Page, url: string, context: AuditContext) => Promise<CheckResult>
}
