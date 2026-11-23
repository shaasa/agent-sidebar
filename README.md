# agent-sidebar

A Claude Code mod that gives your **subagents and teammates** a side pane of their own, drawn in the style of **tmux**.

When you run several agents at once, the transcript gets crowded and it is hard to tell who is doing what. `agent-sidebar` opens a pane beside the chat with one colored card per agent, separated by rules and labeled with a tag on the right, the same way tmux frames its panes:

```
2 active · 1 finished

── ● Main session ────────────────────────────────
  main · running · 4m 10s
─────────────────────────────────────────── main ─

── ● Review node changes ─────────────────────────
  teammate · running · 2m 50s · reviewer-node
─────────────────────────────────── @review-node ─

── ◐ Write the failing tests ─────────────────────
  subagent · waiting · 1m 12s
──────────────────────────────── general-purpose ─

── ✓ Explore the codebase ────────────────────────
  subagent · done · 21s
──────────────────────────────────────── Explore ─
```

## What it shows

- **The main session** on top, always in the same color, with its own status and turn time.
- **One card per agent**, each in its own color that stays the same for the whole session.
- **Kind** of agent: `teammate` or `subagent`.
- **Status** at a glance: queued, running, waiting, idle, done, failed, stopped.
- **Elapsed time**, ticking only while the agent works.
- **The tag** on the closing rule: `@name` for teammates, the agent type for subagents.
- **Nested agents** marked with `↳`.
- **Click a card's title** to jump to that agent's transcript (the main card takes you back).
- Active agents first, then finished ones, most recent first.
- Long titles are cut with `…`, so the rules never wrap.
- **Hides Claude Code's own agent list** under the prompt: the pane shows the same agents, and the chat gets its room back.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install agent-sidebar --marketplace shaasa/agent-sidebar
```

Answer `y` to add the marketplace, then pick a scope (user scope is the default).

From a shell:

```
claude plugin install agent-sidebar --marketplace shaasa/agent-sidebar
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `shaasa/agent-sidebar`, then **Add plugin**.

## Use

- The pane **opens by itself** when the first agent starts, if the terminal is wide enough to dock it beside the chat.
- Open it any time with:

```
/agent-sidebar
```

## Palette

Pick the look when you install, or later in `/config`:

| Value | Look |
| --- | --- |
| `colorful` (default) | Every agent gets its own color; the main session is always Claude orange. |
| `two-tone` | Only two muted colors: blue-gray for **teammates**, sand for **subagents**. The main session is always **gray**, and status words are plain. |

## Develop

```
claude --plugin-dir ./agent-sidebar   # run a session with the mod loaded from this folder
claude plugin validate .              # check the manifest and the hooks module
claude plugin test .                  # run the tests in tests/
```

## License

MIT
