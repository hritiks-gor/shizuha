import { describe, expect, it } from 'vitest';
import { displayWidth, padToDisplayWidth } from '../../src/tui/utils/displayWidth.js';

describe('SCLI-822 display width padding', () => {
  it('counts VS16 emoji as two cells and pads the rest', () => {
    const text = 'A✈️B';
    expect(displayWidth(text)).toBe(4);
    const padded = padToDisplayWidth(text, 8);
    expect(displayWidth(padded)).toBe(8);
    expect(padded.endsWith('    ')).toBe(true);
    expect(padded.includes('p')).toBe(false);
  });

  it('does not leave a short pad when JS length under-counts', () => {
    const text = 'A✈️B';
    expect(text.length).toBe(4);
    const jsPad = text + ' '.repeat(8 - text.length);
    expect(displayWidth(jsPad)).toBe(displayWidth(text) + (8 - text.length));
    expect(displayWidth(padToDisplayWidth(text, 8))).toBe(8);
  });
});
