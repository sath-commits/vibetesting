import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { runAudit } from './runner'
import type { AuditJobData } from '../lib/queue'

const WORKER_URL = process.env.APP_URL || 'http://localhost:3000'
const WORKER_SECRET = process.env.WORKER_SECRET || ''

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const worker = new Worker<AuditJobData>(
  'audit-jobs',
  async (job) => {
    const { auditId, url } = job.data
    console.log(`[worker] Starting audit ${auditId} for ${url}`)

    const result = await runAudit(auditId, url)

    console.log(`[worker] Audit ${auditId} done: ${result.status}, ${result.results.length} results`)

    const res = await fetch(`${WORKER_URL}/api/worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': WORKER_SECRET,
      },
      body: JSON.stringify(result),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Worker callback failed: ${res.status} ${text}`)
    }

    return result
  },
  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  }
)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err)
})

console.log('[worker] VibeCheck worker started. Waiting for audit jobs...')

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
