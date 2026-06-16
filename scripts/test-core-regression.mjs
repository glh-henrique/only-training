import assert from 'node:assert/strict'
import { calculateDurationSeconds, formatDurationMMSS, isSameCalendarDay } from '../.tmp/core-tests/session.js'
import { sortSyncQueueByTimestamp, upsertSyncQueueAction } from '../.tmp/core-tests/sync-queue.js'
import { getSafeExternalUrl } from '../.tmp/core-tests/url.js'
import { mergeWorkoutsWithSessionStats } from '../.tmp/core-tests/workout-stats.js'

function run(name, fn) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('url empty values', () => {
  assert.equal(getSafeExternalUrl(), null)
  assert.equal(getSafeExternalUrl(null), null)
  assert.equal(getSafeExternalUrl('   '), null)
})

run('url invalid and unsafe protocols', () => {
  assert.equal(getSafeExternalUrl('notaurl'), null)
  assert.equal(getSafeExternalUrl('javascript:alert(1)'), null)
  assert.equal(getSafeExternalUrl('ftp://example.com'), null)
})

run('url valid protocols', () => {
  assert.equal(getSafeExternalUrl('https://example.com'), 'https://example.com/')
  assert.equal(getSafeExternalUrl(' http://example.com/path '), 'http://example.com/path')
})

run('session same day', () => {
  assert.equal(isSameCalendarDay(new Date('2026-01-10T23:59:59Z'), new Date('2026-01-10T00:00:00Z')), true)
  assert.equal(isSameCalendarDay(new Date('2026-01-11T00:00:00Z'), new Date('2026-01-10T23:59:59Z')), false)
})

run('session duration seconds', () => {
  assert.equal(calculateDurationSeconds(new Date('2026-01-10T00:00:05.900Z'), new Date('2026-01-10T00:00:00.000Z')), 5)
  assert.equal(calculateDurationSeconds(new Date('2026-01-10T00:00:00.000Z'), new Date('2026-01-10T00:00:05.000Z')), 0)
})

run('session format mm:ss', () => {
  assert.equal(formatDurationMMSS(0), '00:00')
  assert.equal(formatDurationMMSS(65), '01:05')
})

run('sync queue sort', () => {
  const sorted = sortSyncQueueByTimestamp([
    { id: '2', action: 'update', timestamp: 20, entityId: 'a' },
    { id: '1', action: 'create', timestamp: 10, entityId: 'a' }
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['1', '2'])
})

run('sync queue upsert', () => {
  const queue = [
    { id: '1', action: 'archive', timestamp: 10, entityId: 'w1' },
    { id: '2', action: 'archive', timestamp: 20, entityId: 'w2' }
  ]
  const updated = upsertSyncQueueAction(queue, { id: '3', action: 'unarchive', timestamp: 30, entityId: 'w1' }, (existing, incoming) => existing.entityId === incoming.entityId)
  assert.equal(updated.length, 2)
  assert.equal(updated.find((item) => item.entityId === 'w1')?.action, 'unarchive')
  assert.equal(updated.find((item) => item.entityId === 'w2')?.action, 'archive')
})

run('workout stats merge', () => {
  const result = mergeWorkoutsWithSessionStats(
    [{ id: 'w1', name: 'Workout 1' }, { id: 'w2', name: 'Workout 2' }],
    [
      { workout_id: 'w1', ended_at: '2026-02-01T10:00:00.000Z' },
      { workout_id: 'w2', ended_at: '2026-02-03T10:00:00.000Z' },
      { workout_id: 'w1', ended_at: '2026-02-05T10:00:00.000Z' },
      { workout_id: 'w1', ended_at: null },
      { workout_id: null, ended_at: '2026-02-10T10:00:00.000Z' }
    ]
  )

  const w1 = result.find((item) => item.id === 'w1')
  const w2 = result.find((item) => item.id === 'w2')

  assert.equal(w1?.completed_count, 3)
  assert.equal(w1?.last_completed_at, '2026-02-05T10:00:00.000Z')
  assert.equal(w2?.completed_count, 1)
  assert.equal(w2?.last_completed_at, '2026-02-03T10:00:00.000Z')
})

console.log('Core regression suite completed successfully.')
