import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard rail: the UI must not contain kanji / kana anywhere in the source.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css|html)$/.test(f) ? [p] : [];
  });
}

describe('no Japanese characters in the app', () => {
  it.each(files('src'))('%s', (f) => {
    const hits = readFileSync(f, 'utf8').match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}「」]/gu);
    expect(hits ?? []).toEqual([]);
  });
});
