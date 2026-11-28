import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRow } from '../types'
import { FINISHED, MAIN_COLOR, clip, colorOf, elapsed, justFinished, merge, rule, spend } from './logic'
import type { Palette } from './logic'

const PANE = 'agents'
const TITLE = 'Agents'

const rows = atom({ plugin: 'agent-sidebar', key: 'rows' } as const, [])
const clock = atom({ plugin: 'agent-sidebar', key: 'now' } as const, 0)
const total = atom({ plugin: 'agent-sidebar', key: 'total' } as const, 0)
const main = atom({ plugin: 'agent-sidebar', key: 'main' } as const, { status: 'idle', startedAt: 0 })

const LABEL: Record<AgentRow['status'], { icon: string; word: string; color: string }> = {
  pending: { icon: '○', word: 'queued', color: 'subtle' },
  running: { icon: '●', word: 'running', color: 'claude' },
  waiting: { icon: '◐', word: 'waiting', color: 'warning' },
  idle: { icon: '◌', word: 'idle', color: 'subtle' },
  completed: { icon: '✓', word: 'done', color: 'success' },
  failed: { icon: '✗', word: 'failed', color: 'error' },
  killed: { icon: '■', word: 'stopped', color: 'inactive' },
}

export const register: Register = (on, options) => {
  const palette: Palette = options.palette === 'two-tone' ? 'two-tone' : 'colorful'
  const notifications = options.notifications !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-sidebar',
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
        if (notifications) {
          for (const row of justFinished(before, after)) {
            const label = LABEL[row.status]
            const time = elapsed((row.endedAt ?? now) - row.startedAt)
            // A system notification can fail (no channel, turned off): the pane still shows it.
            await $.ui
              .notify(`${label.icon} ${row.name ? `@${row.name} ` : ''}${row.description} ${label.word} · ${time}`, { title: 'agent-sidebar' })
              .catch(() => undefined)
          }
        }
        const usd = (await $.session.usage()).cost?.usd ?? 0
        if (usd !== (await read($, total))) await update($, total, () => usd)
        // The clock ticks only while someone is working: no redraws at rest.
        const busy = (await read($, main)).status === 'running' || after.some(row => !FINISHED.has(row.status))
        if (busy) await update($, clock, () => now)
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

  // The main session's own turns: no agentId. A subagent's turns carry theirs.
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      const now = await $.clock.now()
      await update($, main, () => ({ status: 'running' as const, startedAt: now }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      const now = await $.clock.now()
      await update($, main, old => ({ ...old, status: 'idle' as const, endedAt: now }))
    }
    return next(e)
  })

  // The pane replaces the engine's agent list under the prompt, which only took room from the chat.
  on('ui.render', { component: 'AgentRow' }, ($, e, next) => next({ ...e, props: { ...e.props, isHidden: true } }))

  on('command.run', { command: 'agent-sidebar' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return { text: opened.isPlaced ? 'Agents pane opened.' : 'Agents pane waiting for room.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const session = await read($, main)
    const sessionUsd = await read($, total)
    const now = Math.max(await read($, clock), session.endedAt ?? 0, ...list.map(row => row.endedAt ?? 0))
    const width = Math.max(20, e.props.bodyColumns ?? e.viewport?.columns ?? 60)
    const active = list.filter(row => !FINISHED.has(row.status)).length

    const card = (c: {
      key: string
      title: string
      kind: string
      status: AgentRow['status']
      time: string
      extra?: string
      tag: string
      color: string
      open: () => Promise<void>
    }) => {
      const label = LABEL[c.status]
      const title = clip(c.title, width - 6)
      const tag = clip(c.tag, width - 6)
      return (
        <Box flexDirection="column" marginTop={1}>
          {/* A row Box, not a Text: a Button cannot sit inside a Text. */}
          <Box flexDirection="row">
            <Text color={c.color}>── </Text>
            <Button key={c.key} label={c.tag} plain onPress={c.open}>
              <Text color={c.color} bold>{title}</Text>
            </Button>
            <Text color={c.color}> {rule(width - 4 - [...title].length)}</Text>
          </Box>
          <Text wrap="truncate-end">
            <Text dimColor>  {c.kind} · </Text>
            {/* Two-tone keeps the status word plain: the only colors are the cards'. */}
            {palette === 'two-tone' ? <Text>{label.word}</Text> : <Text color={label.color}>{label.word}</Text>}
            <Text dimColor>
              {' '}· {c.time}{c.extra ? ` · ${c.extra}` : ''}
            </Text>
          </Text>
          <Text wrap="truncate-end">
            <Text color={c.color}>{rule(width - [...tag].length - 4)} </Text>
            <Text backgroundColor={c.color} color="#1e1e1e"> {tag} </Text>
            <Text color={c.color}>─</Text>
          </Text>
        </Box>
      )
    }

    const view = (agentId?: string) => async () => {
      const shown = await $.ui.view(agentId ? { agentId } : {})
      if (shown.deny) await $.ui.toast(`Cannot open: ${shown.deny}`)
    }

    return (
      <Box flexDirection="column">
        <Text bold>
          {active} active · {list.length - active} finished
        </Text>
        {card({
          key: 'agent:main',
          title: `${session.status === 'running' ? '●' : '◌'} Main session`,
          kind: 'main',
          status: session.status,
          time: session.startedAt ? elapsed((session.status === 'running' ? now : (session.endedAt ?? now)) - session.startedAt) : '—',
          extra: sessionUsd ? `${spend(undefined, sessionUsd)} total` : undefined,
          tag: 'main',
          color: MAIN_COLOR[palette],
          open: view(),
        })}
        {/* No cut to the screen's height: the engine scrolls a body taller than its window. */}
        {list.map(row =>
          card({
            key: `agent:${row.id}`,
            title: `${row.parentId ? '↳ ' : ''}${LABEL[row.status].icon} ${row.description}`,
            kind: row.teammate ? 'teammate' : 'subagent',
            status: row.status,
            time: elapsed((row.endedAt ?? now) - row.startedAt),
            // Tokens and cost before the type: a narrow pane cuts the end of the line.
          extra: [spend(row.tokens, row.usd), row.name ? row.type : ''].filter(Boolean).join(' · '),
            tag: row.name ? `@${row.name}` : row.type,
            color: colorOf(row, palette),
            open: view(row.id),
          }),
        )}
      </Box>
    )
  })
}
