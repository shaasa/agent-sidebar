import type { AgentInfo } from 'claude-code'

import type { AgentRow } from '../types'

export const MAX_ROWS = 50

// One fixed color per agent, assigned in order of arrival: hues far apart, then it wraps around.
export const PALETTE = [
  '#5fa8ff', '#ffc531', '#ff7a45', '#3dd6c4', '#ff6fb5', '#b18cff',
  '#7bd95f', '#ff5c5c', '#4fd0ff', '#e0e070', '#c88a5a', '#9aa7ff',
  '#ff9ee0', '#5fe0a0', '#ffa15f', '#d0d0d0',
]

export const FINISHED = new Set<AgentRow['status']>(['completed', 'failed', 'killed'])

export const elapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

// Merges the engine's list with what was already seen: keeps the start time and fixes the end
// once an agent reaches a final state. Active agents first, then finished ones, most recent first.
export const merge = (seen: AgentRow[], live: AgentInfo[], now: number): AgentRow[] => {
  const byId = new Map(seen.map(row => [row.id, row]))
  let next = seen.length
  for (const info of live) {
    const old = byId.get(info.id)
    const teammate = info.kind === 'in_process_teammate' || info.teammateId !== undefined
    byId.set(info.id, {
      id: info.id,
      description: info.description,
      type: info.type,
      status: info.status,
      parentId: info.parentId,
      teammate,
      // A proper name only for teammates: the engine gives background subagents a generated one.
      name: teammate ? (info.name ?? info.teammateId?.split('@')[0]) : undefined,
      color: old?.color ?? PALETTE[next++ % PALETTE.length],
      startedAt: old?.startedAt ?? now,
      endedAt: FINISHED.has(info.status) ? (old?.endedAt ?? now) : undefined,
    })
  }
  const all = [...byId.values()]
  const active = all.filter(row => !FINISHED.has(row.status))
  const done = all
    .filter(row => FINISHED.has(row.status))
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  return [...active, ...done].slice(0, MAX_ROWS)
}

// Cuts to `max` cells with an ellipsis, so long titles never wrap and break the rules.
export const clip = (text: string, max: number): string => {
  const chars = [...text]
  return chars.length <= max ? text : chars.slice(0, Math.max(0, max - 1)).join('') + '…'
}

export const rule = (cells: number): string => '─'.repeat(Math.max(1, cells))
