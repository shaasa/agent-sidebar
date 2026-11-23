import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRow } from '../types'
import { FINISHED, clip, elapsed, merge, rule } from './logic'

const PANE = 'agents'
const TITLE = 'Agents'

const rows = atom({ plugin: 'agent-sidebar', key: 'rows' } as const, [])
const clock = atom({ plugin: 'agent-sidebar', key: 'now' } as const, 0)

const LABEL: Record<AgentRow['status'], { icon: string; word: string; color: string }> = {
  pending: { icon: '○', word: 'queued', color: 'subtle' },
  running: { icon: '●', word: 'running', color: 'claude' },
  waiting: { icon: '◐', word: 'waiting', color: 'warning' },
  idle: { icon: '◌', word: 'idle', color: 'subtle' },
  completed: { icon: '✓', word: 'done', color: 'success' },
  failed: { icon: '✗', word: 'failed', color: 'error' },
  killed: { icon: '■', word: 'stopped', color: 'inactive' },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agents',
      description: 'Opens the side pane with the agents of this session',
    })

    $.clock.every(1000, () => {
      void (async () => {
        const live = await $.agent.list()
        const now = await $.clock.now()
        const before = await read($, rows)
        const after = merge(before, live, now)
        if (JSON.stringify(after) !== JSON.stringify(before)) {
          await update($, rows, () => after)
        }
        // The clock ticks only while someone is working: no redraws at rest.
        if (after.some(row => !FINISHED.has(row.status))) {
          await update($, clock, () => now)
        }
        // A new agent opens the pane (if the terminal is wide enough).
        const known = new Set(before.map(row => row.id))
        if (after.some(row => !known.has(row.id))) {
          const panes = await $.ui.panes()
          if (!panes.some(pane => pane.id === PANE)) {
            await $.ui.open({ id: PANE, title: TITLE })
          }
        }
      })().catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'agents' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return { text: opened.isPlaced ? 'Agents pane opened.' : 'Agents pane waiting for room.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const now = Math.max(await read($, clock), ...list.map(row => row.endedAt ?? 0))
    const width = Math.max(20, e.props.bodyColumns ?? e.viewport?.columns ?? 60)
    // Each card: header, status, closing rule and one blank line.
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 4) / 4))
    const active = list.filter(row => !FINISHED.has(row.status)).length

    return (
      <Box flexDirection="column">
        <Text bold>
          {active} active · {list.length - active} finished
        </Text>
        {list.length === 0 && <Text dimColor>No agents in this session.</Text>}
        {list.slice(0, room).map(row => {
          const label = LABEL[row.status]
          const color = row.color ?? label.color
          const time = elapsed((row.endedAt ?? now) - row.startedAt)
          const title = clip(`${row.parentId ? '↳ ' : ''}${label.icon} ${row.description}`, width - 6)
          const tag = clip(row.name ? `@${row.name}` : row.type, width - 6)
          return (
            <Box flexDirection="column" marginTop={1}>
              {/* A row Box, not a Text: a Button cannot sit inside a Text. */}
              <Box flexDirection="row">
                <Text color={color}>── </Text>
                <Button
                  key={`agente:${row.id}`}
                  label={row.name ? `@${row.name}` : row.description}
                  plain
                  onPress={async () => {
                    const shown = await $.ui.view({ agentId: row.id })
                    if (shown.deny) await $.ui.toast(`Cannot open: ${shown.deny}`)
                  }}
                >
                  <Text color={color} bold>{title}</Text>
                </Button>
                <Text color={color}> {rule(width - 4 - [...title].length)}</Text>
              </Box>
              <Text wrap="truncate-end">
                <Text color={label.color}>  {label.word}</Text>
                <Text dimColor>
                  {' '}· {time}{row.name ? ` · ${row.type}` : ''}
                </Text>
              </Text>
              <Text wrap="truncate-end">
                <Text color={color}>{rule(width - [...tag].length - 4)} </Text>
                <Text backgroundColor={color} color="#1e1e1e"> {tag} </Text>
                <Text color={color}>─</Text>
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
