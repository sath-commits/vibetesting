type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type TestStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'ERROR'

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 4,
  LOW: 1,
}

export interface ScoredResult {
  status: TestStatus
  severity: Severity
}

export function calculateScore(results: ScoredResult[]): number {
  const active = results.filter((r) => r.status !== 'SKIP')
  if (active.length === 0) return 100

  const maxPossible = active.reduce((sum, r) => sum + SEVERITY_WEIGHTS[r.severity], 0)
  const deductions = results
    .filter((r) => r.status === 'FAIL')
    .reduce((sum, r) => sum + SEVERITY_WEIGHTS[r.severity], 0)

  return Math.max(0, Math.round(((maxPossible - deductions) / maxPossible) * 100))
}

export interface ScoreBand {
  label: string
  description: string
  color: string
}

export function getScoreBand(score: number): ScoreBand {
  if (score >= 90) return { label: 'Ship it', description: 'Excellent — ready to launch', color: '#22c55e' }
  if (score >= 75) return { label: 'Almost there', description: 'A few things to fix', color: '#22c55e' }
  if (score >= 50) return { label: 'Fix before you post', description: 'Risky — fix key issues first', color: '#f59e0b' }
  return { label: 'Do not ship', description: 'Critical issues found', color: '#ef4444' }
}

export function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}
