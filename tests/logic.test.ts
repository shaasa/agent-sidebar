import { expect, test } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

import { PALETTE, SUBAGENT_COLOR, TEAMMATE_COLOR, clip, colorOf, elapsed, justFinished, merge, rule, spend } from '../hooks/logic'

// Only the fields merge reads: the rest of AgentInfo is not needed here.
const agent = (id: string, status: AgentInfo['status'], parentId?: string, kind: AgentInfo['kind'] = 'local_agent') =>
  ({ id, description: `task ${id}`, type: 'general-purpose', status, parentId, kind }) as AgentInfo

test('a new agent starts when it first appears', () => {
  const rows = merge([], [agent('a', 'running')], 1000)
  expect(rows).toEqual([
    { id: 'a', description: 'task a', type: 'general-purpose', status: 'running', parentId: undefined, teammate: false, name: undefined, color: PALETTE[0], startedAt: 1000, endedAt: undefined },
  ])
})

test('keeps the start and fixes the end only once', () => {
  const first = merge([], [agent('a', 'running')], 1000)
  const done = merge(first, [agent('a', 'completed')], 5000)
  const later = merge(done, [agent('a', 'completed')], 9000)
  expect(later[0]?.startedAt).toBe(1000)
  expect(later[0]?.endedAt).toBe(5000)
})

test('active agents come before finished ones, most recent first', () => {
  let rows = merge([], [agent('a', 'running'), agent('b', 'running'), agent('c', 'running')], 0)
  rows = merge(rows, [agent('a', 'completed')], 10)
  rows = merge(rows, [agent('b', 'failed')], 20)
  expect(rows.map(row => row.id)).toEqual(['c', 'b', 'a'])
})

test('an agent gone from the list keeps its last seen status', () => {
  const rows = merge(merge([], [agent('a', 'completed')], 0), [], 50)
  expect(rows.map(row => row.id)).toEqual(['a'])
})

test('elapsed time reads in seconds, minutes and hours', () => {
  expect(elapsed(4_200)).toBe('4s')
  expect(elapsed(125_000)).toBe('2m 05s')
  expect(elapsed(3_900_000)).toBe('1h 05m')
})

test('each agent gets its own color, and keeps it', () => {
  const first = merge([], [agent('a', 'running'), agent('b', 'running')], 0)
  const later = merge(first, [agent('a', 'completed'), agent('b', 'running'), agent('c', 'running')], 10)
  const color = (id: string) => later.find(row => row.id === id)?.color
  expect([color('a'), color('b'), color('c')]).toEqual([PALETTE[0], PALETTE[1], PALETTE[2]])
})

test('tells teammates from subagents', () => {
  const rows = merge([], [agent('a', 'running'), agent('b', 'running', undefined, 'in_process_teammate')], 0)
  expect(rows.map(row => row.teammate)).toEqual([false, true])
})

test('only teammates get a proper name', () => {
  const sub = { ...agent('a', 'running'), name: 'auto-1' }
  const mate = { ...agent('b', 'running', undefined, 'in_process_teammate'), teammateId: 'review-node@my-team' }
  expect(merge([], [sub, mate], 0).map(row => row.name)).toEqual([undefined, 'review-node'])
})

test('clip adds an ellipsis only past the limit', () => {
  expect(clip('abc', 5)).toBe('abc')
  expect(clip('abcdef', 4)).toBe('abc…')
  expect(rule(0)).toBe('─')
})

test('two-tone gives one color per kind, colorful keeps each agent its own', () => {
  const [sub, mate] = merge([], [agent('a', 'running'), agent('b', 'running', undefined, 'in_process_teammate')], 0)
  expect([colorOf(sub!, 'two-tone'), colorOf(mate!, 'two-tone')]).toEqual([SUBAGENT_COLOR, TEAMMATE_COLOR])
  expect([colorOf(sub!, 'colorful'), colorOf(mate!, 'colorful')]).toEqual([PALETTE[0], PALETTE[1]])
})

test('justFinished reports agents that completed or failed since the last poll, once', () => {
  const start = merge([], [agent('a', 'running'), agent('b', 'running'), agent('c', 'running'), agent('d', 'completed')], 0)
  const next = merge(start, [agent('a', 'completed'), agent('b', 'failed'), agent('c', 'killed')], 10)
  expect(justFinished(start, next).map(row => row.id).sort()).toEqual(['a', 'b'])
  expect(justFinished(next, merge(next, [], 20))).toEqual([])
})

test('spend shows tokens and the estimated cost, leaving out what is missing', () => {
  expect(spend(10_400, 0.123)).toBe('10.4k tok · ~$0.12')
  expect(spend(950)).toBe('950 tok')
  expect(spend(2_500_000, 0)).toBe('2.5M tok')
  expect(spend(0, undefined)).toBe('')
})

test('tokens and cost follow the engine and stay once the agent leaves its list', () => {
  const live = { ...agent('a', 'running'), tokenCount: 5000, cost: { usd: 0.4 } }
  const rows = merge(merge([], [live], 0), [], 10)
  expect([rows[0]?.tokens, rows[0]?.usd]).toEqual([5000, 0.4])
})
