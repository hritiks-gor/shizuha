import { describe, expect, it } from 'vitest';
import { gatewayContextPromptArgs } from '../../src/daemon/manager.js';

describe('gatewayContextPromptArgs', () => {
  it('writes multi-line skill text to a file instead of --context-prompt', () => {
    const writes: Array<{ file: string; content: string }> = [];
    const args = gatewayContextPromptArgs({
      combined: 'Follow the workflow.\n\nStay on the task.',
      workspaceDir: '/tmp/shizuha-agent',
      bareMetal: true,
      writeFile: (file, content) => writes.push({ file, content }),
    });
    expect(args[0]).toBe('--context-prompt-file');
    expect(args[1]).toBe('/tmp/shizuha-agent/.bridge-context-prompt');
    expect(args.join(' ')).not.toContain('--context-prompt ');
    expect(writes[0]?.content).toContain('\n');
  });

  it('points container agents at the workspace mount', () => {
    const args = gatewayContextPromptArgs({
      combined: 'line\nline',
      workspaceDir: '/home/me/.shizuha/workspaces/shizuha',
      bareMetal: false,
      writeFile: () => {},
    });
    expect(args).toEqual(['--context-prompt-file', '/workspace/.bridge-context-prompt']);
  });
});
