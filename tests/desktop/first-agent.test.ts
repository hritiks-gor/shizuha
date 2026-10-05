import { describe, expect, it } from 'vitest';
import { desktopFirstRunAgents } from '../../src/daemon/desktop-seed.js';
import { randomDesktopAgentIdentity } from '../../src/web/lib/agent-name.js';

describe('desktop first agent', () => {
  it('starts with one bare-metal agent named Shizuha', () => {
    const agents = desktopFirstRunAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0]?.name).toBe('Shizuha');
    expect(agents[0]?.runtimeEnvironment).toBe('bare_metal');
    expect(agents[0]?.executionMethod).toBe('shizuha');
  });

  it('mints a renameable username the create API accepts', () => {
    const identity = randomDesktopAgentIdentity(() => 0.1);
    expect(identity.name.length).toBeGreaterThan(1);
    expect(identity.username).toMatch(/^[a-z][a-z0-9_-]{1,30}$/);
  });
});
