export type AgentRow = {
  id: string
  description: string
  type: string
  status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
  parentId?: string
  color?: string
  teammate?: boolean
  name?: string
  startedAt: number
  endedAt?: number
}

export type MainState = { status: 'running' | 'idle'; startedAt: number; endedAt?: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-sidebar': { rows: AgentRow[]; now: number; main: MainState }
  }
}
