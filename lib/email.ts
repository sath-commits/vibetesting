import { Resend } from 'resend'
import { getScoreBand } from './score'

const resend = new Resend(process.env.RESEND_API_KEY)

interface EmailResult {
  checkId: string
  name?: string
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'ERROR'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  message?: string
  fixSuggestion?: string
}

interface SendAuditReportParams {
  to: string
  url: string
  auditId: string
  score: number
  results: EmailResult[]
}

function buildHtml(params: SendAuditReportParams & { bandLabel: string; reportUrl: string }): string {
  const { url, score, bandLabel, reportUrl, results } = params
  const scoreColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const fails = results.filter((r) => r.status === 'FAIL').slice(0, 3)
  const warns = results.filter((r) => r.status === 'WARN').slice(0, 2)
  const topIssues = [...fails, ...warns].slice(0, 5)

  const issueRows = topIssues
    .map((r) => {
      const statusColor = r.status === 'FAIL' ? '#ef4444' : '#f59e0b'
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #2a2a2a;">
          <span style="font-family:monospace;font-size:11px;font-weight:bold;color:${statusColor};background:${statusColor}20;border:1px solid ${statusColor}40;padding:2px 6px;border-radius:4px;">${r.status}</span>
          <div style="margin-top:6px;">
            <div style="color:#fafafa;font-size:13px;font-weight:500;">${r.name || r.checkId}</div>
            ${r.message ? `<div style="color:#71717a;font-size:12px;margin-top:2px;">${r.message}</div>` : ''}
            ${r.fixSuggestion ? `<div style="color:#22c55e;font-size:12px;margin-top:6px;">→ ${r.fixSuggestion}</div>` : ''}
          </div>
        </td>
      </tr>`
    })
    .join('')

  const hostname = new URL(url).hostname

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:28px;">
        <span style="font-family:monospace;font-size:18px;font-weight:bold;color:#fafafa;">Vibe<span style="color:#22c55e;">Check</span></span>
      </td></tr>
      <tr><td style="background:#111111;border:1px solid #1f1f1f;border-radius:12px;padding:32px;text-align:center;">
        <div style="font-size:72px;font-weight:700;color:${scoreColor};line-height:1;">${score}</div>
        <div style="font-size:13px;color:#71717a;margin-top:4px;">/ 100</div>
        <div style="font-size:18px;font-weight:600;color:#fafafa;margin-top:10px;">${bandLabel}</div>
        <div style="font-family:monospace;font-size:12px;color:#71717a;margin-top:6px;">${hostname}</div>
      </td></tr>
      <tr><td style="height:24px;"></td></tr>
      ${
        topIssues.length > 0
          ? `<tr><td style="background:#111111;border:1px solid #1f1f1f;border-radius:12px;padding:24px;">
        <div style="font-size:13px;font-weight:600;color:#fafafa;margin-bottom:12px;">Top issues to fix</div>
        <table width="100%" cellpadding="0" cellspacing="0">${issueRows}</table>
      </td></tr><tr><td style="height:24px;"></td></tr>`
          : ''
      }
      <tr><td style="text-align:center;">
        <a href="${reportUrl}" style="display:inline-block;background:#22c55e;color:#000;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">View full report →</a>
      </td></tr>
      <tr><td style="height:32px;"></td></tr>
      <tr><td style="border-top:1px solid #1f1f1f;padding-top:20px;text-align:center;">
        <p style="color:#3a3a3a;font-size:11px;margin:0;">VibeCheck · Pre-launch QA for vibe-coded apps</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export async function sendAuditReport({ to, url, auditId, score, results }: SendAuditReportParams) {
  const band = getScoreBand(score)
  const reportUrl = `${process.env.APP_URL}/audit/${auditId}`
  const hostname = new URL(url).hostname

  return resend.emails.send({
    from: 'VibeCheck <reports@vibecheck.dev>',
    to,
    subject: `VibeCheck: ${score}/100 — ${band.label} · ${hostname}`,
    html: buildHtml({ to, url, auditId, score, results, bandLabel: band.label, reportUrl }),
  })
}
