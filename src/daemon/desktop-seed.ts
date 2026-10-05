import type { AgentInfo } from './types.js';

/**
 * First launch of a local desktop core. One host agent, not a container,
 * so the person's files and shell are the ones the agent uses. More agents
 * are created from the sidebar, the same way a new session is.
 */
export function desktopFirstRunAgents(): AgentInfo[] {
  return [
    {
      id: 'local-shizuha',
      name: 'Shizuha',
      username: 'shizuha',
      email: 'shizuha@local',
      role: 'agent',
      status: 'active',
      localPort: 8017,
      executionMethod: 'shizuha',
      runtimeEnvironment: 'bare_metal',
      modelFallbacks: [
        { method: 'shizuha', model: 'auto' },
      ],
      mcpServers: [],
      personalityTraits: { style: 'pragmatic' },
      skills: ['coding', 'debugging'],
    },
  ];
}
