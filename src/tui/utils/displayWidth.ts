/**
 * Terminal display width for composer padding (SCLI-822).
 *
 * JS string length under-counts wide glyphs (emoji, CJK, VS16) and over-counts
 * combining marks. Ink then leaves the previous placeholder cell on screen —
 * the grey "p" that survives until a full resize redraw.
 */

const WIDE = /[\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function isWideCodePoint(cp: number): boolean {
  if (cp >= 0x1f000 && cp <= 0x1ffff) return true;
  if (cp >= 0x20000 && cp <= 0x3fffd) return true;
  return WIDE.test(String.fromCodePoint(cp));
}

function charWidth(ch: string): number {
  const cp = ch.codePointAt(0)!;
  if (cp === 0xfe0f || cp === 0xfe0e || cp === 0x200d) return 0;
  if (/\p{M}/u.test(ch)) return 0;
  return isWideCodePoint(cp) ? 2 : 1;
}

function isEmojiBase(cp: number): boolean {
  return (cp >= 0x1f000 && cp <= 0x1ffff)
    || (cp >= 0x2600 && cp <= 0x27bf)
    || cp === 0x2708; // airplane, used with VS16 in the SCLI-822 repro
}

/**
 * Display width of a JS string. A ZWJ sequence is one glyph: take the widest
 * base in the sequence, do not sum the pieces. Variation selectors and
 * combining marks add no cells.
 */
export function displayWidth(text: string): number {
  let width = 0;
  let inZwj = false;
  let seqWidth = 0;
  const flush = () => {
    if (inZwj) {
      width += Math.max(seqWidth, 2);
      inZwj = false;
      seqWidth = 0;
    }
  };
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const cp = ch.codePointAt(0)!;
    if (cp === 0x200d) {
      inZwj = true;
      continue;
    }
    if (cp === 0xfe0f || cp === 0xfe0e || /\p{M}/u.test(ch)) continue;
    const w = isWideCodePoint(cp) || isEmojiBase(cp) ? 2 : 1;
    if (inZwj || chars[i + 1]?.codePointAt(0) === 0x200d) {
      inZwj = true;
      seqWidth = Math.max(seqWidth, w);
      if (chars[i + 1]?.codePointAt(0) !== 0x200d) flush();
      continue;
    }
    width += w;
  }
  flush();
  return width;
}

/** Clip to a display-width budget and pad with spaces to that budget. */
export function padToDisplayWidth(text: string, maxWidth: number): string {
  // Keep whole ZWJ sequences. Walk by displayWidth of the prefix.
  let out = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const next = out + chars[i];
    if (displayWidth(next) > maxWidth) break;
    out = next;
  }
  return out + ' '.repeat(Math.max(0, maxWidth - displayWidth(out)));
}
