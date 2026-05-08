/* eslint-disable @typescript-eslint/no-require-imports */
import { Queue } from 'bullmq'

export interface AuditJobData {
  auditId: string
  url: string
  userId?: string
}

let _auditQueue: Queue<AuditJobData> | null = null

function getQueue(): Queue<AuditJobData> {
  if (_auditQueue) return _auditQueue
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IORedis = require('ioredis')
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  })
  _auditQueue = new Queue<AuditJobData>('audit-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })
  return _auditQueue
}

export async function enqueueAudit(data: AuditJobData) {
  const queue = getQueue()
  return queue.add('run-audit', data, { jobId: data.auditId })
}
