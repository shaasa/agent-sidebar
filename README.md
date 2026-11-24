# agent-sidebar

A Claude Code mod that gives your **subagents and teammates** a side pane of their own, drawn in the style of **tmux**.

When you run several agents at once, the transcript gets crowded and it is hard to tell who is doing what. `agent-sidebar` opens a pane beside the chat with one colored card per agent, separated by rules and labeled with a tag on the right, the same way tmux frames its panes:

| `colorful` (default) | `two-tone` |
| --- | --- |
| ![colorful palette](docs/colorful.png) | ![two-tone palette](docs/two-tone.png) |

<sub>Rendered previews of the pane's layout and colors.</sub>

## Features

### A card for every agent
- **The main session** on top, always in the same color, with its status, turn time and the session's total cost.
- **One card per agent**, in a color that stays the same for the whole session.
- **Kind** of agent: `teammate` or `subagent`.
- **Status** at a glance: queued, running, waiting, idle, done, failed, stopped.
- **Elapsed time**, ticking only while the agent works.
- **The tag** on the closing rule: `@name` for teammates, the agent type for subagents.
- **Nested agents** marked with `↳`.
- Active agents first, then finished ones, most recent first.
- **Click a card's title** to jump to that agent's transcript; the main card takes you back.

### Tokens and cost
- **Tokens and estimated cost** on every card: `8.2k tok · ~$0.31`.
- **The session total** on the main card: `~$1.84 total`.
- They stay on the card after the agent is gone.
- In a narrow pane the line is cut at its end, so tokens and cost come before the agent type.
- The cost is **Claude Code's own estimate**, the same figure as `/cost`. On a subscription it is not what you pay.
- The tokens are Claude Code's own count: the latest request's input plus all the output so far.

### System notifications
- A notification when an agent **finishes or fails**, so you can look away while agents work.
- Stopped agents send none, and each agent sends one at most.
- Turn them off with the `notifications` option.

### More room for the chat
- **Hides Claude Code's own agent list** under the prompt: the pane shows the same agents.

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

## Options

Set them when you install, later in `/config`, or with:

```
/plugin configure agent-sidebar@agent-sidebar
```

| Option | Values | Default |
| --- | --- | --- |
| `palette` | `colorful`, `two-tone` | `colorful` |
| `notifications` | `true`, `false` | `true` |

### Palette

| Value | Look |
| --- | --- |
| `colorful` | Every agent gets its own color; the main session is always Claude orange. |
| `two-tone` | Only two muted colors: blue-gray for **teammates**, sand for **subagents**. The main session is always **gray**, and status words are plain. |

### Notifications

Sent through the notification channel set in Claude Code: iTerm2, kitty, Ghostty, or the terminal bell. If no channel is set, nothing is sent and the pane still shows the change.

## Update

### Automatic updates
Claude Code does not auto-update plugins from third-party marketplaces unless you turn it on. To turn it on:

1. Run `/plugin`.
2. Open the **Marketplaces** tab.
3. Select `agent-sidebar` and turn on **auto-update**.

### By hand

At the prompt, run `/plugin`, pick `agent-sidebar` and choose **update**. The running session reloads the mod, no restart needed.

From a shell (applies to sessions started afterwards):

```
claude plugin marketplace update agent-sidebar
claude plugin update agent-sidebar@agent-sidebar
```

## What it runs and what it sends

`agent-sidebar` is a Claude Code mod: one hooks module, `hooks/register.tsx`, with no other code, no dependencies and no scripts.

### What each hook does
| Hook | What it does |
| --- | --- |
| `session.start` | Registers the `/agent-sidebar` command. Once a second it reads the session's agent list (`$.agent.list`) and the session's cost estimate (`$.session.usage`), updates the pane, opens the pane when a new agent appears, and sends a notification when an agent finishes or fails. |
| `turn.start`, `turn.complete` | Mark the main session as running or idle, for the main card. They change nothing in the turn. |
| `command.run` (`/agent-sidebar`) | Opens the pane. |
| `ui.render` on `Pane` | Draws the pane. |
| `ui.render` on `AgentRow` | Hides the rows of Claude Code's own agent list under the prompt. The agents themselves are untouched. |

### What it sends, and where (egress)
- **Nothing leaves your computer.** No web requests, no other plugin called, no files written.
- **Notifications** are the only way out of Claude Code, and only to your own desktop: `$.ui.notify` hands the text to the notification channel set in Claude Code (iTerm2, kitty, Ghostty or the terminal bell). The text is the agent's name, description, status and elapsed time. It is sent only when an agent finishes or fails, and never with the `notifications` option off.

Every call the mod makes, and what it does:

| Call | What it does | Sends anything out? |
| --- | --- | --- |
| `$.ui.notify` | Shows a system notification on your computer through Claude Code's notification channel. | Only to your own desktop, as above. |
| `$.agent.list` | Reads the session's subagents and teammates. | No |
| `$.session.usage` | Reads the session's cost estimate, the same as `/cost`. | No |
| `$.clock.every`, `$.clock.now` | Run the once-a-second refresh and read the time. | No |
| `$.command.register` | Adds the `/agent-sidebar` command. | No |
| `$.state.get`, `$.state.set` | Keep what the pane shows in the session's memory. | No |
| `$.ui.open`, `$.ui.panes` | Open the pane, and check whether it is open. | No |
| `$.ui.resolve` | Gets the elements the pane is drawn with. | No |
| `$.ui.view` | Switches the view to the agent whose card you clicked. | No |
| `$.ui.toast` | Shows a short message inside Claude Code when that switch fails. | No |

## Develop

```
claude --plugin-dir ./agent-sidebar   # run a session with the mod loaded from this folder
claude plugin validate .              # check the manifest and the hooks module
claude plugin test .                  # run the tests in tests/
```

## License

MIT
